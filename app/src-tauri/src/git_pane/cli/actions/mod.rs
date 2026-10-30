// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

mod args;
mod classify;
mod envelope;
mod journal;
mod rebase_bundle;
mod route_ctx;
mod routes_branch;
mod routes_commit;
mod routes_conflicts;
mod routes_history;
mod routes_misc;
mod routes_remote;
mod routes_stage;
mod routes_stash;
mod routes_tags;
mod run;
#[cfg(test)]
mod tests;

use std::path::Path;

use tokio::sync::watch;

use crate::git_pane::cli::git::{GitError, RepoState};
use crate::git_pane::cli::refs::read_repo_state;

pub use args::*;
pub use envelope::*;
pub use journal::*;
#[allow(unused_imports)]
pub use classify::*;
#[allow(unused_imports)]
pub use rebase_bundle::*;
pub use run::*;

use route_ctx::RouteCtx;

/// Full execute flow: journal checkpoint, route, push-undo, progress.
/// Mirrors `GitProvider.execute`.
#[allow(clippy::too_many_arguments)]
pub async fn execute_action(
    operation_id: &str,
    cwd: &Path,
    git_dir: &Path,
    kind: &str,
    target: Option<&str>,
    meta: &serde_json::Value,
    journal: &tokio::sync::Mutex<Journal>,
    ops: &tokio::sync::Mutex<Operations>,
    emit: &(dyn Fn(&str, Option<u32>, bool) + Send + Sync),
) -> ActionEnvelope {
    let cancel_rx = ops.lock().await.register(operation_id);
    let repo_state = read_repo_state(git_dir);

    let squash_merge = kind == "merge"
        && meta
            .get("squash")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
    let capture_kind = if squash_merge {
        None
    } else {
        journal_capture_for(kind)
    };
    let mut checkpoint = None;
    if let Some(cap) = capture_kind {
        if let Ok(mut cp) = journal.lock().await.capture(cwd, &cap).await {
            match kind {
                "reset-soft" => cp.reset_mode = Some("soft".to_string()),
                "reset-mixed" => cp.reset_mode = Some("mixed".to_string()),
                "reset-hard" => cp.reset_mode = Some("hard".to_string()),
                _ => {}
            }
            checkpoint = Some(cp);
        }
    }

    emit("Starting…", Some(0), false);
    let progress_cb = |phase: &str| emit(phase, None, false);
    let command_log = std::sync::Mutex::new(Vec::<ExecutedGitCommand>::new());
    let result = route_action(
        cwd,
        kind,
        target,
        meta,
        journal,
        &cancel_rx,
        &progress_cb,
        &repo_state,
        &command_log,
    )
    .await;
    ops.lock().await.unregister(operation_id);
    let commands = command_log.into_inner().unwrap_or_default();

    match result {
        Ok(message) => {
            if let Some(cp) = checkpoint {
                if is_journalable_action(kind) {
                    let label =
                        journal_label(kind, target, meta.get("name").and_then(|v| v.as_str()));
                    journal.lock().await.push_undo(cp, label);
                }
            }
            emit("Done", Some(100), true);
            ActionEnvelope::ok(message).with_commands(commands)
        }
        Err(error) => {
            emit("Done", Some(100), true);
            ActionEnvelope::err(error).with_commands(commands)
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn route_action(
    cwd: &Path,
    kind: &str,
    target: Option<&str>,
    meta: &serde_json::Value,
    journal: &tokio::sync::Mutex<Journal>,
    cancel: &watch::Receiver<()>,
    on_progress: &(dyn Fn(&str) + Send + Sync),
    repo_state: &RepoState,
    command_log: &std::sync::Mutex<Vec<ExecutedGitCommand>>,
) -> Result<String, GitError> {
    let ctx = RouteCtx {
        cwd,
        kind,
        target,
        meta,
        journal,
        cancel,
        on_progress,
        repo_state,
        command_log,
    };

    // Semantic validation (argv arrays already prevent shell injection, but
    // a value like `-h` would still be parsed as a flag by git itself).
    // Ref-like targets are validated per-kind below via `checked_target`;
    // here we reject obviously dangerous targets early for the ref family.
    if let Some(target) = target {
        let ref_kinds = [
            "checkout",
            "merge",
            "rebase",
            "cherry-pick",
            "reset-soft",
            "reset-mixed",
            "reset-hard",
            "revert",
            "create-branch",
            "rename-branch",
            "delete-branch",
            "force-delete-branch",
            "set-upstream",
            "delete-tag",
            "create-tag",
            "bisect-good",
            "bisect-bad",
        ];
        if ref_kinds.contains(&kind) {
            reject_option_like(target.trim(), "target")?;
        }
        if kind == "stage-patch" || kind == "discard-patch" {
            let patch = meta.get("patch").and_then(|v| v.as_str()).unwrap_or("");
            if !patch.starts_with("diff --git") || patch.contains('\0') {
                return Err(GitError::unknown("Invalid patch.".to_string()));
            }
        }
    }

    match kind {
        "fetch"
        | "fetch-all"
        | "pull"
        | "push"
        | "force-push"
        | "push-tags"
        | "prune"
        | "sync" => routes_remote::route(&ctx).await,
        "stash"
        | "pop-stash"
        | "apply-stash"
        | "drop-stash"
        | "rename-stash" => routes_stash::route(&ctx).await,
        "stage"
        | "unstage"
        | "stage-all"
        | "unstage-all"
        | "discard-file"
        | "discard-all"
        | "restore-file"
        | "stage-patch" | "unstage-patch"
        | "discard-patch" => routes_stage::route(&ctx).await,
        "resolve-conflict-ours" | "resolve-conflict-theirs"
        | "resolve-conflict-block"
        | "mark-conflict-resolved" => routes_conflicts::route(&ctx).await,
        "commit"
        | "amend"
        | "commit-and-push" | "commit-and-force-push" => routes_commit::route(&ctx).await,
        "checkout"
        | "checkout-commit"
        | "create-branch"
        | "rename-branch"
        | "delete-branch"
        | "delete-remote-branch"
        | "set-upstream"
        | "compare-branches"
        | "worktree-add"
        | "worktree-remove"
        | "lfs-track"
        | "lfs-untrack"
        | "lfs-prune" => routes_branch::route(&ctx).await,
        "merge"
        | "merge-continue"
        | "merge-abort"
        | "rebase"
        | "rebase-from-here"
        | "interactive-rebase"
        | "rebase-continue"
        | "rebase-abort"
        | "rebase-skip"
        | "cherry-pick"
        | "cherry-pick-continue"
        | "cherry-pick-abort"
        | "bisect-start"
        | "bisect-good"
        | "bisect-bad"
        | "bisect-skip"
        | "bisect-reset"
        | "reset-soft"
        | "reset-mixed"
        | "reset-hard"
        | "revert"
        | "revert-continue"
        | "revert-abort" => routes_history::route(&ctx).await,
        "create-tag" | "tag"
        | "delete-tag"
        | "checkout-tag" => routes_tags::route(&ctx).await,
        "refresh"
        | "undo"
        | "redo"
        | "open-terminal" | "reveal-in-finder" | "open-remote" | "copy-sha" | "open-on-github" => routes_misc::route(&ctx).await,
        _ => Err(GitError::unknown(format!("Unsupported action: {kind}"))),
    }
}
