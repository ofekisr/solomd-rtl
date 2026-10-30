// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;

use super::journal::is_undo_redo_safe;
use super::route_ctx::RouteCtx;

pub(super) async fn route(ctx: &RouteCtx<'_>) -> Result<String, GitError> {
    let RouteCtx { kind, cwd, journal, repo_state, .. } = *ctx;
    match kind {
        "refresh" => Ok("Repository refreshed".to_string()),
        "undo" => {
            if !is_undo_redo_safe(repo_state) {
                return Err(GitError::unknown(
                    "Cannot undo while an operation is in progress.".to_string(),
                ));
            }
            journal.lock().await.undo(cwd).await
        }
        "redo" => {
            if !is_undo_redo_safe(repo_state) {
                return Err(GitError::unknown(
                    "Cannot redo while an operation is in progress.".to_string(),
                ));
            }
            journal.lock().await.redo(cwd).await
        }
        "open-terminal" | "reveal-in-finder" | "open-remote" | "copy-sha" | "open-on-github" => {
            Ok("Handled in renderer".to_string())
        }
        _ => Err(GitError::unknown(format!("Unsupported action: {kind}"))),
    }
}
