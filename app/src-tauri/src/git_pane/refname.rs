use super::cli::git::GitError;
use std::path::Path;
use std::process::Stdio;

pub async fn validate_branch_name(cwd: &Path, name: &str) -> Result<(), GitError> {
    let mut cmd = super::env::git_command()?;
    let status = cmd
        .args(["check-ref-format", "--branch", name])
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map_err(|e| GitError::unknown(format!("failed to spawn git: {e}")))?;
    if status.success() {
        return Ok(());
    }
    Err(GitError::new("InvalidRefName", format!("\"{name}\" is not a valid branch name.")))
}
