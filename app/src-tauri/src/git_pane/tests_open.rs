use super::commands::{open_repo, GitPaneState};
use super::engine::{CliEngine, GitEngine};
use std::path::Path;
use std::sync::Arc;

const MARKER_FILE: &str = "filter-ran.marker";

fn git(dir: &Path, args: &[&str]) {
    let out = std::process::Command::new("git").args(args).current_dir(dir).output().unwrap();
    assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
}

fn repo() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    git(dir.path(), &["init", "-q", "-b", "main"]);
    git(dir.path(), &["config", "user.email", "t@example.com"]);
    git(dir.path(), &["config", "user.name", "Tester"]);
    git(dir.path(), &["config", "commit.gpgsign", "false"]);
    std::fs::write(dir.path().join("a.md"), "one\n").unwrap();
    git(dir.path(), &["add", "a.md"]);
    git(dir.path(), &["commit", "-q", "-m", "init"]);
    dir
}

fn noop(_: &str) {}

async fn root_of(state: &GitPaneState) -> Option<std::path::PathBuf> {
    state.current_root().await
}

#[tokio::test]
async fn older_open_finishing_last_does_not_win() {
    let (first, second) = (repo(), repo());
    let state = GitPaneState::default();
    let older = state.begin_open();
    let newer = state.begin_open();
    let first_engine = Arc::new(CliEngine::open(first.path()).await.unwrap());
    let second_engine = Arc::new(CliEngine::open(second.path()).await.unwrap());
    let expected = second_engine.root().to_path_buf();
    assert!(state.install(newer, Some((second_engine, None))).await);
    assert!(!state.install(older, Some((first_engine, None))).await);
    assert_eq!(root_of(&state).await, Some(expected));
}

#[tokio::test]
async fn failed_open_clears_previous_engine() {
    let good = repo();
    let plain = tempfile::tempdir().unwrap();
    let state = GitPaneState::default();
    assert!(open_repo(&state, &good.path().to_string_lossy(), &None, false, noop).await.ok);
    let failed = open_repo(&state, &plain.path().to_string_lossy(), &None, false, noop).await;
    assert!(!failed.ok);
    assert_eq!(root_of(&state).await, None);
}

#[tokio::test]
async fn close_clears_engine() {
    let good = repo();
    let state = GitPaneState::default();
    assert!(open_repo(&state, &good.path().to_string_lossy(), &None, false, noop).await.ok);
    state.close().await;
    assert_eq!(root_of(&state).await, None);
}

#[cfg(unix)]
fn repo_with_clean_filter() -> (tempfile::TempDir, std::path::PathBuf) {
    let dir = repo();
    let marker = dir.path().join(MARKER_FILE);
    std::fs::write(dir.path().join(".gitattributes"), "*.md filter=x\n").unwrap();
    let command = format!("touch '{}'; cat", marker.display());
    git(dir.path(), &["config", "filter.x.clean", &command]);
    std::fs::write(dir.path().join("a.md"), "two\n").unwrap();
    (dir, marker)
}

#[cfg(unix)]
#[tokio::test]
async fn untrusted_config_blocks_snapshot() {
    let (dir, marker) = repo_with_clean_filter();
    let state = GitPaneState::default();
    let path = dir.path().to_string_lossy().into_owned();
    let env = open_repo(&state, &path, &None, false, noop).await;
    assert!(!env.ok);
    let error = env.error.unwrap();
    assert_eq!(error.code, "UntrustedConfig");
    assert_eq!(error.files, Some(vec!["filter.x.clean".to_string()]));
    let root = dir.path().canonicalize().unwrap().to_string_lossy().into_owned();
    assert_eq!(error.detail, Some(root));
    assert!(!marker.exists(), "snapshot ran on an untrusted repo");
    assert_eq!(root_of(&state).await, None);
}

#[cfg(unix)]
#[tokio::test]
async fn trusted_repo_opens_and_runs_filter() {
    let (dir, marker) = repo_with_clean_filter();
    let state = GitPaneState::default();
    let path = dir.path().to_string_lossy().into_owned();
    let env = open_repo(&state, &path, &None, true, noop).await;
    assert!(env.ok);
    assert!(marker.exists(), "marker proof is not wired: the filter never ran");
}
