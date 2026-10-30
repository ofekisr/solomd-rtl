use super::*;

#[tauri::command]
pub async fn github_link_workspace(
    folder: String,
    remote_url: String,
    encrypted: Option<bool>,
    provider: Option<String>,
) -> Result<SyncConfig, String> {
    if folder.is_empty() || remote_url.is_empty() {
        return Err("folder and remote_url are required".into());
    }
    let encrypted = encrypted.unwrap_or(false);
    let provider = provider.unwrap_or_else(default_provider);
    tauri::async_runtime::spawn_blocking(move || -> Result<SyncConfig, String> {
        let path = PathBuf::from(&folder);
        // The git repo lives in the shadow when E2EE is on, otherwise in
        // the workspace itself. The init also creates the shadow dir on
        // demand so the first push has somewhere to mirror into.
        let repo_dir = if encrypted {
            let s = path.join(ENCRYPTED_SHADOW);
            fs::create_dir_all(&s).map_err(|e| e.to_string())?;
            s
        } else {
            path.clone()
        };
        let repo = open_or_init_repo(&repo_dir)?;
        if repo.find_remote("origin").is_ok() {
            repo.remote_delete("origin").map_err(|e| e.to_string())?;
        }
        repo.remote("origin", &remote_url).map_err(|e| e.to_string())?;

        let cfg = SyncConfig {
            remote_url: remote_url.clone(),
            auto_push: true,
            auto_pull_minutes: 5,
            last_push_at: None,
            last_pull_at: None,
            encrypted,
            provider,
        };
        save_config(&path, &cfg)?;
        // .solomd/ holds per-device state — never committed.
        // .solomd-encrypted/ is the shadow git repo when E2EE is on —
        // never committed into the workspace's own (optional AutoGit)
        // history, otherwise a local AutoGit pass would scoop up the
        // ciphertext mirror as duplicate noise.
        ensure_gitignore_excludes_solomd(&path)?;
        Ok(cfg)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Update `auto_push` and `auto_pull_minutes` without re-linking. Used by
/// the Settings UI when the user flips the toggles. Preserves
/// `last_push_at` / `last_pull_at` so the "last synced N min ago" label
/// doesn't reset.
#[tauri::command]
pub async fn github_set_config(
    folder: String,
    auto_push: bool,
    auto_pull_minutes: u32,
) -> Result<SyncConfig, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<SyncConfig, String> {
        let path = PathBuf::from(&folder);
        let mut cfg = load_config(&path)?
            .ok_or("workspace not linked")?;
        cfg.auto_push = auto_push;
        cfg.auto_pull_minutes = auto_pull_minutes;
        save_config(&path, &cfg)?;
        Ok(cfg)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// v3.0 — turn an already-linked, currently-plaintext workspace into an
/// E2EE workspace, in one shot. The user's mental model: "I'm using
/// GitHub sync, I want to encrypt it now."
///
/// Order of operations matters because we want this to be safe to retry
/// if any step fails:
/// 1. Sets the passphrase via `crypto_set_passphrase` (idempotent if
///    the same passphrase is used; refuses on mismatch).
/// 2. Initialises the encrypted shadow at `<workspace>/.solomd-encrypted/`
///    with the same `origin` URL the workspace was linked to.
/// 3. Runs `crypto_encrypt_for_push` to populate the shadow.
/// 4. Stages + commits in the shadow.
/// 5. Flips `encrypted: true` in sync.json (so `git_dir()` now points
///    at the shadow).
/// 6. **Force-pushes** to the remote — this overwrites the plaintext
///    history with the encrypted one. Without force, the plaintext
///    commits would still be reachable on the remote forever; with
///    force, they're orphaned and become unreachable (modulo GitHub's
///    internal backup retention which is opaque to us).
///
/// The caller is expected to surface a confirmation dialog explaining
/// the force-push to the user before invoking. This command does not
/// re-confirm; it's a power-user action.
#[tauri::command]
pub async fn github_enable_encryption(
    folder: String,
    passphrase: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let path = PathBuf::from(&folder);
        let cfg = load_config(&path)?
            .ok_or("workspace is not linked to a remote")?;
        if cfg.encrypted {
            return Err("workspace is already encrypted".into());
        }
        let remote_url = cfg.remote_url.clone();
        if remote_url.is_empty() {
            return Err("workspace has no remote URL".into());
        }
        let token = match cfg.provider.as_str() {
            "gitea" => gitea_read_token()?.ok_or("no Gitea token set")?,
            _ => read_token()?.ok_or("no GitHub token set")?,
        };

        // 1. Set passphrase (also writes shadow salt + workspace metadata
        //    + keychain entry + marker file via crypto.rs side effects).
        super::super::crypto::crypto_set_passphrase(folder.clone(), passphrase)?;

        // 2. Initialise the shadow as a fresh git repo with the same
        //    origin URL. The previous workspace .git/ keeps its origin
        //    too, but `git_dir()` will route all sync ops to the shadow
        //    once we flip `encrypted: true` below.
        let shadow = path.join(ENCRYPTED_SHADOW);
        fs::create_dir_all(&shadow).map_err(|e| e.to_string())?;
        let shadow_repo = if Repository::open(&shadow).is_ok() {
            // Possible if user retried; reuse it.
            Repository::open(&shadow).map_err(|e| e.to_string())?
        } else {
            Repository::init(&shadow).map_err(|e| e.to_string())?
        };
        if shadow_repo.find_remote("origin").is_ok() {
            shadow_repo
                .remote_delete("origin")
                .map_err(|e| e.to_string())?;
        }
        shadow_repo
            .remote("origin", &remote_url)
            .map_err(|e| e.to_string())?;
        // Default-branch fix (libgit2 still ships HEAD pointing at master
        // on init; force it to main so the upstream branch matches).
        if let Ok(head) = shadow_repo.find_reference("HEAD") {
            if head.symbolic_target() == Some("refs/heads/master") {
                shadow_repo
                    .reference_symbolic("HEAD", "refs/heads/main", true, "switch to main")
                    .map_err(|e| e.to_string())?;
            }
        }
        // Local .gitignore inside the shadow — the shadow's own `.solomd/`
        // metadata (in case anyone ever drops one there) shouldn't be
        // committed to the encrypted repo.
        let shadow_gi = shadow.join(".gitignore");
        if !shadow_gi.exists() {
            fs::write(&shadow_gi, ".solomd/\n").map_err(|e| e.to_string())?;
        }
        drop(shadow_repo);

        // 3 + 4. Encrypt the workspace into the shadow, commit.
        super::super::crypto::crypto_encrypt_for_push_inner(folder.clone())?;
        commit_shadow_if_dirty(&shadow, "encrypted: enable end-to-end encryption")?;

        // 5. Flip the bit. `git_dir()` reads this on every subsequent
        //    sync call, so all push/pull ops go to the shadow from now on.
        let mut new_cfg = cfg;
        new_cfg.encrypted = true;
        save_config(&path, &new_cfg)?;

        // 6. Force-push the encrypted main onto the remote, replacing
        //    the plaintext history. The leading `+` in the refspec is
        //    libgit2's force flag.
        let repo = Repository::open(&shadow).map_err(|e| e.to_string())?;
        let mut origin = repo.find_remote("origin").map_err(|e| e.to_string())?;
        let head = repo.head().map_err(|e| e.to_string())?;
        let branch_name = head
            .shorthand()
            .ok_or_else(|| "shadow HEAD detached after init".to_string())?;
        let refspec = format!("+refs/heads/{0}:refs/heads/{0}", branch_name);
        let mut opts = PushOptions::new();
        opts.remote_callbacks(make_callbacks(token));
        opts.proxy_options(make_proxy_options());
        origin
            .push(&[refspec.as_str()], Some(&mut opts))
            .map_err(|e| format!("force push failed: {}", e))?;

        if let Ok(Some(mut cfg2)) = load_config(&path) {
            cfg2.last_push_at = Some(now_secs());
            let _ = save_config(&path, &cfg2);
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn github_unlink_workspace(folder: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let path = PathBuf::from(&folder);
        let repo_dir = git_dir(&path)?;
        if let Ok(repo) = Repository::open(&repo_dir) {
            let _ = repo.remote_delete("origin");
        }
        let cfg_path = config_path(&path);
        if cfg_path.exists() {
            fs::remove_file(cfg_path).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
