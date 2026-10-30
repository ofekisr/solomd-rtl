//! Async fetchers for refs, stashes, worktrees and the working tree.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use crate::git_pane::cli::git::{
    GitError, WireAuthor, WireBranch, WireCommit, WireRemote, WireStash, WireTag,
    WireWorkingTreeFile, WireWorktree,
};

use super::*;

pub async fn fetch_branches(
    cwd: &Path,
    favorites: &HashSet<String>,
) -> Result<Vec<WireBranch>, GitError> {
    use crate::git_pane::cli::git::git_text;
    let (ok, stdout, _) = git_text(
        cwd,
        &[
            "for-each-ref",
            &format!("--format={BRANCH_FORMAT}"),
            BRANCH_REFSPECS[0],
            BRANCH_REFSPECS[1],
            "--sort=-committerdate",
        ],
    )
    .await?;
    if !ok {
        return Err(GitError::unknown("git for-each-ref failed".to_string()));
    }
    Ok(parse_branches(&stdout, favorites))
}

pub async fn fetch_tags(cwd: &Path) -> Vec<WireTag> {
    use crate::git_pane::cli::git::git_text;
    match git_text(cwd, &["tag", "-l", &format!("--format={TAG_FORMAT}")]).await {
        Ok((true, stdout, _)) => parse_tags(&stdout),
        _ => Vec::new(),
    }
}

pub async fn fetch_remotes(cwd: &Path) -> Vec<WireRemote> {
    use crate::git_pane::cli::git::git_text;
    match git_text(cwd, &["remote", "-v"]).await {
        Ok((true, stdout, _)) => parse_remotes(&stdout),
        _ => Vec::new(),
    }
}

pub async fn fetch_stashes(cwd: &Path) -> Vec<WireStash> {
    use crate::git_pane::cli::git::git_text;
    let Ok((_, stdout, _)) =
        git_text(cwd, &["stash", "list", &format!("--format={STASH_FORMAT}")]).await
    else {
        return Vec::new();
    };
    let mut stashes = parse_stashes(&stdout);
    if stashes.is_empty() {
        return stashes;
    }
    // Resolve every stash's base (first parent) in a single `rev-parse`: it
    // prints one line per revision argument, in argument order, so the
    // selectors come back positionally. `--verify` cannot be used here — it
    // accepts exactly one revision — but nothing needs it: an unresolvable
    // selector makes that line echo the argument itself (or fail the whole
    // call), and either way `is_full_sha` rejects it and the base stays unset.
    let revs: Vec<String> = stashes.iter().map(|s| format!("{}^1", s.id)).collect();
    let mut args: Vec<&str> = vec!["rev-parse"];
    args.extend(revs.iter().map(String::as_str));
    if let Ok((_, out, _)) = git_text(cwd, &args).await {
        for (stash, line) in stashes.iter_mut().zip(out.lines()) {
            let sha = line.trim();
            if is_full_sha(sha) {
                stash.base_sha = Some(sha.to_string());
            }
        }
    }
    // Resolve each base's subject in one batch so the UI can explain a stash
    // whose base is outside the loaded commit window (pagination or a base
    // orphaned by amend/rebase). Looked up by sha, not by position: `git log
    // --no-walk` dedupes the revisions it is given and orders them by date.
    // Failures leave `base_subject` empty.
    let mut resolved: Vec<String> = stashes.iter().filter_map(|s| s.base_sha.clone()).collect();
    resolved.sort_unstable();
    resolved.dedup();
    if !resolved.is_empty() {
        let mut args: Vec<&str> = vec!["log", "--no-walk", "--format=%H%x00%s%x00"];
        args.extend(resolved.iter().map(String::as_str));
        if let Ok((true, subject_out, _)) = git_text(cwd, &args).await {
            let subjects = parse_sha_field(&subject_out);
            for stash in stashes.iter_mut() {
                if let Some(sha) = stash.base_sha.as_deref() {
                    if let Some(subject) = subjects.get(sha).filter(|s| !s.is_empty()) {
                        stash.base_subject = Some(subject.clone());
                    }
                }
            }
        }
    }
    stashes
}

