//! Repository snapshot assembly.

use super::*;

#[derive(Debug, Clone)]
pub struct SnapshotOptions {
    pub commit_limit: usize,
    pub graph_all: bool,
    pub with_commits: bool,
    pub with_branches: bool,
    pub with_tags: bool,
    pub with_stashes: bool,
    pub with_worktrees: bool,
    pub with_status: bool,
}

impl SnapshotOptions {
    #[cfg(test)]
    pub(super) fn empty_lists() -> Self {
        Self {
            commit_limit: 100,
            graph_all: true,
            with_commits: false,
            with_branches: false,
            with_tags: false,
            with_stashes: false,
            with_worktrees: false,
            with_status: false,
        }
    }
}

/// Full snapshot: metadata + scoped lists. Absent scopes (or unknown shapes)
/// default to a full snapshot, mirroring `snapshotInner`.
/// Builds a snapshot for an already-validated repository, letting callers that
/// resolved `RepoInfo` themselves (and cached it for later tab switches) skip
/// the validation spawns entirely.
pub async fn build_snapshot_with_info(
    info: &RepoInfo,
    opts: &SnapshotOptions,
    favorites: &std::collections::HashSet<String>,
) -> Result<WireSnapshot, GitError> {
    let cwd = info.path.clone();

    let (commits_out, branches_out, working_tree_out) = tokio::join!(
        async {
            if opts.with_commits {
                crate::git_pane::cli::log::fetch_commit_log(&cwd, opts.commit_limit, opts.graph_all, None, 0)
                    .await
                    .map(Some)
            } else {
                Ok(None)
            }
        },
        async {
            if opts.with_branches {
                crate::git_pane::cli::refs::fetch_branches(&cwd, favorites).await.map(Some)
            } else {
                Ok(None)
            }
        },
        async {
            if opts.with_status {
                crate::git_pane::cli::refs::fetch_working_tree(&cwd).await.map(Some)
            } else {
                Ok(None)
            }
        },
    );
    let bundle = commits_out?;
    let branches = branches_out?.unwrap_or_default();
    let working_tree = working_tree_out?.unwrap_or_default();

    let (tags, stashes, worktrees, remotes, head, identity) = tokio::join!(
        async {
            if opts.with_tags {
                crate::git_pane::cli::refs::fetch_tags(&cwd).await
            } else {
                Vec::new()
            }
        },
        async {
            // Stash bases are also needed when loading commits: missing bases
            // are backfilled below so every stash anchors onto its base.
            if opts.with_stashes || opts.with_commits {
                crate::git_pane::cli::refs::fetch_stashes(&cwd).await
            } else {
                Vec::new()
            }
        },
        async {
            if opts.with_worktrees {
                crate::git_pane::cli::refs::fetch_worktrees(&cwd, &cwd).await
            } else {
                Vec::new()
            }
        },
        crate::git_pane::cli::refs::fetch_remotes(&cwd),
        async {
            // Branch label and full sha need separate `rev-parse` calls
            // (options apply to every revision argument), but they are
            // independent, so they share one round-trip.
            tokio::join!(
                git_text(&cwd, &["rev-parse", "--abbrev-ref", "HEAD"]),
                git_text(&cwd, &["rev-parse", "HEAD"]),
            )
        },
        // One spawn for both config keys instead of two.
        git_text(&cwd, &["config", "--get-regexp", "^user\\.(name|email)$"]),
    );

    let (branch_res, head_res) = head;
    let (_, branch_out, _) = branch_res?;
    let branch = branch_out.trim();
    let detached = branch == "HEAD" || branch.is_empty();
    let current_branch = if detached {
        "(detached)".to_string()
    } else {
        branch.to_string()
    };
    let (head_ok, head_out, _) = head_res?;
    let head_sha = if head_ok {
        head_out.trim().to_string()
    } else {
        String::new()
    };
    // `--get-regexp` prints `user.name <value>` / `user.email <value>` in
    // config precedence order, so the last occurrence wins.
    let (_, identity_out, _) = identity?;
    let mut name = String::new();
    let mut email = String::new();
    for line in identity_out.lines() {
        if let Some(value) = line.strip_prefix("user.name ") {
            name = value.trim().to_string();
        } else if let Some(value) = line.strip_prefix("user.email ") {
            email = value.trim().to_string();
        }
    }
    let mut identity_registry = crate::git_pane::cli::log::AuthorRegistry::default();
    let commit_author = identity_registry.resolve(&name, &email);
    let remote_url = remotes
        .iter()
        .find(|r| r.name == "origin")
        .map(|r| {
            if !r.fetch_url.is_empty() {
                r.fetch_url.clone()
            } else {
                r.push_url.clone()
            }
        })
        .unwrap_or_default();
    let state = crate::git_pane::cli::refs::read_repo_state(&info.git_dir);
    let (mut commits, mut authors, page) = match bundle {
        Some(b) => (
            b.commits,
            b.authors,
            CommitPageInfo {
                oldest_sha: b.oldest_sha,
                has_more: b.has_more,
                total: None,
            },
        ),
        None => (
            Vec::new(),
            Vec::new(),
            CommitPageInfo {
                oldest_sha: None,
                has_more: false,
                total: Some(0),
            },
        ),
    };
    if opts.with_commits {
        // Backfill stash bases missing from the loaded window (orphaned by
        // amend/rebase, or deeper than the limit) so stashes anchor onto
        // their base like GitKraken instead of floating at the top.
        // `page.oldest_sha` stays the window edge, keeping pagination intact.
        let (mut bases, base_authors) =
            crate::git_pane::cli::refs::fetch_missing_stash_bases(&cwd, &commits, &stashes).await;
        if !bases.is_empty() {
            let mut known: std::collections::HashSet<String> =
                authors.iter().map(|a| a.email.to_lowercase()).collect();
            for author in base_authors {
                if known.insert(author.email.to_lowercase()) {
                    authors.push(author);
                }
            }
            commits.append(&mut bases);
        }
    }
    let snapshot_stashes = if opts.with_stashes {
        stashes
    } else {
        Vec::new()
    };
    Ok(WireSnapshot {
        repository: WireRepository {
            name: repo_name_from_path(&info.path),
            path: info.path.to_string_lossy().into_owned(),
            git_version: info.git_version.clone(),
            current_branch,
            detached,
            head_sha,
            ahead: 0,
            behind: 0,
            remote_url,
            remotes,
            state,
            can_undo: false,
            can_redo: false,
            undo_label: None,
            redo_label: None,
        },
        commits,
        page,
        branches,
        tags,
        stashes: snapshot_stashes,
        worktrees,
        working_tree,
        authors,
        commit_author,
    })
}
