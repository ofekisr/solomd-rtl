use super::super::*;
use super::harness::*;

#[test]
fn journal_labels_match_shared_policy() {
    assert_eq!(journal_label("commit", None, None), "Commit");
    assert_eq!(journal_label("merge", Some("main"), None), "Merge main");
    assert_eq!(journal_label("merge", None, None), "Merge");
    assert_eq!(
        journal_label("cherry-pick", Some("abcdef12345"), None),
        "Cherry-pick abcdef1"
    );
    assert_eq!(
        journal_label("create-branch", None, Some("feat")),
        "Create branch feat"
    );
    assert_eq!(journal_label("stage", Some("a.ts"), None), "Stage a.ts");
    assert_eq!(journal_label("weird-kind", None, None), "weird-kind");
}

#[test]
fn capture_table_matches_shared_policy() {
    assert_eq!(journal_capture_for("stage"), Some(JournalCapture::Index));
    assert_eq!(journal_capture_for("merge"), Some(JournalCapture::Head));
    assert_eq!(journal_capture_for("push"), None);
    assert_eq!(journal_capture_for("refresh"), None);
    assert!(is_journalable_action("commit"));
    assert!(!is_journalable_action("push"));
}

#[test]
fn undo_redo_safety_flags() {
    let mut state = RepoState {
        detached_head: false,
        merging: true,
        rebasing: false,
        cherry_picking: false,
        reverting: false,
        bisecting: false,
        operation_label: None,
    };
    assert!(!is_undo_redo_safe(&state));
    state.merging = false;
    assert!(is_undo_redo_safe(&state));
}

#[test]
fn rebase_bundle_writes_todo_and_cleans_up() {
    let dir = {
        let bundle = create_rebase_editor_bundle(&[
            (
                "pick".to_string(),
                "abc123".to_string(),
                "first".to_string(),
                None,
            ),
            (
                "reword".to_string(),
                "def456".to_string(),
                "second".to_string(),
                Some("Better title".to_string()),
            ),
        ])
        .expect("bundle");
        let todo = std::fs::read_to_string(bundle.dir.join("todo")).expect("todo file");
        assert_eq!(todo, "pick abc123 first\nreword def456 second\n");
        assert!(bundle.dir.join("msgs").join("msg-0").exists());
        assert_eq!(bundle.env.len(), 2);
        bundle.dir.clone()
    };
    assert!(!dir.exists(), "bundle dir must be cleaned up on drop");
}

/// End-to-end proof that the Windows `.ps1` editors drive a real
/// `git rebase -i`. Runtime-gated (not `#[cfg]`) so it type-checks on
/// every platform; it only executes on Windows CI.
#[tokio::test]
async fn windows_rebase_bundle_drives_real_rebase() {
    if !cfg!(target_os = "windows") {
        return;
    }
    let (_dir, cwd) = init_repo().await;
    let run = |args: Vec<String>| run_git(&cwd, args, RunOptions::default(), None, None);
    std::fs::write(cwd.join("b.txt"), "two\n").unwrap();
    run(vec!["add".into(), "-A".into()]).await.expect("add");
    run(vec!["commit".into(), "-m".into(), "second".into()])
        .await
        .expect("commit");
    let log = run(vec!["log".into(), "--reverse".into(), "--format=%H".into()])
        .await
        .expect("log");
    let shas: Vec<&str> = log.stdout.lines().collect();
    assert_eq!(shas.len(), 2, "unexpected log: {}", log.stdout);
    let bundle = create_rebase_editor_bundle(&[
        (
            "pick".to_string(),
            shas[1].to_string(),
            "second".to_string(),
            None,
        ),
        (
            "pick".to_string(),
            shas[0].to_string(),
            "first".to_string(),
            None,
        ),
    ])
    .expect("bundle");
    // `allow_failure` keeps the full stdout/stderr for diagnosis;
    // the exit-code assertion below preserves the test's strength.
    let result = run_git(
        &cwd,
        vec!["rebase".into(), "-i".into(), "--root".into()],
        RunOptions {
            extra_env: bundle.env.clone(),
            allow_failure: true,
            ..RunOptions::default()
        },
        None,
        None,
    )
    .await
    .expect("spawn rebase");
    if result.exit_code != Some(0) {
        eprintln!(
            "rebase bundle failed: dir={} env={:?} exit={:?} stdout={:?} stderr={:?}",
            bundle.dir.display(),
            bundle.env,
            result.exit_code,
            result.stdout,
            result.stderr
        );
    }
    drop(bundle);
    assert_eq!(result.exit_code, Some(0), "rebase driven by .ps1 editors");
    let log = run(vec!["log".into(), "--format=%s".into()])
        .await
        .expect("log");
    assert_eq!(
        log.stdout.lines().collect::<Vec<_>>(),
        vec!["first", "second"]
    );
}

