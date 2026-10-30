use super::super::*;
use std::path::PathBuf;

pub(super) fn null_meta() -> serde_json::Value {
    serde_json::Value::Null
}

pub(super) async fn init_repo() -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().expect("tempdir");
    let cwd = dir.path().to_path_buf();
    let run = |args: Vec<String>| run_git(&cwd, args, RunOptions::default(), None, None);
    run(vec!["init".into(), "-b".into(), "main".into()])
        .await
        .expect("init");
    run(vec!["config".into(), "user.email".into(), "t@t".into()])
        .await
        .expect("config");
    run(vec!["config".into(), "user.name".into(), "t".into()])
        .await
        .expect("config");
    // Deterministic LF checkouts: Windows runners default to
    // `core.autocrlf=true`, which would check out `a.txt` as CRLF and
    // break exact-content assertions below.
    run(vec![
        "config".into(),
        "core.autocrlf".into(),
        "false".into(),
    ])
    .await
    .expect("config");
    std::fs::write(cwd.join("a.txt"), "one\n").unwrap();
    run(vec!["add".into(), "-A".into()]).await.expect("add");
    run(vec!["commit".into(), "-m".into(), "first".into()])
        .await
        .expect("commit");
    (dir, cwd)
}

pub(super) struct Harness {
    pub(super) _dir: tempfile::TempDir,
    pub(super) cwd: PathBuf,
    pub(super) journal: tokio::sync::Mutex<Journal>,
    pub(super) ops: tokio::sync::Mutex<Operations>,
}

impl Harness {
    pub(super) async fn new() -> Self {
        let (dir, cwd) = init_repo().await;
        Self {
            _dir: dir,
            cwd,
            journal: tokio::sync::Mutex::new(Journal::default()),
            ops: tokio::sync::Mutex::new(Operations::default()),
        }
    }

    pub(super) fn git_dir(&self) -> PathBuf {
        self.cwd.join(".git")
    }

    pub(super) async fn exec(
        &self,
        kind: &str,
        target: Option<&str>,
        meta: &serde_json::Value,
    ) -> ActionEnvelope {
        let emit = |_: &str, _: Option<u32>, _: bool| {};
        execute_action(
            &"test-op".to_string(),
            &self.cwd,
            &self.git_dir(),
            kind,
            target,
            meta,
            &self.journal,
            &self.ops,
            &emit,
        )
        .await
    }

    pub(super) async fn head(&self) -> String {
        let (ok, out) = probe(&self.cwd, &["rev-parse", "HEAD"]).await;
        assert!(ok);
        out.trim().to_string()
    }
}

