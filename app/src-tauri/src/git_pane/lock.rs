use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

#[derive(Default)]
pub struct RepoLocks {
    by_root: Mutex<HashMap<PathBuf, Arc<tokio::sync::Mutex<()>>>>,
}

static LOCKS: OnceLock<RepoLocks> = OnceLock::new();

impl RepoLocks {
    pub fn global() -> &'static RepoLocks {
        LOCKS.get_or_init(RepoLocks::default)
    }

    pub async fn acquire(&self, path: &Path) -> tokio::sync::OwnedMutexGuard<()> {
        let key = find_repo_root(path).unwrap_or_else(|| path.to_path_buf());
        let mutex = {
            let mut map = self.by_root.lock().unwrap_or_else(|e| e.into_inner());
            map.entry(key).or_default().clone()
        };
        mutex.lock_owned().await
    }
}

pub fn find_repo_root(start: &Path) -> Option<PathBuf> {
    let canonical = start.canonicalize().ok()?;
    canonical
        .ancestors()
        .find(|dir| dir.join(".git").exists())
        .map(Path::to_path_buf)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    #[test]
    fn finds_root_from_nested_dir() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".git")).unwrap();
        std::fs::create_dir_all(dir.path().join("notes/deep")).unwrap();
        let root = find_repo_root(&dir.path().join("notes/deep")).unwrap();
        assert_eq!(root, dir.path().canonicalize().unwrap());
    }

    #[test]
    fn no_root_outside_repo() {
        let dir = tempfile::tempdir().unwrap();
        assert!(find_repo_root(dir.path()).is_none());
    }

    #[tokio::test]
    async fn same_repo_is_serialised() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".git")).unwrap();
        let locks = Arc::new(RepoLocks::default());
        let inside = Arc::new(AtomicUsize::new(0));
        let max_seen = Arc::new(AtomicUsize::new(0));
        let mut handles = Vec::new();
        for _ in 0..8 {
            let (locks, inside, max_seen, path) =
                (locks.clone(), inside.clone(), max_seen.clone(), dir.path().to_path_buf());
            handles.push(tokio::spawn(async move {
                let _guard = locks.acquire(&path).await;
                let now = inside.fetch_add(1, Ordering::SeqCst) + 1;
                max_seen.fetch_max(now, Ordering::SeqCst);
                tokio::time::sleep(std::time::Duration::from_millis(5)).await;
                inside.fetch_sub(1, Ordering::SeqCst);
            }));
        }
        for handle in handles {
            handle.await.unwrap();
        }
        assert_eq!(max_seen.load(Ordering::SeqCst), 1);
    }
}
