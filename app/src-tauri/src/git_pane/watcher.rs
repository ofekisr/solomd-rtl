use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use std::path::{Path, PathBuf};
use std::time::Duration;

const DEBOUNCE_MS: u64 = 300;
const GIT_DIR_FILES: [&str; 3] = ["HEAD", "index", "packed-refs"];
const REFS_DIR: &str = "refs";
const LOCK_SUFFIX: &str = ".lock";
pub const CHANGED_EVENT: &str = "gitpane:changed";

pub struct RepoWatcher {
    _debouncer: Debouncer<notify::RecommendedWatcher>,
}

fn is_lock(path: &Path) -> bool {
    path.to_string_lossy().ends_with(LOCK_SUFFIX)
}

fn is_relevant(path: &Path, git_dirs: &[PathBuf], refs_dir: &Path) -> bool {
    if is_lock(path) {
        return false;
    }
    if path.starts_with(refs_dir) {
        return true;
    }
    let in_git_dir = path.parent().is_some_and(|p| git_dirs.iter().any(|d| d == p));
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    in_git_dir && GIT_DIR_FILES.contains(&name)
}

fn canonical(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

impl RepoWatcher {
    /// HEAD/index/packed-refs are replaced via `*.lock` renames, which kills an
    /// inode watch on the file itself; so the containing directory is watched.
    /// `common_dir` differs from `git_dir` in linked worktrees (refs live there).
    pub fn start(
        on_change: impl Fn() + Send + 'static,
        git_dir: &Path,
        common_dir: &Path,
    ) -> Option<Self> {
        let git_dir = canonical(git_dir);
        let common_dir = canonical(common_dir);
        let refs_dir = common_dir.join(REFS_DIR);
        let mut git_dirs = vec![git_dir.clone()];
        if common_dir != git_dir {
            git_dirs.push(common_dir.clone());
        }
        let filter_dirs = git_dirs.clone();
        let filter_refs = refs_dir.clone();
        let mut debouncer =
            new_debouncer(Duration::from_millis(DEBOUNCE_MS), move |res: DebounceEventResult| {
                let is_relevant_batch = res
                    .map(|events| events.iter().any(|e| is_relevant(&e.path, &filter_dirs, &filter_refs)))
                    .unwrap_or(false);
                if is_relevant_batch {
                    on_change();
                }
            })
            .ok()?;
        for dir in &git_dirs {
            let _ = debouncer.watcher().watch(dir, notify::RecursiveMode::NonRecursive);
        }
        let _ = debouncer.watcher().watch(&refs_dir, notify::RecursiveMode::Recursive);
        Some(Self { _debouncer: debouncer })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    const WAIT: Duration = Duration::from_secs(10);
    const SETTLE: Duration = Duration::from_millis(1200);

    fn git(dir: &Path, args: &[&str]) {
        let out = std::process::Command::new("git").args(args).current_dir(dir).output().unwrap();
        assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
    }

    #[test]
    fn keeps_firing_after_head_and_index_are_replaced() {
        let dir = tempfile::tempdir().unwrap();
        let root = canonical(dir.path());
        git(&root, &["init", "-q", "-b", "main"]);
        git(&root, &["config", "user.email", "t@example.com"]);
        git(&root, &["config", "user.name", "T"]);
        git(&root, &["commit", "-q", "--allow-empty", "-m", "c0"]);
        let (tx, rx) = mpsc::channel();
        let git_dir = root.join(".git");
        let _watcher = RepoWatcher::start(move || { let _ = tx.send(()); }, &git_dir, &git_dir).unwrap();
        std::thread::sleep(SETTLE);
        git(&root, &["checkout", "-q", "-b", "x"]);
        rx.recv_timeout(WAIT).expect("first change");
        std::thread::sleep(SETTLE);
        while rx.try_recv().is_ok() {}
        std::fs::write(root.join("a.md"), "a").unwrap();
        git(&root, &["add", "a.md"]);
        rx.recv_timeout(WAIT).expect("index change after HEAD change");
        std::thread::sleep(SETTLE);
        while rx.try_recv().is_ok() {}
        git(&root, &["checkout", "-q", "-b", "y"]);
        rx.recv_timeout(WAIT).expect("second HEAD change");
    }

    #[test]
    fn ignores_lock_files() {
        let dirs = vec![PathBuf::from("/r/.git")];
        let refs = PathBuf::from("/r/.git/refs");
        assert!(!is_relevant(Path::new("/r/.git/index.lock"), &dirs, &refs));
        assert!(!is_relevant(Path::new("/r/.git/refs/heads/x.lock"), &dirs, &refs));
        assert!(is_relevant(Path::new("/r/.git/HEAD"), &dirs, &refs));
        assert!(is_relevant(Path::new("/r/.git/refs/heads/x"), &dirs, &refs));
        assert!(!is_relevant(Path::new("/r/.git/config"), &dirs, &refs));
    }
}
