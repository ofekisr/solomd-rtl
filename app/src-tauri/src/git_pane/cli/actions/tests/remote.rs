use super::super::*;
use std::time::Duration;
use super::harness::*;

#[test]
fn remote_timeout_budgets_match_policy() {
    assert_eq!(REMOTE_FETCH_TIMEOUT_SECS, 300);
    assert_eq!(REMOTE_PUSH_PULL_TIMEOUT_SECS, 60);
    assert_eq!(
        remote_timeout_for("fetch"),
        Some(Duration::from_secs(REMOTE_FETCH_TIMEOUT_SECS))
    );
    assert_eq!(
        remote_timeout_for("fetch-all"),
        Some(Duration::from_secs(REMOTE_FETCH_TIMEOUT_SECS))
    );
    for kind in ["pull", "push", "push-tags", "force-push"] {
        assert_eq!(
            remote_timeout_for(kind),
            Some(Duration::from_secs(REMOTE_PUSH_PULL_TIMEOUT_SECS)),
            "kind: {kind}"
        );
    }
    assert_eq!(remote_timeout_for("commit"), None);
    assert_eq!(remote_timeout_for("sync"), None);
    assert_eq!(remote_timeout_for("status"), None);
}

#[tokio::test]
async fn remote_actions_stream_progress_against_local_remote() {
    let h = Harness::new().await;
    let remote_dir = tempfile::tempdir().expect("remote tempdir");
    let remote_arg = remote_dir
        .path()
        .join("origin.git")
        .to_string_lossy()
        .into_owned();
    let run = |args: Vec<String>| run_git(&h.cwd, args, RunOptions::default(), None, None);
    run(vec!["init".into(), "--bare".into(), remote_arg.clone()])
        .await
        .expect("init bare remote");
    run(vec![
        "remote".into(),
        "add".into(),
        "origin".into(),
        remote_arg,
    ])
    .await
    .expect("remote add");
    run(vec![
        "push".into(),
        "-u".into(),
        "origin".into(),
        "main".into(),
    ])
    .await
    .expect("initial push");

    async fn exec_with_progress(h: &Harness, kind: &str) -> (ActionEnvelope, Vec<String>) {
        let phases = std::sync::Mutex::new(Vec::new());
        let emit = |phase: &str, _: Option<u32>, _: bool| {
            phases.lock().unwrap().push(phase.to_string());
        };
        let env = execute_action(
            &"test-op".to_string(),
            &h.cwd,
            &h.git_dir(),
            kind,
            None,
            &serde_json::Value::Null,
            &h.journal,
            &h.ops,
            &emit,
        )
        .await;
        (env, phases.into_inner().unwrap())
    }

    // `pull` and `push-tags` previously used the non-streaming runner;
    // every remote kind must flow through `run_git_streaming` so the
    // frontend gets live phases plus a working cancel.
    for kind in ["push", "fetch", "pull", "push-tags"] {
        let (env, phases) = exec_with_progress(&h, kind).await;
        assert!(env.ok, "{kind}: {}", env.message);
        assert!(
            phases.iter().any(|p| p.contains("Starting")),
            "{kind}: missing start phase in {phases:?}"
        );
        assert!(
            phases.iter().any(|p| p == "Done"),
            "{kind}: missing done phase in {phases:?}"
        );
    }
}

#[tokio::test]
async fn operations_registry_cancels() {
    let mut ops = Operations::default();
    let rx = ops.register("op-1");
    // Dropping via cancel_all closes the channel.
    assert_eq!(ops.cancel_all(), 1);
    let mut rx = rx;
    assert!(rx.changed().await.is_err());
    assert_eq!(ops.cancel_all(), 0);
}
