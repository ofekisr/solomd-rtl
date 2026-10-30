use super::*;

/// In a repo, stage every change in the working tree and commit. No-op
/// if there's nothing to commit. Used by E2EE push/pull to keep the
/// shadow's git history advancing as the user edits the workspace.
pub(super) fn commit_shadow_if_dirty(repo_dir: &Path, message: &str) -> Result<(), String> {
    let repo = Repository::open(repo_dir).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    let parent_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    if let Some(ref p) = parent_commit {
        if p.tree_id() == tree_oid {
            return Ok(()); // nothing to do
        }
    }
    let sig = signature(&repo)?;
    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();
    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Sync core for push — exposed so integration tests can drive it
/// against a `file://` remote without touching the OS keychain.
///
/// When E2EE is enabled, this runs `crypto_encrypt_for_push` first so
/// the shadow dir holds fresh ciphertext, then commits and pushes from
/// the shadow's git repo. Plaintext never reaches the remote.
pub fn github_push_inner(
    folder: String,
    token: String,
    commit_message: Option<String>,
) -> Result<(), String> {
    let path = PathBuf::from(&folder);
    let cfg = load_config(&path)?.unwrap_or_default();
    let repo_dir = git_dir(&path)?;
    if cfg.encrypted {
        super::super::crypto::crypto_encrypt_for_push_inner(folder.clone())?;
        let msg = commit_message
            .clone()
            .unwrap_or_else(|| "encrypted: workspace state at push".to_string());
        commit_shadow_if_dirty(&repo_dir, &msg)?;
    } else if let Some(msg) = commit_message {
        super::super::git_history::git_auto_commit_inner(folder.clone(), None, Some(msg))?;
    }
    let repo = Repository::open(&repo_dir).map_err(|e| e.to_string())?;

    normalize_master_to_main(&repo);

    let mut origin = repo.find_remote("origin").map_err(|e| e.to_string())?;

    // Push the current HEAD branch's local ref to the same ref name on
    // the remote.
    let head = repo.head().map_err(|e| e.to_string())?;
    let branch_name = head
        .shorthand()
        .ok_or_else(|| "HEAD is detached; cannot push".to_string())?;
    let refspec = format!("refs/heads/{0}:refs/heads/{0}", branch_name);

    let mut opts = PushOptions::new();
    opts.remote_callbacks(make_callbacks(token));
    opts.proxy_options(make_proxy_options());
    origin.push(&[refspec.as_str()], Some(&mut opts)).map_err(|e| {
        let msg = e.message();
        if msg.contains("protected branch")
            || msg.contains("refusing to allow")
            || msg.contains("pre-receive hook")
        {
            format!(
                "Protected branch on remote. Create a Pull Request instead. Details: {}",
                msg
            )
        } else if msg.contains("non-fast-forward") {
            "Remote has newer commits. Pull first, then push again.".into()
        } else {
            format!("push failed: {}", msg)
        }
    })?;

    // Stamp the config with the last successful push.
    if let Ok(Some(mut cfg)) = load_config(&path) {
        cfg.last_push_at = Some(now_secs());
        let _ = save_config(&path, &cfg);
    }
    Ok(())
}

#[tauri::command]
pub async fn github_push(
    folder: String,
    commit_message: Option<String>,
) -> Result<(), String> {
    let path = PathBuf::from(&folder);
    let cfg = load_config(&path)?.unwrap_or_default();
    let token = match cfg.provider.as_str() {
        "gitea" => gitea_read_token()?.ok_or("no Gitea token set")?,
        _ => read_token()?.ok_or("no GitHub token set")?,
    };
    tauri::async_runtime::spawn_blocking(move || github_push_inner(folder, token, commit_message))
        .await
        .map_err(|e| e.to_string())?
}
