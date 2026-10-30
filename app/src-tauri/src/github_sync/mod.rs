//! GitHub-backed sync (v2.6).
//!
//! Builds on the v2.2 AutoGit foundation. Where AutoGit gives every save a
//! local commit, this module wires that local repo to a GitHub remote so
//! the same vault can be pushed / pulled from any device the user logs in
//! on.
//!
//! Architecture:
//!   1. User pastes a GitHub Personal Access Token into Settings. We
//!      store it in the OS keychain via the `keyring` crate (same backend
//!      as v2.0 AI keys) under service `solomd-github`.
//!   2. User picks an existing repo or creates a fresh private one
//!      (`github_create_vault_repo`). The remote URL is written into
//!      `<workspace>/.solomd/sync.json` so we can pick up the binding on
//!      relaunch without depending on git's remote config alone.
//!   3. Each save still triggers AutoGit's local commit. After the local
//!      commit lands we optionally `git push` to the remote (the frontend
//!      decides via the `auto_push` setting).
//!   4. A periodic timer on the frontend calls `github_pull` to fetch +
//!      fast-forward. If the remote has diverged we surface a conflict
//!      list rather than auto-merging — the writer-class user is going
//!      to want a side-by-side diff for prose conflicts.
//!
//! Authentication uses HTTPS + PAT, not SSH. PAT is sent via the
//! libgit2 credential callback as basic-auth username `x-access-token`,
//! password = the token. Same shape that GitHub Codespaces uses.
//!
//! Tauri commands exported (registered in `lib.rs` AND `runner.rs` —
//! see the v2.5 lesson about the dual-registration trap):
//!   * `github_set_token` / `github_clear_token` / `github_has_token`
//!   * `github_user` — `/user` API
//!   * `github_list_repos` — `/user/repos` (owner+private)
//!   * `github_create_vault_repo` — `POST /user/repos`
//!   * `github_link_workspace` — write `.solomd/sync.json`, set remote
//!   * `github_unlink_workspace`
//!   * `github_sync_status` — fast read-only summary
//!   * `github_push`
//!   * `github_pull` — fetch + ff-merge, or list conflicts
//!   * `github_resolve_conflict` — for one path: keep local / remote / both

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use git2::{AutotagOption, FetchOptions, PushOptions, Repository, Signature};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "solomd-github";
const KEYRING_USER: &str = "personal-access-token";
const SYNC_CONFIG_FILE: &str = ".solomd/sync.json";
const GITHUB_API: &str = "https://api.github.com";
const USER_AGENT: &str = "SoloMD-sync/2.6";

/// v3.0 — process-local token cache. Auto-push fires every save and
/// auto-pull every N minutes; without this each call would re-read the
/// keychain (= macOS prompt on every sync if the user hasn't clicked
/// "Always Allow"). Cache lives only in this process's RAM — never
/// persisted, never logged. Cleared on `clear_token` and on a successful
/// `set_token` (which overwrites it with the fresh value).
static TOKEN_CACHE: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

pub mod api;
pub mod config;
pub mod gitea;
pub mod link;
pub mod proxy;
pub mod pull;
pub mod push;
pub mod resolve;
pub mod status;
pub mod token;
#[cfg(test)]
mod tests;

use api::*;
use config::*;
use gitea::*;
use proxy::*;
pub use pull::*;
use resolve::*;
pub use push::*;
use token::*;

/// Build credential + push/fetch options that authenticate over HTTPS using
/// our PAT. Same shape used by `gh-cli` / GitHub Codespaces.
/// Owner segment of an HTTPS git URL — `https://host/OWNER/repo.git` → `OWNER`.
/// Used to authenticate against forges that validate the Basic-auth username
/// instead of ignoring it (see `make_callbacks`).
fn owner_from_url(url: &str) -> Option<String> {
    let after_scheme = url.split("://").nth(1)?;
    let mut segs = after_scheme.split('/');
    let _host = segs.next()?;
    let owner = segs.next()?;
    if owner.is_empty() { None } else { Some(owner.to_string()) }
}

fn make_callbacks(token: String) -> git2::RemoteCallbacks<'static> {
    let mut cb = git2::RemoteCallbacks::new();
    cb.credentials(move |url, username, _allowed| {
        // GitHub accepts the PAT as the password with the literal username
        // "x-access-token", regardless of the user's login, and Gitea /
        // Forgejo ignore the username field entirely — verified against a
        // real Gitea 1.27 instance, where even a nonexistent username
        // authenticates fine.
        //
        // Gitee (gitee.com) does NOT. It validates the username and answers
        //     remote: The token username invalid
        //     403
        // for anything that is not the account name, which made every
        // Gitee remote fail no matter how many times the user re-entered a
        // working token (#249). Confirmed against a private Gitee repo:
        // owner+token succeeds, x-access-token+token 403s.
        //
        // The owner segment of the remote URL is that account name, so use it
        // for hosts that need a real one. git may also hand us a username
        // parsed out of the URL itself — prefer that when present.
        let host_needs_real_username = url.contains("gitee.com");
        if host_needs_real_username {
            if let Some(u) = username.filter(|u| !u.is_empty()) {
                return git2::Cred::userpass_plaintext(u, &token);
            }
            if let Some(owner) = owner_from_url(url) {
                return git2::Cred::userpass_plaintext(&owner, &token);
            }
        }
        git2::Cred::userpass_plaintext("x-access-token", &token)
    });
    cb
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}


fn stamp_pull(workspace: &Path) {
    if let Ok(Some(mut cfg)) = load_config(workspace) {
        cfg.last_pull_at = Some(now_secs());
        let _ = save_config(workspace, &cfg);
    }
}

/// Tiny date stamp without pulling a chrono dep — `2026-04-27`.
fn chrono_like_date() -> String {
    let secs = now_secs();
    // 1970-01-01 + secs / 86400 days. Crude but good enough for filenames.
    let days = secs / 86_400;
    let (y, m, d) = epoch_days_to_ymd(days);
    format!("{:04}-{:02}-{:02}", y, m, d)
}

/// Civil-from-days, Howard Hinnant's algorithm. Public domain.
fn epoch_days_to_ymd(z: i64) -> (i32, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m, d)
}
