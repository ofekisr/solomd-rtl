use super::*;

// ---------------------------------------------------------------------------
// Workspace ↔ remote linking
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct SyncConfig {
    pub remote_url: String,
    /// If true, every successful local commit triggers a `git push` to the
    /// remote. Default false so users opt in.
    pub auto_push: bool,
    /// Minutes between background `github_pull` calls. 0 = manual only.
    pub auto_pull_minutes: u32,
    /// Unix epoch seconds.
    pub last_push_at: Option<i64>,
    pub last_pull_at: Option<i64>,
    /// v2.6.3 — when true, push/pull operate on `<workspace>/.solomd-encrypted/`
    /// instead of the workspace itself, and we run encrypt-before-push +
    /// decrypt-after-pull around every sync. Old configs without this
    /// field deserialize to `false`, preserving v2.6.0/v2.6.1 behavior.
    #[serde(default)]
    pub encrypted: bool,
    /// v2.6.3 — provider hint stored for the UI ("github" / "gitea").
    /// libgit2 + PAT credentials work uniformly across providers.
    #[serde(default = "default_provider")]
    pub provider: String,
}

pub(super) fn default_provider() -> String {
    "github".into()
}

pub(super) const ENCRYPTED_SHADOW: &str = ".solomd-encrypted";

/// Resolve the directory the git repo actually lives in. With E2EE on
/// that's the encrypted shadow; otherwise it's the workspace itself.
///
/// Returns Err if sync.json is corrupted — refusing to guess is the
/// **only** safe behavior here. Treating "can't read config" as
/// "encryption off" used to silently push plaintext workspaces from
/// users who had E2EE enabled but whose config got truncated.
pub(super) fn git_dir(workspace: &Path) -> Result<PathBuf, String> {
    let cfg = load_config(workspace)?.unwrap_or_default();
    Ok(if cfg.encrypted {
        workspace.join(ENCRYPTED_SHADOW)
    } else {
        workspace.to_path_buf()
    })
}

pub(super) fn config_path(workspace: &Path) -> PathBuf {
    workspace.join(SYNC_CONFIG_FILE)
}

pub(super) fn load_config(workspace: &Path) -> Result<Option<SyncConfig>, String> {
    let path = config_path(workspace);
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map(Some).map_err(|e| e.to_string())
}

pub(super) fn save_config(workspace: &Path, cfg: &SyncConfig) -> Result<(), String> {
    let path = config_path(workspace);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let body = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(&path, body).map_err(|e| e.to_string())
}

/// Ensure `.solomd/` is in the workspace's git ignore list. Each device
/// has its own sync.json (different timestamps, possibly different remote
/// URL across forks), so committing it would produce a conflict on
/// every pull. Idempotent — safe to call before every push.
pub(super) fn ensure_gitignore_excludes_solomd(workspace: &Path) -> Result<(), String> {
    let gitignore = workspace.join(".gitignore");
    let existing = fs::read_to_string(&gitignore).unwrap_or_default();
    if existing
        .lines()
        .any(|l| l.trim() == ".solomd/" || l.trim() == ".solomd")
    {
        return Ok(());
    }
    let mut new = existing;
    if !new.is_empty() && !new.ends_with('\n') {
        new.push('\n');
    }
    new.push_str("# SoloMD workspace metadata — per-device, do not sync.\n");
    new.push_str(".solomd/\n");
    fs::write(&gitignore, new).map_err(|e| e.to_string())
}

pub(super) fn open_or_init_repo(workspace: &Path) -> Result<Repository, String> {
    if let Ok(repo) = Repository::open(workspace) {
        return Ok(repo);
    }
    // First link — initialize the repo so the user doesn't have to do it
    // manually. AutoGit usually beats us to this, but defending against
    // the case where AutoGit was off when sync was set up.
    Repository::init(workspace).map_err(|e| format!("git init failed: {}", e))
}
