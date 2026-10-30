use super::super::*;
use super::harness::*;

#[tokio::test]
async fn stages_and_commits_a_file() {
    let h = Harness::new().await;
    std::fs::write(h.cwd.join("b.txt"), "two\n").unwrap();
    let env = h.exec("stage", Some("b.txt"), &null_meta()).await;
    assert!(env.ok, "{}", env.message);
    let env = h
        .exec("commit", None, &serde_json::json!({ "message": "second" }))
        .await;
    assert!(env.ok, "{}", env.message);
    let (ok, log) = probe(&h.cwd, &["log", "--oneline"]).await;
    assert!(ok && log.contains("second"));
    // Undo restores the pre-commit HEAD.
    let before_undo = h.head().await;
    let env = h.exec("undo", None, &null_meta()).await;
    assert!(env.ok, "{}", env.message);
    assert_ne!(h.head().await, before_undo);
}

#[tokio::test]
async fn manages_branches() {
    let h = Harness::new().await;
    let env = h
        .exec(
            "create-branch",
            None,
            &serde_json::json!({ "name": "feat" }),
        )
        .await;
    assert!(env.ok, "{}", env.message);
    let env = h.exec("checkout", Some("main"), &null_meta()).await;
    assert!(env.ok, "{}", env.message);
    let env = h.exec("delete-branch", Some("feat"), &null_meta()).await;
    assert!(env.ok, "{}", env.message);
    let env = h
        .exec("create-tag", None, &serde_json::json!({ "name": "v1" }))
        .await;
    assert!(env.ok, "{}", env.message);
    let env = h.exec("delete-tag", Some("v1"), &null_meta()).await;
    assert!(env.ok, "{}", env.message);
}

#[tokio::test]
async fn stash_roundtrip_and_reset_undo() {
    let h = Harness::new().await;
    std::fs::write(h.cwd.join("a.txt"), "modified\n").unwrap();
    let env = h
        .exec("stash", None, &serde_json::json!({ "message": "wip" }))
        .await;
    assert!(env.ok, "{}", env.message);
    assert_eq!(
        std::fs::read_to_string(h.cwd.join("a.txt")).unwrap(),
        "one\n"
    );
    let env = h.exec("pop-stash", None, &null_meta()).await;
    assert!(env.ok, "{}", env.message);
    assert_eq!(
        std::fs::read_to_string(h.cwd.join("a.txt")).unwrap(),
        "modified\n"
    );

    // Commit the change, reset away, then undo/redo the reset.
    std::fs::write(h.cwd.join("a.txt"), "modified\n").unwrap();
    h.exec("stage-all", None, &null_meta()).await;
    let env = h
        .exec("commit", None, &serde_json::json!({ "message": "second" }))
        .await;
    assert!(env.ok, "{}", env.message);
    let env = h.exec("reset-hard", Some("HEAD~1"), &null_meta()).await;
    assert!(env.ok, "{}", env.message);
    assert_eq!(
        std::fs::read_to_string(h.cwd.join("a.txt")).unwrap(),
        "one\n"
    );
    let env = h.exec("undo", None, &null_meta()).await;
    assert!(env.ok, "{}", env.message);
    assert_eq!(
        std::fs::read_to_string(h.cwd.join("a.txt")).unwrap(),
        "modified\n"
    );
    let env = h.exec("redo", None, &null_meta()).await;
    assert!(env.ok, "{}", env.message);
    assert_eq!(
        std::fs::read_to_string(h.cwd.join("a.txt")).unwrap(),
        "one\n"
    );
}

#[tokio::test]
async fn merges_fast_forward_and_rejects_unknown() {
    let h = Harness::new().await;
    h.exec(
        "create-branch",
        None,
        &serde_json::json!({ "name": "side" }),
    )
    .await;
    std::fs::write(h.cwd.join("c.txt"), "c\n").unwrap();
    h.exec("stage-all", None, &null_meta()).await;
    h.exec(
        "commit",
        None,
        &serde_json::json!({ "message": "side work" }),
    )
    .await;
    h.exec("checkout", Some("main"), &null_meta()).await;
    let env = h.exec("merge", Some("side"), &null_meta()).await;
    assert!(env.ok, "{}", env.message);
    assert!(h.cwd.join("c.txt").exists());

    let env = h.exec("no-such-kind", None, &null_meta()).await;
    assert!(!env.ok);
    assert!(env.message.contains("Unsupported action"));

    let env = h
        .exec("commit", None, &serde_json::json!({ "message": "   " }))
        .await;
    assert!(!env.ok);
    assert_eq!(env.error.unwrap().code, "NothingToCommit");
}

#[tokio::test]
async fn keeps_untracked_file_on_discard() {
    let h = Harness::new().await;
    std::fs::write(h.cwd.join("junk.txt"), "x\n").unwrap();
    let env = h.exec("discard-file", Some("junk.txt"), &null_meta()).await;
    assert!(!env.ok);
    assert!(h.cwd.join("junk.txt").exists());
}

#[test]
fn escapes_glob_specials() {
    assert_eq!(escape_glob("app/[id]/*?.tsx"), "app/\\[id\\]/\\*\\?.tsx");
    assert_eq!(escape_glob("a\\b"), "a\\\\b");
}

#[tokio::test]
async fn undo_without_history_fails_cleanly() {
    let h = Harness::new().await;
    let env = h.exec("undo", None, &null_meta()).await;
    assert!(!env.ok);
    assert!(env.message.contains("Nothing to undo"));
}

