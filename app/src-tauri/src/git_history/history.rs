//! Per-file commit history (sync impl).

use std::path::Path;

use git2::{Commit, DiffOptions, Repository, Sort, Time};

use super::helpers::*;
use super::CommitMeta;

pub fn git_file_history_inner(
    folder: String,
    file_path: String,
    limit: u32,
) -> Result<Vec<CommitMeta>, String> {
    let repo = open_repo(&folder)?;
    let rel = rel_path(&repo, &file_path)
        .ok_or_else(|| format!("file is outside workspace: {}", file_path))?;

    // No HEAD yet → empty history (the file's never been committed).
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Ok(vec![]),
    };
    let head_oid = match head.target() {
        Some(o) => o,
        None => return Ok(vec![]),
    };

    let mut walk = repo.revwalk().map_err(|e| format!("revwalk: {}", e))?;
    walk.set_sorting(Sort::TIME).ok();
    walk.push(head_oid).map_err(|e| format!("revwalk push: {}", e))?;

    let mut out = Vec::with_capacity(limit as usize);
    let cap = if limit == 0 { 50 } else { limit } as usize;

    for oid in walk {
        let oid = match oid {
            Ok(o) => o,
            Err(_) => continue,
        };
        let commit = match repo.find_commit(oid) {
            Ok(c) => c,
            Err(_) => continue,
        };
        if !commit_touches_path(&repo, &commit, &rel) {
            continue;
        }
        out.push(commit_to_meta(&commit));
        if out.len() >= cap {
            break;
        }
    }
    Ok(out)
}

fn commit_to_meta(commit: &Commit<'_>) -> CommitMeta {
    let sha = commit.id().to_string();
    let short = if sha.len() >= 7 { sha[..7].to_string() } else { sha.clone() };
    let author = commit.author();
    let name = author.name().unwrap_or("?").to_string();
    let when: Time = author.when();
    CommitMeta {
        sha,
        short_sha: short,
        message: commit
            .summary()
            .map(|s| s.to_string())
            .unwrap_or_default(),
        author: name,
        time: when.seconds(),
    }
}

/// Did this commit's diff vs its first parent touch `rel`? For the root
/// commit (no parents) we treat every file in its tree as "touched".
fn commit_touches_path(repo: &Repository, commit: &Commit<'_>, rel: &str) -> bool {
    let tree = match commit.tree() {
        Ok(t) => t,
        Err(_) => return false,
    };
    if commit.parent_count() == 0 {
        return tree.get_path(Path::new(rel)).is_ok();
    }
    let parent = match commit.parent(0) {
        Ok(p) => p,
        Err(_) => return false,
    };
    let parent_tree = match parent.tree() {
        Ok(t) => t,
        Err(_) => return false,
    };
    let mut opts = DiffOptions::new();
    opts.pathspec(rel);
    let diff = match repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), Some(&mut opts)) {
        Ok(d) => d,
        Err(_) => return false,
    };
    diff.deltas().len() > 0
}
