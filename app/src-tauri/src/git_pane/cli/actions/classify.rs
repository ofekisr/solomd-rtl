// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;

/// Mirrors `classifyGitError` in `shared/git/errors.ts`: first non-empty
/// stderr line becomes the message, keywords pick the code.
pub fn classify_git_error(stderr: &str, exit_code: Option<i32>) -> GitError {
    let text = stderr.trim();
    let lower = text.to_lowercase();
    let first_line = text
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .unwrap_or("");
    let detail = if first_line.is_empty() {
        None
    } else {
        Some(first_line.to_string())
    };
    let make = |code: &str| {
        let message = if first_line.is_empty() {
            "An unexpected Git error occurred.".to_string()
        } else {
            first_line.to_string()
        };
        GitError::classified(code, message, detail.clone(), None)
    };
    if lower.contains("could not read username")
        || lower.contains("authentication failed")
        || lower.contains("permission denied (publickey)")
        || lower.contains("host key verification failed")
    {
        return make("Authentication");
    }
    if lower.contains("conflict")
        && (lower.contains("merge")
            || lower.contains("automatic")
            || lower.contains("cherry-pick")
            || lower.contains("rebase"))
    {
        let mut err = make("MergeConflict");
        err.files = Some(extract_conflict_files(text));
        return err;
    }
    if lower.contains("nothing to commit") || lower.contains("no changes added to commit") {
        return make("NothingToCommit");
    }
    if lower.contains("rejected") && lower.contains("non-fast-forward") {
        return make("RemoteRejected");
    }
    if lower.contains("failed to push") {
        return make("RemoteRejected");
    }
    if lower.contains("could not resolve host")
        || lower.contains("connection timed out")
        || lower.contains("network is unreachable")
    {
        return make("Network");
    }
    if lower.contains("would be overwritten")
        || lower.contains("your local changes")
        || lower.contains("please commit your changes or stash")
    {
        return make("DirtyWorktree");
    }
    if lower.contains("not a git repository") {
        return make("NotARepository");
    }
    let mut err = if first_line.is_empty() {
        GitError::unknown("An unexpected Git error occurred.".to_string())
    } else {
        GitError::unknown(first_line.to_string())
    };
    err.detail = exit_code.map(|c| format!("git exited with code {c}"));
    err
}

pub(super) fn extract_conflict_files(text: &str) -> Vec<String> {
    let mut files = Vec::new();
    for line in text.lines() {
        // `CONFLICT (content): Merge conflict in <path>` / `Auto-merging <path>`
        if let Some(rest) = line.strip_prefix("CONFLICT") {
            if let Some(idx) = rest.find("Merge conflict in ") {
                files.push(rest[idx + "Merge conflict in ".len()..].trim().to_string());
            }
        } else if let Some(rest) = line.strip_prefix("Auto-merging ") {
            files.push(rest.trim().to_string());
        }
    }
    files
}

pub(super) fn is_lfs_missing(message: &str) -> bool {
    let m = message.to_lowercase();
    m.contains("not a git command")
        || m.match_indices("lfs")
            .any(|(i, _)| m[i..].contains("not found"))
}

pub(super) fn lfs_error(error: GitError) -> GitError {
    if is_lfs_missing(&error.message) {
        GitError::unknown("Git LFS is not installed. Install git-lfs, then retry.".to_string())
    } else {
        error
    }
}

