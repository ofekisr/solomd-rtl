use super::cli::git::SnapshotOptions;
use super::engine::{CliEngine, GitEngine};
use std::path::Path;

fn git(dir: &Path, args: &[&str]) {
    let out = std::process::Command::new("git").args(args).current_dir(dir).output().unwrap();
    assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
}

fn repo_with_commits(count: usize) -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    git(dir.path(), &["init", "-q", "-b", "main"]);
    git(dir.path(), &["config", "user.email", "t@example.com"]);
    git(dir.path(), &["config", "user.name", "Tester"]);
    git(dir.path(), &["config", "commit.gpgsign", "false"]);
    for i in 0..count {
        std::fs::write(dir.path().join("a.md"), format!("line {i}\n")).unwrap();
        git(dir.path(), &["add", "a.md"]);
        git(dir.path(), &["commit", "-q", "-m", &format!("c{i}")]);
    }
    dir
}

const ALL_SCOPES: SnapshotOptions = SnapshotOptions {
    commit_limit: 5,
    graph_all: true,
    with_commits: true,
    with_branches: true,
    with_tags: true,
    with_stashes: true,
    with_worktrees: true,
    with_status: true,
};

#[tokio::test]
async fn opens_from_nested_folder_and_reports_status() {
    let dir = repo_with_commits(1);
    std::fs::create_dir_all(dir.path().join("notes")).unwrap();
    std::fs::write(dir.path().join("a.md"), "changed\n").unwrap();
    let engine = CliEngine::open(&dir.path().join("notes")).await.unwrap();
    let snap = engine.snapshot(&ALL_SCOPES).await.unwrap();
    assert_eq!(snap.repository.current_branch, "main");
    assert!(snap.working_tree.iter().any(|f| f.path == "a.md" && !f.staged));
}

#[tokio::test]
async fn pages_commit_log() {
    let dir = repo_with_commits(12);
    let engine = CliEngine::open(dir.path()).await.unwrap();
    let first = engine.snapshot(&ALL_SCOPES).await.unwrap();
    assert_eq!(first.commits.len(), 5);
    let oldest = first.page.oldest_sha.clone().unwrap();
    let next = engine.log_page(&oldest, 5, true, 5).await.unwrap();
    assert_eq!(next.commits.len(), 5);
    assert_ne!(next.commits[0].sha, first.commits[0].sha);
}

#[tokio::test]
async fn not_a_repo_is_typed_error() {
    let dir = tempfile::tempdir().unwrap();
    let err = CliEngine::open(dir.path()).await.err().unwrap();
    assert_eq!(err.code, "RepositoryNotFound");
}
