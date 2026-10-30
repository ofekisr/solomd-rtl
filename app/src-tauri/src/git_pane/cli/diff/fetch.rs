//! Async `git` fetchers: diff, blame, history, conflicts, commit files, rebase.

use super::*;
use std::path::Path;

use crate::git_pane::cli::actions::checked_rev;
use crate::git_pane::cli::git::END_OF_OPTIONS;
use crate::git_pane::cli::git::{
    BlameResult, ConflictResult, ConflictVersions, DiffResult, FileHistoryResult, GitError,
    RebaseCommitsResult, WireWorkingTreeFile,
};

#[derive(Debug, Clone, PartialEq)]
pub enum DiffSource {
    Worktree,
    Index,
    Commit,
    Range,
}

pub struct DiffFetch {
    pub source: DiffSource,
    pub path: String,
    pub sha: Option<String>,
    pub to_sha: Option<String>,
    pub ignore_whitespace: bool,
}

pub async fn fetch_diff(cwd: &Path, req: &DiffFetch) -> Result<DiffResult, GitError> {
    use crate::git_pane::cli::git::git_text;
    let safe_path = assert_path_inside_repo(&cwd.to_string_lossy(), &req.path)?;

    // Mirror the 512 KiB guard (worktree files only; TS checks the FS file).
    if req.source == DiffSource::Worktree {
        if let Ok(meta) = std::fs::metadata(cwd.join(&safe_path)) {
            if meta.len() > 512 * 1024 && !req.ignore_whitespace {
                let mut result = parse_unified_diff(&safe_path, "");
                result.too_large = true;
                return Ok(result);
            }
        }
    }

    let args: Vec<String> = match req.source {
        DiffSource::Index => vec![
            "diff".into(),
            "--cached".into(),
            "--".into(),
            safe_path.clone(),
        ],
        DiffSource::Commit => {
            let sha = checked_rev(req.sha.as_deref().unwrap_or("HEAD"), "revision")?;
            let parents = commit_parents(cwd, &sha).await?;
            if parents.len() > 1 {
                vec![
                    "diff".into(),
                    "-m".into(),
                    "--first-parent".into(),
                    END_OF_OPTIONS.into(),
                    format!("{}^1", sha),
                    sha,
                    "--".into(),
                    safe_path.clone(),
                ]
            } else if parents.len() == 1 {
                vec![
                    "diff".into(),
                    END_OF_OPTIONS.into(),
                    format!("{}^", sha),
                    sha,
                    "--".into(),
                    safe_path.clone(),
                ]
            } else {
                vec![
                    "show".into(),
                    END_OF_OPTIONS.into(),
                    sha,
                    "--".into(),
                    safe_path.clone(),
                ]
            }
        }
        DiffSource::Range => vec![
            "diff".into(),
            END_OF_OPTIONS.into(),
            checked_rev(req.sha.as_deref().unwrap_or("HEAD~1"), "revision")?,
            checked_rev(req.to_sha.as_deref().unwrap_or("HEAD"), "revision")?,
            "--".into(),
            safe_path.clone(),
        ],
        DiffSource::Worktree => {
            ensure_intent_to_add(cwd, &safe_path).await;
            vec!["diff".into(), "--ignore-submodules=dirty".into(), "--".into(), safe_path.clone()]
        }
    };
    let mut args: Vec<String> = args;
    args.splice(1..1, ["--no-ext-diff".to_string(), "--no-textconv".to_string()]);
    if req.ignore_whitespace {
        args.insert(1, "-w".to_string());
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (_, stdout, _) = git_text(cwd, &arg_refs).await?;
    Ok(parse_unified_diff(&safe_path, &stdout))
}

async fn commit_parents(cwd: &Path, sha: &str) -> Result<Vec<String>, GitError> {
    use crate::git_pane::cli::git::git_text;
    let sha = checked_rev(sha, "revision")?;
    let (ok, stdout, _) =
        git_text(cwd, &["rev-list", "--parents", "-n", "1", END_OF_OPTIONS, &sha]).await?;
    if !ok {
        return Ok(Vec::new());
    }
    let parts: Vec<&str> = stdout.split_whitespace().collect();
    Ok(parts.into_iter().skip(1).map(str::to_string).collect())
}

const NO_HOOKS: &str = "core.hooksPath=/dev/null";

/// Intent-to-add so untracked files appear in `git diff` (mirrors provider).
async fn ensure_intent_to_add(cwd: &Path, path: &str) {
    use crate::git_pane::cli::git::git_text;
    let tracked = git_text(cwd, &["ls-files", "--error-unmatch", "--", path]).await;
    if matches!(tracked, Ok((true, _, _))) {
        return;
    }
    let _guard = crate::git_pane::lock::RepoLocks::global().acquire(cwd).await;
    let _ = git_text(cwd, &["-c", NO_HOOKS, "add", "-N", "--", path]).await;
}

pub async fn fetch_blame(
    cwd: &Path,
    source: &DiffSource,
    path: &str,
    sha: Option<&str>,
    to_sha: Option<&str>,
) -> Result<BlameResult, GitError> {
    use crate::git_pane::cli::git::git_text;
    let safe_path = assert_path_inside_repo(&cwd.to_string_lossy(), path)?;
    let (head, middle) = match source {
        DiffSource::Index => (
            vec![
                "blame".to_string(),
                "--line-porcelain".to_string(), "--no-textconv".to_string(),
                "--cached".to_string(),
            ],
            None,
        ),
        DiffSource::Commit => {
            let sha = checked_rev(sha.unwrap_or("HEAD"), "revision")?;
            (
                vec!["blame".to_string(), "--line-porcelain".to_string(), "--no-textconv".to_string()],
                Some(sha),
            )
        }
        DiffSource::Range => {
            let sha = checked_rev(to_sha.or(sha).unwrap_or("HEAD"), "revision")?;
            (
                vec!["blame".to_string(), "--line-porcelain".to_string(), "--no-textconv".to_string()],
                Some(sha),
            )
        }
        DiffSource::Worktree => (
            vec!["blame".to_string(), "--line-porcelain".to_string(), "--no-textconv".to_string()],
            None,
        ),
    };
    let mut args = head;
    // After --end-of-options blame no longer accepts `--`, so the path follows the rev directly.
    match middle {
        Some(rev) => {
            args.push(END_OF_OPTIONS.to_string());
            args.push(rev);
        }
        None => args.push("--".to_string()),
    }
    args.push(safe_path.clone());
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (ok, stdout, stderr) = git_text(cwd, &arg_refs).await?;
    if !ok {
        return Err(GitError::unknown(format!("git blame failed: {}", stderr.trim())));
    }
    Ok(BlameResult {
        path: safe_path.clone(),
        language: guess_language(&safe_path),
        lines: parse_blame_porcelain(&stdout),
    })
}

pub async fn fetch_file_history(
    cwd: &Path,
    path: &str,
    limit: usize,
) -> Result<FileHistoryResult, GitError> {
    use crate::git_pane::cli::git::git_text;
    let safe_path = assert_path_inside_repo(&cwd.to_string_lossy(), path)?;
    let limit_str = limit.to_string();
    let (_, stdout, _) = git_text(
        cwd,
        &[
            "log",
            "--follow",
            "--format=%H\x1f%s\x1f%an\x1f%at",
            "-n",
            &limit_str,
            "--",
            &safe_path,
        ],
    )
    .await?;
    Ok(FileHistoryResult {
        path: safe_path,
        entries: parse_file_history(&stdout),
    })
}

fn empty_conflict(path: &str, binary: bool) -> ConflictResult {
    ConflictResult {
        path: path.to_string(),
        binary,
        has_markers: false,
        blocks: Vec::new(),
        versions: ConflictVersions {
            base: None,
            ours: None,
            theirs: None,
        },
    }
}

async fn read_stage_version(cwd: &Path, stage: u8, path: &str) -> Option<String> {
    use crate::git_pane::cli::git::git_text;
    let spec = format!(":{stage}:{path}");
    match git_text(cwd, &["show", &spec]).await {
        Ok((true, stdout, _)) if !stdout.is_empty() => Some(stdout),
        _ => None,
    }
}

pub async fn fetch_conflict(cwd: &Path, path: &str) -> Result<ConflictResult, GitError> {
    let safe_path = assert_path_inside_repo(&cwd.to_string_lossy(), path)?;
    let full = cwd.join(&safe_path);
    match std::fs::metadata(&full) {
        Ok(meta) if meta.len() > 512 * 1024 => return Ok(empty_conflict(&safe_path, true)),
        Err(_) => return Ok(empty_conflict(&safe_path, false)),
        _ => {}
    }
    let content = match std::fs::read_to_string(&full) {
        Ok(c) => c,
        Err(_) => return Ok(empty_conflict(&safe_path, false)),
    };
    if content.contains('\0') {
        return Ok(empty_conflict(&safe_path, true));
    }
    let parsed = parse_conflict_markers(&content);
    let (base, ours, theirs) = tokio::join!(
        read_stage_version(cwd, 1, &safe_path),
        read_stage_version(cwd, 2, &safe_path),
        read_stage_version(cwd, 3, &safe_path),
    );
    Ok(ConflictResult {
        path: safe_path,
        binary: false,
        has_markers: parsed.has_markers,
        blocks: parsed.blocks,
        versions: ConflictVersions { base, ours, theirs },
    })
}

pub async fn fetch_commit_files(
    cwd: &Path,
    sha: &str,
) -> Result<Vec<WireWorkingTreeFile>, GitError> {
    use crate::git_pane::cli::git::git_text;
    let sha = checked_rev(sha, "revision")?;
    let sha = sha.as_str();
    let parents = commit_parents(cwd, sha).await?;
    let (tree_args, numstat_args): (Vec<String>, Vec<String>) = if parents.is_empty() {
        (
            vec![
                "diff-tree",
                "--root",
                "--no-commit-id",
                "--name-status",
                "-z",
                "-r",
                END_OF_OPTIONS,
                sha,
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
            vec![
                "diff-tree",
                "--root",
                "--no-commit-id",
                "--numstat", "--no-ext-diff", "--no-textconv",
                "-z",
                "-r",
                END_OF_OPTIONS,
                sha,
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
        )
    } else if parents.len() > 1 {
        // Merge: diff against the first parent only (same reference as GitKraken).
        (
            vec!["diff", "--name-status", "-z", END_OF_OPTIONS, &parents[0], sha]
                .into_iter()
                .map(|s: &str| s.to_string())
                .collect(),
            vec!["diff", "--numstat", "--no-ext-diff", "--no-textconv", "-z", END_OF_OPTIONS, &parents[0], sha]
                .into_iter()
                .map(|s: &str| s.to_string())
                .collect(),
        )
    } else {
        (
            vec![
                "diff-tree",
                "--no-commit-id",
                "--name-status",
                "-z",
                "-r",
                "-m",
                END_OF_OPTIONS,
                sha,
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
            vec![
                "diff-tree",
                "--no-commit-id",
                "--numstat", "--no-ext-diff", "--no-textconv",
                "-z",
                "-r",
                "-m",
                END_OF_OPTIONS,
                sha,
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
        )
    };
    let tree_refs: Vec<&str> = tree_args.iter().map(String::as_str).collect();
    let numstat_refs: Vec<&str> = numstat_args.iter().map(String::as_str).collect();
    let (name_status, numstat) =
        tokio::join!(git_text(cwd, &tree_refs), git_text(cwd, &numstat_refs));
    let (name_ok, name_status, name_err) = name_status?;
    let (numstat_ok, numstat, numstat_err) = numstat?;
    if !name_ok || !numstat_ok {
        return Err(GitError::unknown(format!(
            "git diff failed: {}",
            format!("{name_err}{numstat_err}").trim()
        )));
    }
    Ok(parse_commit_files(&name_status, &numstat))
}

pub async fn fetch_compare_files(
    cwd: &Path,
    from_sha: &str,
    to_sha: &str,
) -> Result<Vec<WireWorkingTreeFile>, GitError> {
    use crate::git_pane::cli::git::git_text;
    let from_sha = checked_rev(from_sha, "revision")?;
    let to_sha = checked_rev(to_sha, "revision")?;
    let tree_args = ["diff", "--name-status", "-z", END_OF_OPTIONS, &from_sha, &to_sha];
    let numstat_args = ["diff", "--numstat", "--no-ext-diff", "--no-textconv", "-z", END_OF_OPTIONS, &from_sha, &to_sha];
    let (name_status, numstat) =
        tokio::join!(git_text(cwd, &tree_args), git_text(cwd, &numstat_args));
    let (name_ok, name_status, name_err) = name_status?;
    let (numstat_ok, numstat, numstat_err) = numstat?;
    if !name_ok || !numstat_ok {
        return Err(GitError::unknown(format!(
            "git diff failed: {}",
            format!("{name_err}{numstat_err}").trim()
        )));
    }
    Ok(parse_commit_files(&name_status, &numstat))
}

pub async fn fetch_rebase_commits(cwd: &Path, base: &str) -> Result<RebaseCommitsResult, GitError> {
    use crate::git_pane::cli::git::{git_text, GitError};
    let base = base.trim();
    if base.is_empty() {
        return Err(GitError::unknown("No base ref specified.".to_string()));
    }
    let base = checked_rev(base, "base ref")?;
    let base = base.as_str();
    let (ok, short_out, _) =
        git_text(cwd, &["rev-parse", "--short", END_OF_OPTIONS, base]).await?;
    if !ok {
        return Err(GitError::unknown(format!(
            "Could not resolve base ref \"{base}\"."
        )));
    }
    let range = format!("{base}..HEAD");
    let (_, stdout, _) = git_text(
        cwd,
        &[
            "log",
            "--reverse",
            &format!("--format={REBASE_LOG_FORMAT}"),
            END_OF_OPTIONS,
            &range,
        ],
    )
    .await?;
    let commits = parse_rebase_commits(&stdout);
    if commits.is_empty() {
        return Err(GitError::unknown(format!(
            "No commits between {base} and HEAD."
        )));
    }
    Ok(RebaseCommitsResult {
        base: base.to_string(),
        base_short_sha: short_out.trim().to_string(),
        commits,
    })
}
