use super::cli::actions::{execute_action, Journal, Operations};
use super::cli::diff::{
    fetch_blame, fetch_compare_files, fetch_diff, fetch_rebase_commits, DiffFetch, DiffSource,
};
use super::cli::log::fetch_commit_log;
use super::kinds;
use std::path::Path;

const NOOP_EMIT: &(dyn Fn(&str, Option<u32>, bool) + Send + Sync) = &|_, _, _| {};
const SMUGGLED_OUTPUT_FILE: &str = "smuggled.out";

fn git(dir: &Path, args: &[&str]) -> String {
    let out = std::process::Command::new("git").args(args).current_dir(dir).output().unwrap();
    assert!(out.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&out.stderr));
    String::from_utf8_lossy(&out.stdout).into_owned()
}

fn temp_repo() -> tempfile::TempDir {
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

async fn run(dir: &Path, kind: &str, target: Option<&str>, meta: serde_json::Value) -> super::cli::actions::ActionEnvelope {
    let journal = tokio::sync::Mutex::new(Journal::default());
    let ops = tokio::sync::Mutex::new(Operations::default());
    execute_action("t", dir, &dir.join(".git"), kind, target, &meta, &journal, &ops, NOOP_EMIT).await
}

#[test]
fn allowlist_matches_spec() {
    for kind in ["stage", "unstage", "stage-patch", "unstage-patch", "discard-file", "discard-patch", "commit", "amend", "commit-and-push", "checkout", "create-branch", "delete-branch", "stash", "fetch", "pull", "push", "force-push"] {
        assert!(kinds::is_allowed(kind), "{kind} should be allowed");
    }
    for kind in ["interactive-rebase", "reset-hard", "bisect-start", "undo", "open-terminal"] {
        assert!(!kinds::is_allowed(kind), "{kind} should be rejected");
    }
}

#[tokio::test]
async fn commit_keeps_multiline_unicode_message() {
    let dir = temp_repo();
    std::fs::write(dir.path().join("a.md"), "two\n").unwrap();
    git(dir.path(), &["add", "a.md"]);
    let message = "תיקון כותרת\n\n-- body line starting with dashes";
    let env = run(dir.path(), "commit", None, serde_json::json!({ "message": message })).await;
    assert!(env.ok, "{}", env.message);
    assert_eq!(git(dir.path(), &["log", "-1", "--format=%B"]).trim_end(), message);
}

#[tokio::test]
async fn invalid_branch_name_is_rejected() {
    let dir = temp_repo();
    let env = run(dir.path(), "create-branch", None, serde_json::json!({ "name": "bad..name" })).await;
    assert!(!env.ok);
    assert!(git(dir.path(), &["branch", "--list", "bad..name"]).trim().is_empty());
}

fn smuggled_rev(dir: &Path) -> String {
    format!("--output={}", dir.join(SMUGGLED_OUTPUT_FILE).display())
}

fn assert_nothing_written(dir: &Path) {
    assert!(!dir.join(SMUGGLED_OUTPUT_FILE).exists(), "flag smuggled into git argv");
}

fn diff_request(source: DiffSource, rev: &str) -> DiffFetch {
    DiffFetch {
        source,
        path: "a.md".to_string(),
        sha: Some(rev.to_string()),
        to_sha: Some("HEAD".to_string()),
        ignore_whitespace: false,
    }
}

#[tokio::test]
async fn diff_rejects_flag_like_revisions() {
    let dir = temp_repo();
    let rev = smuggled_rev(dir.path());
    for source in [DiffSource::Commit, DiffSource::Range] {
        assert!(fetch_diff(dir.path(), &diff_request(source, &rev)).await.is_err());
    }
    let mut to_side = diff_request(DiffSource::Range, "HEAD");
    to_side.to_sha = Some(rev.clone());
    assert!(fetch_diff(dir.path(), &to_side).await.is_err());
    assert_nothing_written(dir.path());
}

#[tokio::test]
async fn blame_compare_and_rebase_reject_flag_like_revisions() {
    let dir = temp_repo();
    let rev = smuggled_rev(dir.path());
    assert!(fetch_blame(dir.path(), &DiffSource::Commit, "a.md", Some(&rev), None).await.is_err());
    assert!(fetch_blame(dir.path(), &DiffSource::Range, "a.md", None, Some(&rev)).await.is_err());
    assert!(fetch_compare_files(dir.path(), &rev, "HEAD").await.is_err());
    assert!(fetch_compare_files(dir.path(), "HEAD", &rev).await.is_err());
    assert!(fetch_rebase_commits(dir.path(), &rev).await.is_err());
    assert_nothing_written(dir.path());
}

#[tokio::test]
async fn log_rejects_flag_like_end_rev() {
    let dir = temp_repo();
    let rev = smuggled_rev(dir.path());
    assert!(fetch_commit_log(dir.path(), 10, false, Some(&rev), 0).await.is_err());
    assert_nothing_written(dir.path());
}

#[tokio::test]
async fn valid_revisions_still_work_with_end_of_options() {
    let dir = temp_repo();
    std::fs::write(dir.path().join("a.md"), "two\n").unwrap();
    git(dir.path(), &["commit", "-qam", "second"]);
    let diff = fetch_diff(dir.path(), &diff_request(DiffSource::Range, "HEAD~1")).await.unwrap();
    assert!(!diff.hunks.is_empty());
    let commit = fetch_diff(dir.path(), &diff_request(DiffSource::Commit, "HEAD")).await.unwrap();
    assert!(!commit.hunks.is_empty());
    let blame = fetch_blame(dir.path(), &DiffSource::Commit, "a.md", Some("HEAD"), None).await.unwrap();
    assert_eq!(blame.lines.len(), 1);
    assert_eq!(blame.lines[0].content, "two");
    let old_blame = fetch_blame(dir.path(), &DiffSource::Commit, "a.md", Some("HEAD~1"), None).await.unwrap();
    assert_eq!(old_blame.lines[0].content, "one");
    let files = fetch_compare_files(dir.path(), "HEAD~1", "HEAD").await.unwrap();
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].path, "a.md");
    let rebase = fetch_rebase_commits(dir.path(), "HEAD~1").await.unwrap();
    assert_eq!(rebase.commits.len(), 1);
}
