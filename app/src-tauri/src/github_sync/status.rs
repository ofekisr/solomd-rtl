use super::*;

// ---------------------------------------------------------------------------
// Status, push, pull
// ---------------------------------------------------------------------------

#[derive(Serialize, Default)]
pub struct SyncStatus {
    pub linked: bool,
    pub remote_url: String,
    pub auto_push: bool,
    pub auto_pull_minutes: u32,
    pub encrypted: bool,
    pub provider: String,
    pub ahead: usize,
    pub behind: usize,
    pub dirty: bool,
    pub has_conflicts: bool,
    pub conflicts: Vec<String>,
    pub last_push_at: Option<i64>,
    pub last_pull_at: Option<i64>,
}

#[tauri::command]
pub async fn github_sync_status(folder: String) -> Result<SyncStatus, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<SyncStatus, String> {
        let path = PathBuf::from(&folder);
        let cfg = load_config(&path)?.unwrap_or_default();
        let mut status = SyncStatus {
            linked: !cfg.remote_url.is_empty(),
            remote_url: cfg.remote_url.clone(),
            auto_push: cfg.auto_push,
            auto_pull_minutes: cfg.auto_pull_minutes,
            encrypted: cfg.encrypted,
            provider: cfg.provider.clone(),
            last_push_at: cfg.last_push_at,
            last_pull_at: cfg.last_pull_at,
            ..Default::default()
        };
        if !status.linked {
            return Ok(status);
        }
        let repo_dir = git_dir(&path)?;
        let repo = match Repository::open(&repo_dir) {
            Ok(r) => r,
            // Repo was deleted but config remained — degrade gracefully
            // rather than 500-ing the entire UI.
            Err(_) => return Ok(status),
        };

        // Dirty = uncommitted working-tree changes.
        if let Ok(statuses) = repo.statuses(None) {
            status.dirty = statuses
                .iter()
                .any(|e| !e.status().is_ignored() && !e.status().is_empty());
        }

        // Ahead / behind counts vs origin/<head>. Quietly skip if origin
        // hasn't been fetched yet.
        if let (Ok(local), Ok(upstream)) = (
            repo.head().and_then(|h| h.peel_to_commit()),
            repo.find_branch("origin/main", git2::BranchType::Remote)
                .or_else(|_| repo.find_branch("origin/master", git2::BranchType::Remote))
                .and_then(|b| b.get().peel_to_commit()),
        ) {
            if let Ok((a, b)) = repo.graph_ahead_behind(local.id(), upstream.id()) {
                status.ahead = a;
                status.behind = b;
            }
        }

        // Surface any unresolved conflicts (paths with merge markers).
        if let Ok(index) = repo.index() {
            if index.has_conflicts() {
                status.has_conflicts = true;
                status.conflicts = index
                    .conflicts()
                    .into_iter()
                    .flatten()
                    .filter_map(|c| c.ok())
                    .filter_map(|c| {
                        c.our
                            .as_ref()
                            .or(c.their.as_ref())
                            .or(c.ancestor.as_ref())
                            .map(|e| String::from_utf8_lossy(&e.path).to_string())
                    })
                    .collect();
            }
        }

        Ok(status)
    })
    .await
    .map_err(|e| e.to_string())?
}
