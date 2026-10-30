// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;
use crate::git_pane::cli::git::child_env;
use crate::git_pane::cli::git::git_text;
use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tokio::sync::watch;

use super::args::{MAX_OUTPUT_BYTES, truncate_output};
use super::classify::classify_git_error;

pub struct RunResult {
    pub stdout: String,
    /// Retained for progress plumbing + error classification parity with TS.
    #[allow(dead_code)]
    pub stderr: String,
    pub exit_code: Option<i32>,
}

pub struct RunOptions {
    pub allow_failure: bool,
    pub timeout: Option<Duration>,
    pub input: Option<String>,
    pub extra_env: Vec<(String, String)>,
}

impl Default for RunOptions {
    fn default() -> Self {
        Self {
            allow_failure: false,
            timeout: Some(Duration::from_secs(30)),
            input: None,
            extra_env: Vec::new(),
        }
    }
}

/// Timeout budgets for remote operations, in seconds. Fetches mirror the
/// prefetch background fetcher (5min); push/pull mirror gitcat (1min).
/// Local operations keep the 30s default from `RunOptions`.
pub const REMOTE_FETCH_TIMEOUT_SECS: u64 = 300;
pub const REMOTE_PUSH_PULL_TIMEOUT_SECS: u64 = 60;

/// Timeout budget for a single-phase remote action kind. Returns `None`
/// for non-remote kinds (caller keeps the default). `sync` is two-phase
/// (fetch leg + pull leg), so its legs use the constants directly.
pub fn remote_timeout_for(kind: &str) -> Option<Duration> {
    let secs = match kind {
        "fetch" | "fetch-all" => REMOTE_FETCH_TIMEOUT_SECS,
        "pull" | "push" | "push-tags" | "force-push" => REMOTE_PUSH_PULL_TIMEOUT_SECS,
        _ => return None,
    };
    Some(Duration::from_secs(secs))
}

/// Registry of in-flight operations for `git_cancel` (mirrors the
/// `operations` map + AbortControllers in `GitProvider`).
/// Dropping a sender closes the channel, which the runner treats as cancel.
#[derive(Default)]
pub struct Operations {
    senders: HashMap<String, watch::Sender<()>>,
}

impl Operations {
    pub fn register(&mut self, id: &str) -> watch::Receiver<()> {
        let (tx, rx) = watch::channel(());
        self.senders.insert(id.to_string(), tx);
        rx
    }

    pub fn unregister(&mut self, id: &str) {
        self.senders.remove(id);
    }

    /// Cancel everything in flight; returns how many were still registered.
    /// Dropping the senders closes the channels, which runners treat as cancel.
    pub fn cancel_all(&mut self) -> usize {
        let n = self.senders.len();
        self.senders.clear();
        n
    }
}

pub(super) fn base_argv(args: &[String]) -> Vec<String> {
    let mut full = vec![
        "-c".to_string(),
        "core.quotepath=false".to_string(),
        "-c".to_string(),
        "color.ui=false".to_string(),
    ];
    full.extend(args.iter().cloned());
    full
}