/// Parses `git log --format=%H%x00<value>%x00` output into sha -> value.
/// Records are NUL-separated (`git log` puts a newline between them, which is
/// trimmed off the next sha), and the value is kept as its first trimmed line.
fn parse_sha_field(out: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let mut fields = out.split('\0');
    while let Some(sha_field) = fields.next() {
        let sha = sha_field.trim();
        let Some(value) = fields.next() else {
            break;
        };
        if is_full_sha(sha) {
            map.insert(sha.to_string(), value.trim().to_string());
        }
    }
    map
}

/// Base SHAs of `stashes` absent from `commits` (deduped, order kept).
/// These are bases outside the loaded window: orphaned by amend/rebase, or
/// deeper than the commit limit — the stashes GitKraken still anchors.
pub fn missing_stash_base_shas(commits: &[WireCommit], stashes: &[WireStash]) -> Vec<String> {
    let present: HashSet<&str> = commits.iter().map(|c| c.sha.as_str()).collect();
    let mut seen = HashSet::new();
    stashes
        .iter()
        .filter_map(|s| s.base_sha.as_deref())
        .filter(|sha| !present.contains(*sha))
        .filter(|sha| seen.insert(*sha))
        .map(str::to_string)
        .collect()
}

/// Fetch commit objects for stash bases missing from the loaded window so the
/// graph can anchor every stash onto its base (GitKraken parity). Returns the
/// extra commits flagged `is_stash_base` plus their authors. A failed lookup
/// (e.g. a pruned base) yields nothing — those stashes keep the floating
/// fallback with the base hint.
pub async fn fetch_missing_stash_bases(
    cwd: &Path,
    commits: &[WireCommit],
    stashes: &[WireStash],
) -> (Vec<WireCommit>, Vec<WireAuthor>) {
    use crate::git_pane::cli::git::git_text;
    use crate::git_pane::cli::log::{parse_commits, AuthorRegistry};
    let missing = missing_stash_base_shas(commits, stashes);
    if missing.is_empty() {
        return (Vec::new(), Vec::new());
    }
    let mut args: Vec<String> = vec![
        "log".to_string(),
        "--no-walk".to_string(),
        "--date=iso-strict".to_string(),
        format!("--format={}", crate::git_pane::cli::log::log_format()),
        "--decorate=full".to_string(),
    ];
    args.extend(missing);
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let Ok((ok, stdout, _)) = git_text(cwd, &arg_refs).await else {
        return (Vec::new(), Vec::new());
    };
    if !ok {
        return (Vec::new(), Vec::new());
    }
    let mut registry = AuthorRegistry::default();
    let mut bases = parse_commits(&stdout, &mut registry);
    for base in bases.iter_mut() {
        base.is_stash_base = true;
    }
    (bases, registry.all())
}

pub async fn fetch_worktrees(cwd: &Path, main_path: &Path) -> Vec<WireWorktree> {
    use crate::git_pane::cli::git::git_text;
    match git_text(cwd, &["worktree", "list", "--porcelain"]).await {
        Ok((_, stdout, _)) => parse_worktrees(&stdout, &main_path.to_string_lossy()),
        Err(_) => Vec::new(),
    }
}

pub async fn fetch_working_tree(cwd: &Path) -> Result<Vec<WireWorkingTreeFile>, GitError> {
    use crate::git_pane::cli::git::git_text;
    let (status_out, staged_out, unstaged_out) = tokio::join!(
        git_text(cwd, &["status", "--porcelain=v2", "-z", "-uall", "--ignore-submodules=dirty"]),
        git_text(cwd, &["diff", "--cached", "--numstat", "--no-ext-diff", "--no-textconv", "--ignore-submodules=dirty", "-z"]),
        git_text(cwd, &["diff", "--numstat", "--no-ext-diff", "--no-textconv", "--ignore-submodules=dirty", "-z"]),
    );
    let (ok, porcelain, _) = status_out?;
    if !ok {
        return Err(GitError::unknown("git status failed".to_string()));
    }
    let staged = staged_out
        .map(|(_, out, _)| parse_numstat(&out))
        .unwrap_or_default();
    let unstaged = unstaged_out
        .map(|(_, out, _)| parse_numstat(&out))
        .unwrap_or_default();
    Ok(parse_status(StatusInput {
        porcelain: &porcelain,
        staged: &staged,
        unstaged: &unstaged,
    }))
}
