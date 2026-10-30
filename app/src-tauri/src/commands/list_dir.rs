use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    /// Milliseconds since the Unix epoch. Only filled when the caller asks for
    /// times (the file tree sorted by date, #342); omitted otherwise so the
    /// default listing stays the stat-free scan described below.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub modified: Option<u64>,
    /// Creation (birth) time in ms since the epoch, where the platform and
    /// filesystem record one; otherwise the modification time, so "newest
    /// first" still orders sensibly on filesystems without birth times.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub created: Option<u64>,
}

fn epoch_ms(t: std::io::Result<std::time::SystemTime>) -> Option<u64> {
    t.ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

/// (modified, created) for one entry. `created` falls back to `modified`
/// when the platform has no birth time (older Linux kernels / filesystems).
pub fn entry_times(meta: &fs::Metadata) -> (Option<u64>, Option<u64>) {
    let modified = epoch_ms(meta.modified());
    let created = epoch_ms(meta.created()).or(modified);
    (modified, created)
}

/// List immediate children of a directory. Sorted: dirs first, then files,
/// both alphabetical.
///
/// Entries starting with `.` are filtered out unless `show_hidden` is set.
/// They were unconditionally skipped until a user pointed out that a vault
/// full of `.config`-style notes (or anyone wanting to see `.gitignore`) had
/// no way to reach them from inside the app at all.
///
/// Whether each child is a directory comes from `e.file_type()`, NOT
/// `e.metadata()`. On Windows the difference is enormous: `file_type()`
/// uses the cached info from the directory scan (one bulk
/// `FindFirstFile`/`FindNextFile` traversal), while `metadata()` triggers
/// a separate `GetFileInformationByHandle` syscall **per entry**. On a
/// folder with a few thousand notes that's the difference between
/// "instant" and "10 seconds with the antivirus also doing on-access
/// scanning". Reported by user 2026-04-26 as "on Windows, opening a directory with many
/// files is still somewhat laggy".
pub fn list_dir_inner(path: String, show_hidden: bool) -> Result<Vec<DirEntry>, String> {
    list_dir_with(path, show_hidden, false)
}

/// `with_times` stats every entry for its modified/created time. It is off
/// for the normal listing (see above for why metadata() is avoided) and on
/// only when the tree is sorted by date (#342).
pub fn list_dir_with(path: String, show_hidden: bool, with_times: bool) -> Result<Vec<DirEntry>, String> {
    let read = fs::read_dir(&path).map_err(|e| format!("read_dir failed: {e}"))?;
    const HARD_CAP: usize = 10_000;
    let mut entries: Vec<DirEntry> = Vec::new();
    let mut truncated = false;
    for e in read.flatten() {
        if entries.len() >= HARD_CAP {
            truncated = true;
            break;
        }
        let name = e.file_name().to_string_lossy().to_string();
        if !show_hidden && name.starts_with('.') {
            continue;
        }
        // file_type() uses the dir-scan's cached entry type — no extra
        // syscall. metadata() on Windows would re-stat each entry. Falls
        // back gracefully for symlinks/reparse points whose type can't
        // be determined cheaply: skip them rather than block.
        let is_dir = match e.file_type() {
            Ok(t) => t.is_dir(),
            Err(_) => continue,
        };
        let (modified, created) = if with_times {
            match e.metadata() {
                Ok(m) => entry_times(&m),
                Err(_) => (None, None),
            }
        } else {
            (None, None)
        };
        entries.push(DirEntry {
            name,
            path: e.path().to_string_lossy().to_string(),
            is_dir,
            modified,
            created,
        });
    }
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    if truncated {
        // Surface truncation as a sentinel last entry so the UI can show
        // a "+N more, refine your folder layout" hint without needing a
        // second IPC call. The frontend filters this entry by its
        // distinctive name + is_dir=false signature.
        entries.push(DirEntry {
            name: "__solomd_truncated__".into(),
            path: String::new(),
            is_dir: false,
            modified: None,
            created: None,
        });
    }
    Ok(entries)
}

/// Async wrapper. `fs::read_dir` + per-entry `metadata()` can take seconds on
/// Windows (network drives, OneDrive placeholders, antivirus scanning) and
/// the previous *synchronous* `#[tauri::command]` blocked the main thread —
/// long enough for Win11 to flag the app as unresponsive and kill it
/// (reproduced as "toggle file tree → app crashes" on Win11). Same fix as
/// git_history: hand off to the blocking pool.
#[tauri::command]
pub async fn list_dir(
    path: String,
    show_hidden: Option<bool>,
    with_times: Option<bool>,
) -> Result<Vec<DirEntry>, String> {
    let show_hidden = show_hidden.unwrap_or(false);
    let with_times = with_times.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || list_dir_with(path, show_hidden, with_times))
        .await
        .map_err(|e| format!("join: {e}"))?
}

#[cfg(test)]
mod list_dir_times_tests {
    use super::*;
    use super::super::fs_ops::fs_file_exists;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    fn now_ms() -> u64 {
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64
    }

    #[test]
    fn times_only_when_asked() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.md"), "a").unwrap();
        let p = dir.path().to_string_lossy().to_string();

        let plain = list_dir_with(p.clone(), false, false).unwrap();
        assert_eq!(plain.len(), 1);
        assert!(plain[0].modified.is_none() && plain[0].created.is_none());

        let timed = list_dir_with(p, false, true).unwrap();
        let m = timed[0].modified.expect("modified");
        let c = timed[0].created.expect("created (or modified fallback)");
        let now = now_ms();
        assert!(m <= now + 1_000 && now - m < 60_000, "modified {m} vs now {now}");
        assert!(c <= now + 1_000 && now - c < 60_000, "created {c} vs now {now}");
    }

    #[test]
    fn modified_tracks_later_writes() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.md");
        let new = dir.path().join("new.md");
        fs::write(&old, "o").unwrap();
        fs::write(&new, "n").unwrap();
        // Push old.md's mtime back an hour so the order can't be a tie.
        let hour_ago = SystemTime::now() - Duration::from_secs(3600);
        fs::File::options().write(true).open(&old).unwrap().set_modified(hour_ago).unwrap();
        let entries = list_dir_with(dir.path().to_string_lossy().to_string(), false, true).unwrap();
        let get = |n: &str| entries.iter().find(|e| e.name == n).unwrap().modified.unwrap();
        assert!(get("new.md") > get("old.md") + 3_000_000);
    }

    #[test]
    fn serialization_omits_absent_times() {
        let e = DirEntry { name: "x".into(), path: "/x".into(), is_dir: false, modified: None, created: None };
        let json = serde_json::to_string(&e).unwrap();
        assert!(!json.contains("modified") && !json.contains("created"), "{json}");
    }

    #[test]
    fn fs_file_exists_distinguishes_files_and_dirs() {
        let dir = std::env::temp_dir().join("solomd_fs_file_exists_test");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("a.mmap");
        std::fs::write(&file, "{}").unwrap();
        assert!(fs_file_exists(file.to_string_lossy().into_owned()));
        assert!(!fs_file_exists(dir.to_string_lossy().into_owned()));
        assert!(!fs_file_exists(dir.join("missing.mmap").to_string_lossy().into_owned()));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