/// Throwing invocation (mirrors `gitCli.run`): non-zero exit without
/// `allow_failure` becomes a classified `GitError`; cancel/timeout kill.
pub async fn run_git(
    cwd: &Path,
    args: Vec<String>,
    mut opts: RunOptions,
    cancel: Option<watch::Receiver<()>>,
    on_progress_line: Option<&(dyn Fn(&str) + Send + Sync)>,
) -> Result<RunResult, GitError> {
    let started = std::time::Instant::now();
    let full = base_argv(&args);
    let mut cmd = crate::git_pane::env::git_command()?;
    cmd.args(&full)
        .current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    child_env(&mut cmd);
    for (k, v) in std::mem::take(&mut opts.extra_env) {
        cmd.env(k, v);
    }
    let mut child = cmd
        .spawn()
        .map_err(|e| GitError::unknown(format!("failed to spawn git: {e}")))?;

    if let Some(input) = opts.input {
        use tokio::io::AsyncWriteExt;
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(input.as_bytes()).await;
        }
    }

    enum WaitEnd {
        Exited(Option<i32>),
        Cancelled,
        TimedOut,
    }
    // Drain pipes concurrently so large outputs never deadlock the child.
    // (`wait_with_output` consumes the child, but cancel/timeout must still
    // be able to kill it, so pipes are drained by background tasks.)
    let stdout_take = child.stdout.take();
    let stderr_take = child.stderr.take();
    let out_handle = tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut buf = Vec::new();
        if let Some(pipe) = stdout_take {
            // Bounded read: stop once the cap is reached instead of
            // buffering an unbounded `git log/diff/status`.
            let mut limited = pipe.take((MAX_OUTPUT_BYTES + 1) as u64);
            let _ = limited.read_to_end(&mut buf).await;
        }
        truncate_output(buf)
    });
    let err_handle = tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut buf = Vec::new();
        if let Some(pipe) = stderr_take {
            let mut limited = pipe.take((MAX_OUTPUT_BYTES + 1) as u64);
            let _ = limited.read_to_end(&mut buf).await;
        }
        truncate_output(buf)
    });
    let timeout = opts.timeout;
    let wait_end = async {
        tokio::select! {
            st = child.wait() => WaitEnd::Exited(st.ok().and_then(|s| s.code())),
            _ = async {
                match cancel {
                    Some(mut rx) => {
                        let _ = rx.changed().await;
                    }
                    None => std::future::pending::<()>().await,
                }
            } => WaitEnd::Cancelled,
            _ = async {
                match timeout {
                    Some(d) => tokio::time::sleep(d).await,
                    None => std::future::pending::<()>().await,
                }
            } => WaitEnd::TimedOut,
        }
    }
    .await;

    let killed = match wait_end {
        WaitEnd::Cancelled | WaitEnd::TimedOut => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            true
        }
        WaitEnd::Exited(_) => false,
    };
    let stdout = String::from_utf8_lossy(&out_handle.await.unwrap_or_default()).into_owned();
    let stderr = String::from_utf8_lossy(&err_handle.await.unwrap_or_default()).into_owned();

    if killed {
        tracing::debug!(target: "git_pane", argv = ?full, exit = ?None::<i32>, elapsed_ms = started.elapsed().as_millis() as u64, "git");
        return Err(if matches!(wait_end, WaitEnd::TimedOut) {
            GitError::unknown("Git command timed out.".to_string())
        } else {
            GitError::new("Cancelled", "The operation was cancelled.".to_string())
        });
    }
    let exit_code = match wait_end {
        WaitEnd::Exited(code) => code,
        _ => None,
    };
    tracing::debug!(target: "git_pane", argv = ?full, exit = ?exit_code, elapsed_ms = started.elapsed().as_millis() as u64, "git");
    {
        let ok = exit_code == Some(0);

        if let Some(cb) = on_progress_line {
            for line in stderr.split(['\n', '\r']) {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    cb(trimmed);
                }
            }
        }

        if ok || opts.allow_failure {
            return Ok(RunResult {
                stdout,
                stderr,
                exit_code,
            });
        }
        Err(classify_git_error(
            &stderr_or_stdout(&stderr, &stdout),
            exit_code,
        ))
    }
}

pub(super) fn stderr_or_stdout(stderr: &str, stdout: &str) -> String {
    if stderr.trim().is_empty() {
        stdout.to_string()
    } else {
        stderr.to_string()
    }
}

/// Streaming invocation for remote ops; progress lines go to the callback
/// (mirrors `runStreaming`, incl. auto `--progress`).
pub async fn run_git_streaming(
    cwd: &Path,
    args: Vec<String>,
    opts: RunOptions,
    cancel: Option<watch::Receiver<()>>,
    on_line: &(dyn Fn(&str) + Send + Sync),
) -> Result<RunResult, GitError> {
    let supports_progress = matches!(
        args.first().map(String::as_str),
        Some("fetch" | "push" | "pull" | "clone")
    );
    let mut args = args.to_vec();
    if supports_progress
        && !args
            .iter()
            .any(|a| a == "--progress" || a == "--no-progress")
    {
        args.push("--progress".to_string());
    }
    run_git(cwd, args, opts, cancel, Some(on_line)).await
}

/// Buffered read-only helper that resolves instead of throwing
/// (for `allowFailure`-style probes).
pub async fn probe(cwd: &Path, args: &[&str]) -> (bool, String) {
    match git_text(cwd, args).await {
        Ok((ok, stdout, _)) => (ok, stdout),
        Err(_) => (false, String::new()),
    }
}
