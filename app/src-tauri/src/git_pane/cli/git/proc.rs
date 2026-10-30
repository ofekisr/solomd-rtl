//! Spawning `git` with a stable, non-interactive environment.

use std::path::Path;
use std::process::Stdio;

use super::*;

/// Non-interactive child env shared by every git invocation
/// (mirrors `GitCliProvider.childEnv`).
pub fn child_env(cmd: &mut tokio::process::Command) {
    cmd.env("GIT_TERMINAL_PROMPT", "0");
    cmd.env("GIT_OPTIONAL_LOCKS", "0");
    cmd.env("LC_ALL", "C");
}

pub(crate) const END_OF_OPTIONS: &str = "--end-of-options";

fn trace_git(full: &[&str], exit: Option<i32>, started: std::time::Instant) {
    tracing::debug!(target: "git_pane", argv = ?full, exit = ?exit, elapsed_ms = started.elapsed().as_millis() as u64, "git");
}

/// Spawn `git` with argv only (never through a shell).
/// Always applies the stable-output base args + non-interactive env,
/// mirroring `GitCliProvider`.
pub async fn git_text(cwd: &Path, args: &[&str]) -> Result<(bool, String, String), GitError> {
    let started = std::time::Instant::now();
    let mut full: Vec<&str> = vec!["-c", "core.quotepath=false", "-c", "color.ui=false"];
    full.extend(args);
    let mut cmd = crate::git_pane::env::git_command()?;
    cmd.args(&full).current_dir(cwd).stdin(Stdio::null());
    child_env(&mut cmd);
    let output = cmd
        .output()
        .await
        .map_err(|e| GitError::unknown(format!("failed to spawn git: {e}")))?;
    trace_git(&full, output.status.code(), started);
    Ok((
        output.status.success(),
        String::from_utf8_lossy(&output.stdout).into_owned(),
        String::from_utf8_lossy(&output.stderr).into_owned(),
    ))
}

/// Spawn `git` with argv only (never through a shell) and return raw bytes.
/// Needed for binary blobs (`git show <rev>:<path>`); `git_text` would
/// corrupt them via UTF-8 lossy conversion.
pub async fn git_bytes(cwd: &Path, args: &[&str]) -> Result<(bool, Vec<u8>), GitError> {
    let started = std::time::Instant::now();
    let mut full: Vec<&str> = vec!["-c", "core.quotepath=false", "-c", "color.ui=false"];
    full.extend(args);
    let mut cmd = crate::git_pane::env::git_command()?;
    cmd.args(&full).current_dir(cwd).stdin(Stdio::null());
    child_env(&mut cmd);
    let output = cmd
        .output()
        .await
        .map_err(|e| GitError::unknown(format!("failed to spawn git: {e}")))?;
    trace_git(&full, output.status.code(), started);
    Ok((output.status.success(), output.stdout))
}
