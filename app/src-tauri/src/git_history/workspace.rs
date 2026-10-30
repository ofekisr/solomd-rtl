//! Workspace status, init and auto-commit (sync impls).

use std::path::Path;

use git2::Repository;

use super::helpers::*;
use super::WorkspaceStatus;

/// Sync impl. Public command below dispatches to spawn_blocking — never
/// call this directly from a Tauri command thread, only through the async
/// wrapper, so a slow git2 call can't freeze the UI.
pub fn git_workspace_status_inner(folder: String) -> Result<WorkspaceStatus, String> {
    if folder.is_empty() {
        return Ok(WorkspaceStatus {
            initialized: false,
            head_sha: None,
            head_message: None,
            dirty: false,
            branch: None,
        });
    }
    let repo = match Repository::open(Path::new(&folder)) {
        Ok(r) => r,
        Err(_) => {
            return Ok(WorkspaceStatus {
                initialized: false,
                head_sha: None,
                head_message: None,
                dirty: false,
                branch: None,
            });
        }
    };
    let (head_sha, head_message) = match repo.head() {
        Ok(h) => match h.peel_to_commit() {
            Ok(c) => {
                let msg = c
                    .summary()
                    .map(|s| s.to_string())
                    .unwrap_or_default();
                (Some(c.id().to_string()), Some(msg))
            }
            Err(_) => (None, None),
        },
        Err(_) => (None, None),
    };
    let branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));
    Ok(WorkspaceStatus {
        initialized: true,
        head_sha,
        head_message,
        dirty: workspace_is_dirty(&repo),
        branch,
    })
}

pub fn git_init_workspace_inner(
    folder: String,
    initial_message: Option<String>,
    exclude_assets: Option<bool>,
) -> Result<(), String> {
    let path = Path::new(&folder);
    if !path.exists() {
        // Auto-create the workspace folder if the parent is reachable.
        // Common case: user typed / pasted a path one level below an
        // existing dir; the dialog "New folder" flow can also leave the
        // leaf uncreated. Refusing to init here meant the user had to
        // mkdir it manually outside the app.
        std::fs::create_dir_all(path)
            .map_err(|e| format!("create workspace folder: {} ({e})", folder))?;
    } else if !path.is_dir() {
        return Err(format!("not a folder: {}", folder));
    }
    let repo = match Repository::open(path) {
        Ok(r) => r,
        Err(_) => Repository::init(path).map_err(|e| format!("git init: {}", e))?,
    };

    write_default_gitignore(path, exclude_assets.unwrap_or(false))
        .map_err(|e| format!("gitignore: {}", e))?;

    stage(&repo, None)?;
    let sig = build_signature(&repo)?;
    let msg = initial_message.unwrap_or_else(|| "init: SoloMD workspace".to_string());

    let _ = commit_staged(&repo, &sig, &msg)?;
    Ok(())
}

pub fn git_auto_commit_inner(
    folder: String,
    file_path: Option<String>,
    message: Option<String>,
) -> Result<Option<String>, String> {
    let repo = open_repo(&folder)?;
    let pathspec = match file_path.as_ref() {
        Some(abs) => match rel_path(&repo, abs) {
            Some(r) => Some(r),
            None => return Err(format!("file is outside workspace: {}", abs)),
        },
        None => None,
    };
    stage(&repo, pathspec.as_deref())?;

    let sig = build_signature(&repo)?;
    let msg = message.unwrap_or_else(default_auto_message);
    commit_staged(&repo, &sig, &msg)
}
