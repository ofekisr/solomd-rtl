//! Repository validation.

use std::path::{Path, PathBuf};

use super::*;

/// Resolve + validate that `path` is a non-bare git working tree.
/// Subfolders of a working tree resolve to the top level
/// (`rev-parse --show-toplevel`) so opening a nested folder lands on the repo
/// root instead of the subfolder.
pub async fn validate_repo(path: &Path) -> Result<RepoInfo, GitError> {
    let canonical = std::fs::canonicalize(path).map_err(|_| {
        GitError::new(
            "RepositoryNotFound",
            "The repository could not be found.".to_string(),
        )
    })?;
    // One spawn answers both "is this a repo?" and "is it bare?". The two
    // values are printed in argument order, one per line.
    let (ok, stdout, _) = git_text(
        &canonical,
        &["rev-parse", "--git-dir", "--is-bare-repository"],
    )
    .await?;
    if !ok {
        return Err(GitError::new(
            "NotARepository",
            "This folder is not a Git repository.".to_string(),
        ));
    }
    let mut lines = stdout.lines();
    let raw = lines.next().unwrap_or("").trim().to_string();
    let is_bare = lines.next().map(|l| l.trim() == "true").unwrap_or(false);
    if is_bare {
        return Err(GitError::new(
            "BareRepository",
            "Bare repositories are not supported yet.".to_string(),
        ));
    }
    // Resolve the working-tree root (handles opening a subfolder directly).
    // A bare repository has no work tree, which is why this runs last.
    let worktree_root = match git_text(&canonical, &["rev-parse", "--show-toplevel"]).await {
        Ok((true, out, _)) => {
            let trimmed = out.trim();
            if trimmed.is_empty() {
                canonical.clone()
            } else {
                std::fs::canonicalize(trimmed).unwrap_or_else(|_| PathBuf::from(trimmed))
            }
        }
        _ => canonical.clone(),
    };
    let git_dir = if Path::new(&raw).is_absolute() {
        PathBuf::from(raw)
    } else {
        canonical.join(raw)
    };
    if !git_dir.exists() {
        return Err(GitError::new(
            "RepositoryNotFound",
            "The .git directory is missing.".to_string(),
        ));
    }
    Ok(RepoInfo {
        path: worktree_root,
        git_dir,
        git_version: cached_git_version(&canonical).await?,
    })
}

/// `git --version` cannot change while the app runs, so it is spawned once per
/// process (it used to be a spawn on every repository validation). The cell
/// only memoizes success, so a transient spawn failure is retried.
static GIT_VERSION: tokio::sync::OnceCell<String> = tokio::sync::OnceCell::const_new();

async fn cached_git_version(cwd: &Path) -> Result<String, GitError> {
    let version = GIT_VERSION
        .get_or_try_init(|| async {
            let (_, out, _) = git_text(cwd, &["--version"]).await?;
            Ok::<String, GitError>(out.replace("git version ", "").trim().to_string())
        })
        .await?;
    Ok(version.clone())
}
