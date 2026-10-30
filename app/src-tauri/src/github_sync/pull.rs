use super::*;

/// One-time master → main rewrite, shared by push AND pull (#147).
///
/// The init path (link_workspace) does this for fresh inits, but a vault
/// initialized on a different machine (or pre-v3.0 SoloMD) can still be on
/// `master`. Push has always normalized before pushing — which meant the
/// remote ends up with `main` — but pull used the raw local HEAD name, so a
/// second device stuck on `master` fetched the nonexistent `origin/master`
/// forever and never received the first device's pushes (issue #147).
///
/// Only safe to rename when:
///   - HEAD points at refs/heads/master (we are on master, not detached)
///   - There is no existing local `main` branch (otherwise the rename would
///     collide; user has explicitly created both)
///
/// After rename, HEAD follows the renamed branch automatically.
pub(super) fn normalize_master_to_main(repo: &Repository) {
    if let Ok(head_ref) = repo.find_reference("HEAD") {
        if head_ref.symbolic_target() == Some("refs/heads/master")
            && repo.find_branch("main", git2::BranchType::Local).is_err()
        {
            if let Ok(mut master) = repo.find_branch("master", git2::BranchType::Local) {
                let _ = master.rename("main", false);
            }
        }
    }
}

#[derive(Serialize)]
pub struct PullResult {
    /// "fast_forward" | "up_to_date" | "conflicts"
    pub kind: String,
    pub conflicts: Vec<String>,
}

