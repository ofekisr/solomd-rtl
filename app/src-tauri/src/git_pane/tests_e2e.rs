use super::cli::git::SnapshotOptions;
use super::engine::{CliEngine, GitEngine};
use super::lock::RepoLocks;
use std::path::Path;
use std::time::Duration;

const NOOP_EMIT: &(dyn Fn(&str, Option<u32>, bool) + Send + Sync) = &|_, _, _| {};
const FILE_LINES: usize = 30;
const LOCK_PROBE_MS: u64 = 150;
const STATUS_ONLY: SnapshotOptions = SnapshotOptions {
    commit_limit: 5,
    graph_all: false,
    with_commits: true,
    with_branches: true,
    with_tags: false,
    with_stashes: true,
    with_worktrees: false,
    with_status: true,
};

fn git(dir: &Path, args: &[&str]) -> String {
    let out = std::process::Command::new("git").args(args).current_dir(dir).output().unwrap();
    assert!(out.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&out.stderr));
    String::from_utf8_lossy(&out.stdout).into_owned()
}

fn numbered_lines(replace_first_and_last: bool) -> String {
    (1..=FILE_LINES)
        .map(|n| {
            let edited = replace_first_and_last && (n == 1 || n == FILE_LINES);
            if edited { format!("edited {n}\n") } else { format!("line {n}\n") }
        })
        .collect()
}

struct Fixture {
    work: tempfile::TempDir,
    bare: tempfile::TempDir,
}

fn fixture() -> Fixture {
    let work = tempfile::tempdir().unwrap();
    let bare = tempfile::tempdir().unwrap();
    git(bare.path(), &["init", "-q", "--bare", "-b", "main"]);
    git(work.path(), &["init", "-q", "-b", "main"]);
    git(work.path(), &["config", "user.email", "t@example.com"]);
    git(work.path(), &["config", "user.name", "Tester"]);
    git(work.path(), &["config", "commit.gpgsign", "false"]);
    std::fs::write(work.path().join("a.md"), numbered_lines(false)).unwrap();
    git(work.path(), &["add", "a.md"]);
    git(work.path(), &["commit", "-q", "-m", "init"]);
    git(work.path(), &["remote", "add", "origin", bare.path().to_str().unwrap()]);
    git(work.path(), &["push", "-q", "-u", "origin", "main"]);
    Fixture { work, bare }
}

async fn act(engine: &CliEngine, kind: &str, target: Option<&str>, meta: serde_json::Value) -> super::cli::actions::ActionEnvelope {
    engine.execute("e2e", kind, target, &meta, NOOP_EMIT).await
}

fn first_hunk_patch(dir: &Path) -> String {
    let diff = git(dir, &["diff", "--", "a.md"]);
    let hunk_starts: Vec<usize> = diff.match_indices("\n@@").map(|(i, _)| i + 1).collect();
    assert_eq!(hunk_starts.len(), 2, "fixture must produce two hunks");
    diff[..hunk_starts[1]].to_string()
}

#[tokio::test]
async fn full_flow_against_bare_remote() {
    let fx = fixture();
    let dir = fx.work.path();
    let engine = CliEngine::open(dir).await.unwrap();

    std::fs::write(dir.join("a.md"), numbered_lines(true)).unwrap();
    let snap = engine.snapshot(&STATUS_ONLY).await.unwrap();
    assert!(snap.working_tree.iter().any(|f| f.path == "a.md" && !f.staged));

    let patch = first_hunk_patch(dir);
    let staged = act(&engine, "stage-patch", Some("a.md"), serde_json::json!({ "patch": patch })).await;
    assert!(staged.ok, "{}", staged.message);
    let cached = git(dir, &["diff", "--cached", "--", "a.md"]);
    assert!(cached.contains("+edited 1") && !cached.contains("+edited 30"));

    let message = "תיקון כותרת\n\nגוף ההודעה\nשורה שנייה";
    let committed = act(&engine, "commit", None, serde_json::json!({ "message": message })).await;
    assert!(committed.ok, "{}", committed.message);
    assert_eq!(git(dir, &["log", "-1", "--format=%B"]).trim_end(), message);

    let head_before = git(dir, &["rev-parse", "HEAD"]);
    let amended = act(&engine, "amend", None, serde_json::json!({ "message": "תיקון מתוקן" })).await;
    assert!(amended.ok, "{}", amended.message);
    assert_ne!(git(dir, &["rev-parse", "HEAD"]), head_before);
    assert_eq!(git(dir, &["log", "-1", "--format=%B"]).trim_end(), "תיקון מתוקן");

    let created = act(&engine, "create-branch", None, serde_json::json!({ "name": "feat" })).await;
    assert!(created.ok, "{}", created.message);
    assert_eq!(git(dir, &["branch", "--show-current"]).trim(), "feat");
    std::fs::write(dir.join("a.md"), "feature content\n").unwrap();
    git(dir, &["commit", "-qam", "feature change"]);
    let back = act(&engine, "checkout", Some("main"), serde_json::json!({})).await;
    assert!(back.ok, "{}", back.message);
    assert_eq!(git(dir, &["branch", "--show-current"]).trim(), "main");

    std::fs::write(dir.join("a.md"), "dirty local\n").unwrap();
    let blocked = act(&engine, "checkout", Some("feat"), serde_json::json!({})).await;
    assert!(!blocked.ok);
    assert_eq!(blocked.error.as_ref().unwrap().code, "DirtyWorktree");

    let stashed = act(&engine, "stash", None, serde_json::json!({ "message": "e2e" })).await;
    assert!(stashed.ok, "{}", stashed.message);
    let moved = act(&engine, "checkout", Some("feat"), serde_json::json!({})).await;
    assert!(moved.ok, "{}", moved.message);
    let home = act(&engine, "checkout", Some("main"), serde_json::json!({})).await;
    assert!(home.ok, "{}", home.message);

    let pushed = act(&engine, "push", None, serde_json::json!({})).await;
    assert!(pushed.ok, "{}", pushed.message);
    let remote_log = git(fx.bare.path(), &["log", "-1", "--format=%B", "main"]);
    assert_eq!(remote_log.trim_end(), "תיקון מתוקן");

    let fetched = act(&engine, "fetch", None, serde_json::json!({})).await;
    assert!(fetched.ok, "{}", fetched.message);
    let pulled = act(&engine, "pull", None, serde_json::json!({})).await;
    assert!(pulled.ok, "{}", pulled.message);
}

#[tokio::test]
async fn engine_write_waits_for_external_lock_holder() {
    let fx = fixture();
    let dir = fx.work.path().to_path_buf();
    let engine = std::sync::Arc::new(CliEngine::open(&dir).await.unwrap());
    std::fs::write(dir.join("b.md"), "new\n").unwrap();

    let guard = RepoLocks::global().acquire(&dir).await;
    let task_engine = engine.clone();
    let task = tokio::spawn(async move { act(&task_engine, "stage", Some("b.md"), serde_json::json!({})).await });

    tokio::time::sleep(Duration::from_millis(LOCK_PROBE_MS)).await;
    assert!(!task.is_finished(), "engine write ran while the lock was held");
    git(&dir, &["add", "a.md"]);
    drop(guard);

    let env = task.await.unwrap();
    assert!(env.ok, "{}", env.message);
    assert!(!env.message.contains("index.lock"));
    assert!(git(&dir, &["diff", "--cached", "--name-only"]).contains("b.md"));
}
