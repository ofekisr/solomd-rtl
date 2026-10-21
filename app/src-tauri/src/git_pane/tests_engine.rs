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

#[tokio::test]
async fn repo_config_cannot_spawn_fsmonitor() {
    let dir = repo_with_commits(1);
    let marker = dir.path().join("fsmonitor-ran");
    let hook = dir.path().join("hook.sh");
    std::fs::write(&hook, format!("#!/bin/sh\ntouch '{}'\n", marker.display())).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    git(dir.path(), &["config", "core.fsmonitor", hook.to_str().unwrap()]);
    std::fs::remove_file(&marker).ok();
    let engine = CliEngine::open(dir.path()).await.unwrap();
    engine.snapshot(&ALL_SCOPES).await.unwrap();
    assert!(!marker.exists());
}

#[tokio::test]
async fn linked_worktree_resolves_common_dir() {
    let dir = repo_with_commits(1);
    let wt = tempfile::tempdir().unwrap();
    let wt_path = wt.path().join("wt");
    git(dir.path(), &["worktree", "add", "-q", "-b", "w", wt_path.to_str().unwrap()]);
    let engine = CliEngine::open(&wt_path).await.unwrap();
    assert!(engine.common_dir().join("refs").is_dir());
    assert_ne!(engine.common_dir(), engine.git_dir());
}

const MARKER_FILE: &str = "ran.marker";

#[cfg(unix)]
fn write_executable(path: &Path, body: &str) {
    use std::os::unix::fs::PermissionsExt;
    std::fs::write(path, body).unwrap();
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
}

#[cfg(unix)]
#[tokio::test]
async fn snapshot_skips_dirty_submodule_filters() {
    let sub = repo_with_commits(1);
    let dir = repo_with_commits(1);
    let marker = dir.path().join(MARKER_FILE);
    let sub_url = sub.path().to_string_lossy().into_owned();
    git(dir.path(), &["-c", "protocol.file.allow=always", "submodule", "add", "-q", &sub_url, "s"]);
    git(dir.path(), &["commit", "-q", "-m", "add submodule"]);
    let module = dir.path().join("s");
    let command = format!("touch '{}'; cat", marker.display());
    git(&module, &["config", "filter.z.clean", &command]);
    std::fs::write(module.join(".gitattributes"), "*.md filter=z\n").unwrap();
    std::fs::write(module.join("a.md"), "line 9\n").unwrap();
    let engine = CliEngine::open(dir.path()).await.unwrap();
    engine.snapshot(&ALL_SCOPES).await.unwrap();
    assert!(!marker.exists(), "snapshot ran a submodule filter");
}

#[cfg(unix)]
#[tokio::test]
async fn untracked_diff_skips_index_hooks() {
    use super::cli::diff::{DiffFetch, DiffSource};
    let dir = repo_with_commits(1);
    let marker = dir.path().join(MARKER_FILE);
    let hook = dir.path().join(".git/hooks/post-index-change");
    write_executable(&hook, &format!("#!/bin/sh\ntouch '{}'\n", marker.display()));
    std::fs::write(dir.path().join("b.md"), "new\n").unwrap();
    let engine = CliEngine::open(dir.path()).await.unwrap();
    let req = DiffFetch {
        source: DiffSource::Worktree,
        path: "b.md".to_string(),
        sha: None,
        to_sha: None,
        ignore_whitespace: false,
    };
    engine.diff(&req).await.unwrap();
    assert!(!marker.exists(), "intent-to-add ran a repo hook");
}
