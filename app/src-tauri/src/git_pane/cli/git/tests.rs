use std::path::{Path, PathBuf};
use super::*;
use std::collections::{HashMap, HashSet};

#[test]
fn favorites_roundtrip_per_repo() {
    let map = parse_favorites_file(r#" {"/repo": ["main", "feat"]} "#);
    assert_eq!(
        favorite_names(&map, "/repo"),
        ["main".to_string(), "feat".to_string()]
    );
    assert!(favorite_names(&map, "/other").is_empty());
    assert!(parse_favorites_file("nope").is_empty());
}

#[test]
fn favorites_set_replaces_names() {
    let mut map = HashMap::new();
    set_favorite_names(&mut map, "/repo", &["a".to_string(), "b".to_string()]);
    set_favorite_names(&mut map, "/repo", &["c".to_string()]);
    assert_eq!(favorite_names(&map, "/repo"), ["c".to_string()]);
}

fn fixture_repo() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

/// Hermetic repo with `main` checked out plus a `side` branch.
/// Snapshot tests must not depend on the ambient checkout: tag builds
/// (detached HEAD, no local branches) broke the fixture-based versions.
async fn temp_repo() -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().expect("tempdir");
    let cwd = dir.path().to_path_buf();
    for args in [
        vec!["init", "-b", "main"],
        vec!["config", "user.email", "t@t"],
        vec!["config", "user.name", "t"],
        vec!["config", "core.autocrlf", "false"],
    ] {
        let argv: Vec<&str> = args.iter().map(|s| *s).collect();
        let (ok, _, err) = git_text(&cwd, &argv).await.expect("git spawn");
        assert!(ok, "git {argv:?} failed: {err}");
    }
    std::fs::write(cwd.join("a.txt"), "one\n").unwrap();
    for args in [
        vec!["add", "-A"],
        vec!["commit", "-m", "first"],
        vec!["branch", "side"],
    ] {
        let argv: Vec<&str> = args.iter().map(|s| *s).collect();
        let (ok, _, err) = git_text(&cwd, &argv).await.expect("git spawn");
        assert!(ok, "git {argv:?} failed: {err}");
    }
    (dir, cwd)
}

/// Path-based snapshot used by the tests. The app resolves `RepoInfo`
/// itself (and caches it), so this two-step form is its only caller.
async fn build_snapshot(
    path: &Path,
    opts: &SnapshotOptions,
    favorites: &std::collections::HashSet<String>,
) -> Result<WireSnapshot, GitError> {
    let info = validate_repo(path).await?;
    build_snapshot_with_info(&info, opts, favorites).await
}

#[tokio::test]
async fn validates_real_repo() {
    let info = validate_repo(&fixture_repo())
        .await
        .expect("fixture must be a git repo");
    assert!(info.git_dir.ends_with(".git"));
    assert!(!info.path.file_name().unwrap().is_empty());
}

#[tokio::test]
async fn rejects_non_repo() {
    // `/tmp` does not exist on Windows (canonicalize fails with
    // `RepositoryNotFound`). Use a guaranteed-existing,
    // guaranteed-not-a-repo directory instead.
    let dir = tempfile::tempdir().expect("tempdir");
    let err = validate_repo(dir.path()).await.expect_err("must fail");
    assert_eq!(err.code, "NotARepository");
}

#[tokio::test]
async fn rejects_missing_path() {
    let err = validate_repo(Path::new("/definitely/not/here"))
        .await
        .expect_err("must fail");
    assert_eq!(err.code, "RepositoryNotFound");
}

#[tokio::test]
async fn full_snapshot_lists_branches_and_remotes() {
    let (_dir, cwd) = temp_repo().await;
    let opts = SnapshotOptions {
        commit_limit: 10,
        graph_all: true,
        with_commits: true,
        with_branches: true,
        with_tags: true,
        with_stashes: true,
        with_worktrees: true,
        with_status: true,
    };
    let snap = build_snapshot(&cwd, &opts, &std::collections::HashSet::new())
        .await
        .expect("full snapshot must work");
    assert!(!snap.commits.is_empty());
    assert!(
        snap.branches.iter().any(|b| b.is_current),
        "must flag current branch"
    );
    assert!(snap
        .repository
        .remotes
        .iter()
        .all(|r| !r.fetch_url.is_empty() || !r.push_url.is_empty()));
}

#[tokio::test]
async fn snapshot_marks_favorite_branches() {
    let (_dir, cwd) = temp_repo().await;
    let favs: HashSet<String> = ["main".to_string()].into_iter().collect();
    let opts = SnapshotOptions {
        commit_limit: 1,
        graph_all: true,
        with_commits: false,
        with_branches: true,
        with_tags: false,
        with_stashes: false,
        with_worktrees: false,
        with_status: false,
    };
    let snap = build_snapshot(&cwd, &opts, &favs)
        .await
        .expect("snapshot must work");
    let main = snap
        .branches
        .iter()
        .find(|b| b.name == "main")
        .expect("main branch");
    assert!(main.is_favorite);
    assert!(snap
        .branches
        .iter()
        .filter(|b| b.name != "main")
        .all(|b| !b.is_favorite));
}

#[tokio::test]
async fn minimal_snapshot_reads_head() {
    let snap = build_snapshot(
        &fixture_repo(),
        &SnapshotOptions::empty_lists(),
        &std::collections::HashSet::new(),
    )
    .await
    .expect("snapshot must work");
    assert!(!snap.repository.name.is_empty());
    assert_eq!(snap.repository.head_sha.len(), 40);
    assert!(!snap.repository.current_branch.is_empty());
    assert!(snap.commits.is_empty());
    assert!(snap.page.has_more == false);
}

#[test]
fn recents_parse_tolerant() {
    assert!(parse_recent_repos("nope").is_empty());
    assert!(parse_recent_repos("[]").is_empty());
    let list = parse_recent_repos(r#"[{"path":"/a","name":"a","lastOpened":5}]"#);
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].last_opened, 5);
}

#[test]
fn recents_merge_dedupes_and_caps() {
    let existing: Vec<RecentRepository> = (0..12)
        .map(|i| RecentRepository {
            path: format!("/r{i}"),
            name: format!("r{i}"),
            last_opened: i as i64,
        })
        .collect();
    let merged = merge_recent(existing, "/r5", 99);
    assert_eq!(merged.len(), 12);
    assert_eq!(merged[0].path, "/r5");
    assert_eq!(merged[0].last_opened, 99);
    assert_eq!(merged.iter().filter(|r| r.path == "/r5").count(), 1);
}

#[tokio::test]
async fn snapshot_serializes_to_wire_camel_case() {
    let snap = build_snapshot(
        &fixture_repo(),
        &SnapshotOptions::empty_lists(),
        &std::collections::HashSet::new(),
    )
    .await
    .expect("snapshot must work");
    let v = serde_json::to_value(&snap).expect("serializable");
    let repo = &v["repository"];
    assert!(!repo["name"].as_str().unwrap_or_default().is_empty());
    assert!(repo.get("currentBranch").is_some(), "missing currentBranch");
    assert!(repo.get("headSha").is_some(), "missing headSha");
    assert!(repo.get("gitVersion").is_some(), "missing gitVersion");
    assert!(v.get("commitAuthor").is_some(), "missing commitAuthor");
    assert!(v.get("workingTree").is_some(), "missing workingTree");
    assert!(v.get("oldestSha").is_none(), "leaked snake_case page key");
}
