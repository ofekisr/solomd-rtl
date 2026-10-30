//! Recent repositories and per-repo favorite branches.

use serde::Serialize;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

/// Mirrors `RecentRepository` in `shared/git/models.ts`.
#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentRepository {
    pub path: String,
    pub name: String,
    pub last_opened: i64,
}

pub fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn repo_name_from_path(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

/// Tolerant parse of our `recent-repos.json` (invalid → empty).
pub fn parse_recent_repos(json: &str) -> Vec<RecentRepository> {
    serde_json::from_str(json).unwrap_or_default()
}

/// Merge an opened repo to the front, dedupe by path, cap at 12.
pub fn merge_recent(
    existing: Vec<RecentRepository>,
    path: &str,
    now: i64,
) -> Vec<RecentRepository> {
    let mut merged = vec![RecentRepository {
        path: path.to_string(),
        name: repo_name_from_path(Path::new(path)),
        last_opened: now,
    }];
    merged.extend(existing.into_iter().filter(|r| r.path != path));
    merged.truncate(12);
    merged
}

/// Pinned-branch names per repository.
/// Stored as `{ "<repo_path>": ["<branch>", ...] }`.
pub type FavoritesMap = std::collections::HashMap<String, Vec<String>>;

/// Tolerant parse of our `favorites.json` (invalid → empty).
pub fn parse_favorites_file(json: &str) -> FavoritesMap {
    serde_json::from_str(json).unwrap_or_default()
}

pub fn favorite_names(map: &FavoritesMap, repo_path: &str) -> Vec<String> {
    map.get(repo_path).cloned().unwrap_or_default()
}

pub fn set_favorite_names(map: &mut FavoritesMap, repo_path: &str, names: &[String]) {
    map.insert(repo_path.to_string(), names.to_vec());
}
