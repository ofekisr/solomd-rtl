//! AutoGit per-note version history (v2.2).
//!
//! Inspired by Tolaria — every save snapshots the workspace into a local
//! git repo so users get unlimited undo + per-file history without having
//! to learn git. We use `git2` (libgit2 bindings) so there's no `git`
//! binary requirement on the user's machine.
//!
//! All commands take an absolute `folder` path; we open / init the repo at
//! that folder. Errors bubble up as `String` so they can render directly
//! in the toast layer.
//!
//! Tauri commands exported (registered in `lib.rs`):
//!   * `git_workspace_status`   — fast read-only check
//!   * `git_init_workspace`     — create the repo + initial commit
//!   * `git_auto_commit`        — debounced save snapshot
//!   * `git_file_history`       — log filtered by a single file
//!   * `git_file_diff`          — unified diff for one commit / file
//!   * `git_file_at_version`    — file content at a given commit
//!   * `git_rollback_file`      — overwrite working copy with old version

#[path = "git_history/helpers.rs"]
mod helpers;
#[path = "git_history/history.rs"]
mod history;
#[path = "git_history/version.rs"]
mod version;
#[path = "git_history/workspace.rs"]
mod workspace;

pub use history::git_file_history_inner;
pub use version::{git_file_at_version_inner, git_file_diff_inner, git_rollback_file_inner};
pub use workspace::{git_auto_commit_inner, git_init_workspace_inner, git_workspace_status_inner};

use serde::Serialize;

// ---------------------------------------------------------------------------
// Public types (mirrored on the TS side in `stores/gitHistory.ts`).
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct WorkspaceStatus {
    /// True iff the folder contains a `.git` and we could open it.
    pub initialized: bool,
    /// Full SHA of HEAD commit (if any).
    pub head_sha: Option<String>,
    /// First-line of HEAD commit message.
    pub head_message: Option<String>,
    /// True if any tracked file differs from HEAD or there are untracked
    /// `.md` / `.txt` files.
    pub dirty: bool,
    /// Current branch shorthand (e.g. `main`).
    pub branch: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CommitMeta {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    /// Seconds since UNIX epoch (UTC).
    pub time: i64,
}

#[derive(Debug, Serialize)]
pub struct DiffLine {
    /// One of `"context" | "add" | "remove"`.
    pub kind: String,
    pub text: String,
}

#[derive(Debug, Serialize)]
pub struct DiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Serialize)]
pub struct DiffResult {
    pub from_sha: Option<String>,
    pub to_sha: String,
    pub hunks: Vec<DiffHunk>,
    /// Standard unified-diff text (handy for raw display / copy).
    pub unified: String,
}

#[tauri::command]
pub async fn git_workspace_status(folder: String) -> Result<WorkspaceStatus, String> {
    tauri::async_runtime::spawn_blocking(move || git_workspace_status_inner(folder))
        .await
        .map_err(|e| format!("join: {e}"))?
}

#[tauri::command]
pub async fn git_init_workspace(
    folder: String,
    initial_message: Option<String>,
    exclude_assets: Option<bool>,
) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let _repo_guard = crate::git_pane::lock::RepoLocks::global()
        .acquire(std::path::Path::new(&folder))
        .await;
    tauri::async_runtime::spawn_blocking(move || {
        git_init_workspace_inner(folder, initial_message, exclude_assets)
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

#[tauri::command]
pub async fn git_auto_commit(
    app: tauri::AppHandle,
    folder: String,
    file_path: Option<String>,
    message: Option<String>,
) -> Result<Option<String>, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let _repo_guard = crate::git_pane::lock::RepoLocks::global()
        .acquire(std::path::Path::new(&folder))
        .await;
    let folder_for_dispatch = folder.clone();
    let file_for_dispatch = file_path.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        git_auto_commit_inner(folder, file_path, message)
    })
    .await
    .map_err(|e| format!("join: {e}"))??;

    // v4.0 Pillar 2 — fire on-commit recipe triggers when a real commit
    // landed (commit_staged returns None when the tree was unchanged).
    if let Some(sha) = result.clone() {
        let ws_path = std::path::PathBuf::from(&folder_for_dispatch);
        tauri::async_runtime::spawn(async move {
            super::recipe_runner::dispatch_on_commit(app, ws_path, file_for_dispatch, sha).await;
        });
    }
    Ok(result)
}

#[tauri::command]
pub async fn git_file_history(
    folder: String,
    file_path: String,
    limit: u32,
) -> Result<Vec<CommitMeta>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        git_file_history_inner(folder, file_path, limit)
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

#[tauri::command]
pub async fn git_file_diff(
    folder: String,
    file_path: String,
    sha: String,
) -> Result<DiffResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        git_file_diff_inner(folder, file_path, sha)
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

#[tauri::command]
pub async fn git_file_at_version(
    folder: String,
    file_path: String,
    sha: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        git_file_at_version_inner(folder, file_path, sha)
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

#[tauri::command]
pub async fn git_rollback_file(
    folder: String,
    file_path: String,
    sha: String,
) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let _repo_guard = crate::git_pane::lock::RepoLocks::global()
        .acquire(std::path::Path::new(&folder))
        .await;
    tauri::async_runtime::spawn_blocking(move || {
        git_rollback_file_inner(folder, file_path, sha)
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}
