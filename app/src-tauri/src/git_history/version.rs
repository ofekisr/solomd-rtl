//! Per-file diff, content-at-version and rollback (sync impls).

use std::fs;
use std::path::Path;

use git2::{DiffFormat, DiffOptions, Oid};

use super::helpers::*;
use super::{DiffHunk, DiffLine, DiffResult};

pub fn git_file_diff_inner(
    folder: String,
    file_path: String,
    sha: String,
) -> Result<DiffResult, String> {
    let repo = open_repo(&folder)?;
    let rel = rel_path(&repo, &file_path)
        .ok_or_else(|| format!("file is outside workspace: {}", file_path))?;

    let oid = Oid::from_str(&sha).map_err(|e| format!("bad sha: {}", e))?;
    let commit = repo.find_commit(oid).map_err(|e| format!("find_commit: {}", e))?;
    let tree = commit.tree().map_err(|e| format!("tree: {}", e))?;
    let parent_tree = match commit.parent(0).ok().map(|p| p.tree()) {
        Some(Ok(t)) => Some(t),
        _ => None,
    };
    let from_sha = commit.parent(0).ok().map(|p| p.id().to_string());

    let mut opts = DiffOptions::new();
    opts.pathspec(&rel).context_lines(3);
    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))
        .map_err(|e| format!("diff: {}", e))?;

    // Build structured hunks AND a textual unified diff in one pass.
    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut unified = String::new();
    diff.print(DiffFormat::Patch, |_delta, hunk, line| {
        // Append the raw textual form.
        let origin = line.origin();
        if matches!(origin, '+' | '-' | ' ') {
            unified.push(origin);
        }
        if let Ok(s) = std::str::from_utf8(line.content()) {
            unified.push_str(s);
        }

        // Keep our hunks vector in sync.
        if let Some(h) = hunk {
            // Open a new hunk if this is the first line, or the hunk header
            // doesn't match the last open hunk.
            let need_new = match hunks.last() {
                Some(last) => {
                    last.old_start != h.old_start()
                        || last.new_start != h.new_start()
                        || last.old_lines != h.old_lines()
                        || last.new_lines != h.new_lines()
                }
                None => true,
            };
            if need_new {
                hunks.push(DiffHunk {
                    old_start: h.old_start(),
                    old_lines: h.old_lines(),
                    new_start: h.new_start(),
                    new_lines: h.new_lines(),
                    lines: Vec::new(),
                });
            }
        }
        // Don't add file/hunk headers to structured output — only +/-/space.
        if matches!(origin, '+' | '-' | ' ') {
            if let Some(cur) = hunks.last_mut() {
                let kind = match origin {
                    '+' => "add",
                    '-' => "remove",
                    _ => "context",
                };
                let text = std::str::from_utf8(line.content())
                    .unwrap_or("")
                    .trim_end_matches('\n')
                    .to_string();
                cur.lines.push(DiffLine {
                    kind: kind.to_string(),
                    text,
                });
            }
        }
        true
    })
    .map_err(|e| format!("diff print: {}", e))?;

    Ok(DiffResult {
        from_sha,
        to_sha: sha,
        hunks,
        unified,
    })
}

pub fn git_file_at_version_inner(
    folder: String,
    file_path: String,
    sha: String,
) -> Result<String, String> {
    let repo = open_repo(&folder)?;
    let rel = rel_path(&repo, &file_path)
        .ok_or_else(|| format!("file is outside workspace: {}", file_path))?;

    let oid = Oid::from_str(&sha).map_err(|e| format!("bad sha: {}", e))?;
    let commit = repo.find_commit(oid).map_err(|e| format!("find_commit: {}", e))?;
    let tree = commit.tree().map_err(|e| format!("tree: {}", e))?;
    let entry = tree
        .get_path(Path::new(&rel))
        .map_err(|e| format!("file not in commit: {}", e))?;
    let object = entry
        .to_object(&repo)
        .map_err(|e| format!("to_object: {}", e))?;
    let blob = object
        .as_blob()
        .ok_or_else(|| format!("not a blob: {}", rel))?;
    Ok(String::from_utf8_lossy(blob.content()).to_string())
}

pub fn git_rollback_file_inner(
    folder: String,
    file_path: String,
    sha: String,
) -> Result<(), String> {
    let content = git_file_at_version_inner(folder.clone(), file_path.clone(), sha)?;
    fs::write(Path::new(&file_path), content).map_err(|e| format!("write: {}", e))?;
    Ok(())
}
