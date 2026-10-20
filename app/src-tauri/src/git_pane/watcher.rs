use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const DEBOUNCE_MS: u64 = 300;
const WATCHED: [&str; 3] = ["HEAD", "index", "refs"];
pub const CHANGED_EVENT: &str = "gitpane:changed";

#[derive(serde::Serialize, Clone)]
struct ChangedPayload {
    path: String,
}

pub struct RepoWatcher {
    debouncer: Debouncer<notify::RecommendedWatcher>,
    root: PathBuf,
}

impl RepoWatcher {
    pub fn start(app: AppHandle, root: &Path, git_dir: &Path) -> Option<Self> {
        let payload = ChangedPayload { path: root.to_string_lossy().into_owned() };
        let mut debouncer =
            new_debouncer(Duration::from_millis(DEBOUNCE_MS), move |res: DebounceEventResult| {
                if res.map(|events| !events.is_empty()).unwrap_or(false) {
                    let _ = app.emit(CHANGED_EVENT, payload.clone());
                }
            })
            .ok()?;
        for name in WATCHED {
            let target = git_dir.join(name);
            let mode = if target.is_dir() {
                notify::RecursiveMode::Recursive
            } else {
                notify::RecursiveMode::NonRecursive
            };
            let _ = debouncer.watcher().watch(&target, mode);
        }
        Some(Self { debouncer, root: root.to_path_buf() })
    }

    pub fn root(&self) -> &Path {
        let _ = &self.debouncer;
        &self.root
    }
}
