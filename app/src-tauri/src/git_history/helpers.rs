//! Shared libgit2 helpers for the AutoGit commands.

use std::fs;
use std::path::{Path, PathBuf};

use git2::{Commit, IndexAddOption, Repository, Signature, Status, StatusOptions};

/// Open the repo at `folder`. We don't walk upwards — the workspace folder
/// is the repo root by construction.
pub(super) fn open_repo(folder: &str) -> Result<Repository, String> {
    let path = Path::new(folder);
    Repository::open(path).map_err(|e| format!("git open failed: {}", e))
}

/// Build a `Signature` for commits. Reads `user.name` / `user.email` from
/// the user's global git config; falls back to `solomd@local`.
pub(super) fn build_signature(repo: &Repository) -> Result<Signature<'static>, String> {
    let cfg = repo.config().map_err(|e| format!("git config: {}", e))?;
    let name = cfg
        .get_string("user.name")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "SoloMD".to_string());
    let email = cfg
        .get_string("user.email")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "solomd@local".to_string());
    Signature::now(&name, &email).map_err(|e| format!("signature: {}", e))
}

/// Convert an absolute working-copy path into a forward-slash repo-relative
/// path (libgit2's pathspec format). Returns `None` if the file is outside
/// the workdir.
///
/// We canonicalize both sides before comparing — on macOS `/tmp` and
/// `/var/...` are symlinks to `/private/tmp` and `/private/var/...`, and
/// `repo.workdir()` returns the canonical form while the JS frontend
/// typically passes the un-resolved path. Without canonicalization,
/// `strip_prefix` fails and AutoGit silently rejects every save with
/// "file is outside workspace".
pub(super) fn rel_path(repo: &Repository, abs: &str) -> Option<String> {
    let workdir = repo.workdir()?;
    let abs_path = Path::new(abs);

    // Try the cheap fast path first — most users on Linux / Windows hit it.
    if let Ok(stripped) = abs_path.strip_prefix(workdir) {
        return Some(stripped.to_string_lossy().replace('\\', "/"));
    }

    // Symlinks differ — canonicalize both, retry. We only canonicalize the
    // file path's *parent*, since the file itself may have just been
    // created and `canonicalize` would succeed but trigger a stat we can
    // skip. The parent is enough to resolve every symlink up to the file.
    let abs_canon = match abs_path.parent().and_then(|p| p.canonicalize().ok()) {
        Some(parent) => parent.join(abs_path.file_name()?),
        None => abs_path.canonicalize().ok()?,
    };
    let workdir_canon = workdir.canonicalize().ok()?;
    let stripped = abs_canon.strip_prefix(&workdir_canon).ok()?;
    Some(stripped.to_string_lossy().replace('\\', "/"))
}

/// Default auto-commit message: `auto: 2026-04-24 09:30:01`.
pub(super) fn default_auto_message() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    // Tiny, dep-free local-time formatter. We display in UTC to avoid pulling
    // chrono just for one timestamp; users see this only in commit messages.
    format!("auto: {}", format_unix_utc(secs))
}

/// Format `YYYY-MM-DD HH:MM:SS` in UTC from a unix timestamp.
pub(super) fn format_unix_utc(secs: i64) -> String {
    // Days since epoch + seconds-of-day.
    let days = secs.div_euclid(86_400);
    let mut sod = secs.rem_euclid(86_400);
    let h = sod / 3600;
    sod %= 3600;
    let m = sod / 60;
    let s = sod % 60;
    // Civil-from-days (Howard Hinnant). Handles leap years correctly.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let mo = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if mo <= 2 { y + 1 } else { y };
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        y, mo, d, h, m, s
    )
}

/// Whether the file under `path` is tracked by the repo.
pub(super) fn _is_tracked(repo: &Repository, rel: &str) -> bool {
    repo.status_file(Path::new(rel))
        .map(|st| !st.contains(Status::WT_NEW) || !st.is_empty())
        .unwrap_or(false)
}