/// Sync core for pull — exposed for integration tests.
///
/// When E2EE is enabled, this fetches/merges into the shadow dir as
/// usual and then runs `crypto_decrypt_after_pull` so the user's
/// plaintext working tree picks up remote edits.
pub fn github_pull_inner(folder: String, token: String) -> Result<PullResult, String> {
    let workspace = PathBuf::from(&folder);
    // Same fail-closed logic as github_push_inner: corrupted sync.json
    // must not be downgraded to "no encryption".
    let cfg = load_config(&workspace)?.unwrap_or_default();
    let path = git_dir(&workspace)?;
    // PR #24 file-watcher integration: a successful pull legitimately
    // rewrites many files. Open a 30s rewrite window so the watcher
    // doesn't pop the "external change" dialog for every file.
    super::super::watcher::mark_workspace_rewrite_window(&workspace);
    if cfg.encrypted {
        // First-pull bootstrap: when the user has linked an encrypted
        // remote but not yet entered the passphrase on this device,
        // skip the encrypt-then-commit step. The fetch+merge can still
        // happen — that's how the device learns the salt + ciphertext.
        // Decrypt is also skipped (see finalize_decrypt); the user
        // sets the passphrase, then we decrypt explicitly.
        if super::super::crypto::crypto_encrypt_for_push_inner(folder.clone()).is_ok() {
            commit_shadow_if_dirty(&path, "encrypted: workspace state at pull")?;
        }
    }
        let repo = Repository::open(&path).map_err(|e| e.to_string())?;
        // #147 — normalize the same way push does, or a device whose local
        // repo is still on libgit2's default `master` fetches the nonexistent
        // `origin/master` forever while every other device pushes to `main`.
        normalize_master_to_main(&repo);
        let head = repo.head().map_err(|e| e.to_string())?;
        let branch_name = head
            .shorthand()
            .ok_or_else(|| "HEAD is detached; cannot pull".to_string())?
            .to_string();

        // 1) Fetch. Legacy escape hatch: a remote that predates the
        // master→main normalization may only have `master` — if fetching
        // `main` yields no such remote ref, retry `master` and merge from
        // that (same lineage; the next push then creates `main` on the
        // remote). Note "yields no ref" ≠ fetch error: some transports
        // (https) fail the fetch of a missing branch outright, others
        // (file://, used by the integration tests) succeed silently and
        // just create nothing — so success is judged by the remote-tracking
        // ref existing afterwards, not by the fetch call's Result.
        let mut origin = repo.find_remote("origin").map_err(|e| e.to_string())?;
        let mut upstream_branch = branch_name.clone();
        let mut fetch_err: Option<String> = None;
        {
            let mut fetch_opts = FetchOptions::new();
            fetch_opts.remote_callbacks(make_callbacks(token.clone()));
            fetch_opts.proxy_options(make_proxy_options());
            fetch_opts.download_tags(AutotagOption::All);
            if let Err(e) = origin.fetch(&[&branch_name], Some(&mut fetch_opts), None) {
                fetch_err = Some(e.to_string());
            }
        }
        let ref_exists = |name: &str| {
            repo.find_reference(&format!("refs/remotes/origin/{name}"))
                .is_ok()
        };
        if !ref_exists(&upstream_branch) && branch_name == "main" {
            let mut retry_opts = FetchOptions::new();
            retry_opts.remote_callbacks(make_callbacks(token.clone()));
            retry_opts.proxy_options(make_proxy_options());
            retry_opts.download_tags(AutotagOption::All);
            let _ = origin.fetch(&["master"], Some(&mut retry_opts), None);
            if ref_exists("master") {
                upstream_branch = "master".to_string();
            }
        }
        if !ref_exists(&upstream_branch) {
            return Err(match fetch_err {
                Some(e) => format!("fetch failed: {}", e),
                None => format!(
                    "fetch found no '{}' branch on the remote (nor a legacy 'master')",
                    branch_name
                ),
            });
        }

        // 2) Look up the upstream ref we just fetched.
        let upstream_ref = repo
            .find_reference(&format!("refs/remotes/origin/{}", upstream_branch))
            .map_err(|e| e.to_string())?;
        let upstream_commit = repo
            .reference_to_annotated_commit(&upstream_ref)
            .map_err(|e| e.to_string())?;

        // 3) Decide what to do.
        let analysis = repo
            .merge_analysis(&[&upstream_commit])
            .map_err(|e| e.to_string())?;

        if analysis.0.is_up_to_date() {
            stamp_pull(&workspace);
            // No remote changes to decrypt back, but if E2EE is on and the
            // workspace had local edits we just committed in the shadow,
            // they're already in the shadow — no action needed.
            return Ok(PullResult {
                kind: "up_to_date".into(),
                conflicts: vec![],
            });
        }

        if analysis.0.is_fast_forward() {
            // FF: move HEAD to the upstream commit and check out the tree.
            let mut head_ref = repo
                .find_reference(&format!("refs/heads/{}", branch_name))
                .map_err(|e| e.to_string())?;
            let upstream_oid = upstream_commit.id();
            head_ref
                .set_target(upstream_oid, "fast-forward via SoloMD GitHub sync")
                .map_err(|e| e.to_string())?;
            repo.set_head(&format!("refs/heads/{}", branch_name))
                .map_err(|e| e.to_string())?;
            repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
                .map_err(|e| e.to_string())?;
            stamp_pull(&workspace);
            finalize_decrypt(&cfg, &workspace)?;
            return Ok(PullResult {
                kind: "fast_forward".into(),
                conflicts: vec![],
            });
        }

        // Diverged: try a normal merge. If it produces conflicts we
        // surface the list and stop — the writer-class user wants a UI,
        // not a bare merge marker file.
        let local_commit = repo
            .reference_to_annotated_commit(&head)
            .map_err(|e| e.to_string())?;
        repo.merge(&[&upstream_commit], None, None)
            .map_err(|e| format!("merge failed: {}", e))?;

        let mut index = repo.index().map_err(|e| e.to_string())?;
        if index.has_conflicts() {
            let conflicts: Vec<String> = index
                .conflicts()
                .into_iter()
                .flatten()
                .filter_map(|c| c.ok())
                .filter_map(|c| {
                    c.our
                        .as_ref()
                        .or(c.their.as_ref())
                        .or(c.ancestor.as_ref())
                        .map(|e| String::from_utf8_lossy(&e.path).to_string())
                })
                .collect();
            return Ok(PullResult {
                kind: "conflicts".into(),
                conflicts,
            });
        }

        // No conflicts — write the merge commit ourselves.
        let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
        let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;
        let local = repo
            .find_commit(local_commit.id())
            .map_err(|e| e.to_string())?;
        let upstream_real = repo
            .find_commit(upstream_commit.id())
            .map_err(|e| e.to_string())?;
        let sig = signature(&repo)?;
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            &format!("Merge branch 'origin/{}' into {}", upstream_branch, branch_name),
            &tree,
            &[&local, &upstream_real],
        )
        .map_err(|e| e.to_string())?;
    repo.cleanup_state().map_err(|e| e.to_string())?;
    stamp_pull(&workspace);
    finalize_decrypt(&cfg, &workspace)?;
    Ok(PullResult {
        kind: "merged".into(),
        conflicts: vec![],
    })
}

/// On every clean (non-conflicting) pull, mirror the freshly-fetched
/// shadow back to plaintext if E2EE is on. No-op for non-encrypted
/// vaults. Conflict path skips this — the user resolves on the shadow
/// side first.
pub(super) fn finalize_decrypt(cfg: &SyncConfig, workspace: &Path) -> Result<(), String> {
    if !cfg.encrypted {
        return Ok(());
    }
    // Bootstrap-tolerant: if the key isn't in the keyring yet (a
    // brand-new device that just pulled), don't fail the pull —
    // surface a soft-OK and let the frontend prompt for passphrase
    // post-pull, then call crypto_decrypt_after_pull explicitly.
    match super::super::crypto::crypto_decrypt_after_pull_inner(workspace.to_string_lossy().into_owned()) {
        Ok(()) => Ok(()),
        Err(e) if e.contains("key missing") || e.contains("not enabled") => Ok(()),
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub async fn github_pull(folder: String) -> Result<PullResult, String> {
    let path = PathBuf::from(&folder);
    let cfg = load_config(&path)?.unwrap_or_default();
    let token = match cfg.provider.as_str() {
        "gitea" => gitea_read_token()?.ok_or("no Gitea token set")?,
        _ => read_token()?.ok_or("no GitHub token set")?,
    };
    tauri::async_runtime::spawn_blocking(move || github_pull_inner(folder, token))
        .await
        .map_err(|e| e.to_string())?
}