/// Workspace `dirty` flag — true if any markdown/text file is modified or
/// new since HEAD. We restrict the scan to `.md` / `.txt` to avoid being
/// dragged down by bulky `_assets/` directories.
pub(super) fn workspace_is_dirty(repo: &Repository) -> bool {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    let statuses = match repo.statuses(Some(&mut opts)) {
        Ok(s) => s,
        Err(_) => return false,
    };
    for entry in statuses.iter() {
        let p = entry.path().unwrap_or("");
        let lower = p.to_lowercase();
        if !(lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".txt")) {
            continue;
        }
        let st = entry.status();
        // Anything other than CURRENT means there's something to commit.
        if !st.is_empty() {
            return true;
        }
    }
    false
}

pub(super) fn write_default_gitignore(folder: &Path, exclude_assets: bool) -> std::io::Result<()> {
    let gi = folder.join(".gitignore");
    if gi.exists() {
        return Ok(());
    }
    let mut body = String::from(
        "# SoloMD AutoGit defaults\n\
         .DS_Store\n\
         Thumbs.db\n\
         desktop.ini\n\
         node_modules/\n\
         .obsidian/workspace*\n\
         .obsidian/cache\n\
         .vscode/\n\
         *.tmp\n\
         *~\n",
    );
    if exclude_assets {
        body.push_str("_assets/\n");
    }
    fs::write(gi, body)
}

/// Stage files under a pathspec. If `pathspec` is `None`, stages every
/// modification + every new untracked path. Otherwise, stages only that
/// single path (relative).
pub(super) fn stage(repo: &Repository, pathspec: Option<&str>) -> Result<(), String> {
    let mut index = repo.index().map_err(|e| format!("index: {}", e))?;
    if let Some(rel) = pathspec {
        // For deletions, `add_path` won't pick them up — fall back to
        // `update_all` first, then `add_path` for the live file.
        index
            .update_all([rel].iter(), None)
            .map_err(|e| format!("index update: {}", e))?;
        let abs = repo
            .workdir()
            .map(|w| w.join(rel))
            .unwrap_or_else(|| PathBuf::from(rel));
        if abs.exists() {
            index
                .add_path(Path::new(rel))
                .map_err(|e| format!("index add: {}", e))?;
        }
    } else {
        index
            .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
            .map_err(|e| format!("index add_all: {}", e))?;
    }
    index.write().map_err(|e| format!("index write: {}", e))?;
    Ok(())
}

/// Shared "create commit from staged tree" helper. Returns `None` if the
/// tree didn't change since HEAD.
pub(super) fn commit_staged(
    repo: &Repository,
    sig: &Signature<'_>,
    message: &str,
) -> Result<Option<String>, String> {
    let mut index = repo.index().map_err(|e| format!("index: {}", e))?;
    let tree_oid = index.write_tree().map_err(|e| format!("write_tree: {}", e))?;
    let tree = repo.find_tree(tree_oid).map_err(|e| format!("find_tree: {}", e))?;

    // Collect parents (we always have 0 or 1 — no merges in autogit).
    let parents: Vec<Commit<'_>> = match repo.head() {
        Ok(head) => {
            let oid = head.target().ok_or_else(|| "head has no target".to_string())?;
            // Skip the commit if the staged tree matches HEAD's tree exactly.
            let parent = repo.find_commit(oid).map_err(|e| format!("find HEAD: {}", e))?;
            if parent.tree_id() == tree_oid {
                return Ok(None);
            }
            vec![parent]
        }
        Err(_) => vec![], // unborn HEAD — first commit
    };
    let parent_refs: Vec<&Commit<'_>> = parents.iter().collect();
    let oid = repo
        .commit(Some("HEAD"), sig, sig, message, &tree, &parent_refs)
        .map_err(|e| format!("commit: {}", e))?;
    Ok(Some(oid.to_string()))
}
