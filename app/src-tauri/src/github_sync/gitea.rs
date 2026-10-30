use super::*;

// ---------------------------------------------------------------------------
// Gitea token storage (OS keychain via `keyring`) — separate service name
// so users can keep different PATs for GitHub and Gitea.
// ---------------------------------------------------------------------------

pub(super) const KEYRING_SERVICE_GITEA: &str = "solomd-gitea";

pub(super) static GITEA_TOKEN_CACHE: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

pub(super) fn gitea_keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE_GITEA, KEYRING_USER).map_err(|e| e.to_string())
}

pub(super) fn gitea_token_marker_path() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(std::path::PathBuf::from))
        .map(|h| h.join(".solomd").join("gitea-token-set"))
}

pub(super) fn gitea_write_token_marker() {
    if let Some(p) = gitea_token_marker_path() {
        if let Some(parent) = p.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(&p, b"1");
    }
}

pub(super) fn gitea_remove_token_marker() {
    if let Some(p) = gitea_token_marker_path() {
        let _ = std::fs::remove_file(&p);
    }
}

pub(super) fn gitea_read_token() -> Result<Option<String>, String> {
    if let Ok(guard) = GITEA_TOKEN_CACHE.lock() {
        if let Some(s) = guard.as_ref() {
            return Ok(Some(s.clone()));
        }
    }
    let entry = gitea_keyring_entry()?;
    let token = match entry.get_password() {
        Ok(s) => Some(s),
        Err(keyring::Error::NoEntry) => None,
        Err(e) => return Err(e.to_string()),
    };
    if let (Ok(mut guard), Some(t)) = (GITEA_TOKEN_CACHE.lock(), token.as_ref()) {
        *guard = Some(t.clone());
    }
    Ok(token)
}

#[tauri::command]
pub fn gitea_set_token(token: String) -> Result<(), String> {
    let trimmed = token.trim().to_string();
    if trimmed.is_empty() {
        return Err("token is empty".into());
    }
    let entry = gitea_keyring_entry()?;
    entry.set_password(&trimmed).map_err(|e| e.to_string())?;
    if let Ok(mut guard) = GITEA_TOKEN_CACHE.lock() {
        *guard = Some(trimmed);
    }
    gitea_write_token_marker();
    Ok(())
}

#[tauri::command]
pub fn gitea_clear_token() -> Result<(), String> {
    let entry = gitea_keyring_entry()?;
    let r = match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    };
    if let Ok(mut guard) = GITEA_TOKEN_CACHE.lock() {
        *guard = None;
    }
    gitea_remove_token_marker();
    r
}

#[tauri::command]
pub fn gitea_has_token() -> Result<bool, String> {
    Ok(gitea_token_marker_path().map(|p| p.exists()).unwrap_or(false))
}


// ---------------------------------------------------------------------------
// Gitea instance URL (global setting) — used for Gitea API calls before
// linking. Stored as a single-line URL in ~/.solomd/gitea-url. Empty or
// missing = no Gitea instance configured.
// ---------------------------------------------------------------------------

pub(super) fn gitea_url_path() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
        .map(|h| h.join(".solomd").join("gitea-url"))
}

pub(super) fn read_gitea_url() -> Option<String> {
    let p = gitea_url_path()?;
    let raw = fs::read_to_string(&p).ok()?;
    let trimmed = raw.trim().to_string();
    if trimmed.is_empty() { None } else { Some(trimmed) }
}

#[tauri::command]
pub fn gitea_get_url() -> Result<String, String> {
    Ok(read_gitea_url().unwrap_or_default())
}

#[tauri::command]
pub fn gitea_set_url(url: String) -> Result<(), String> {
    let p = gitea_url_path().ok_or("no HOME directory")?;
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let trimmed = url.trim().to_string();
    // Strip trailing slash for consistency.
    let cleaned = trimmed.trim_end_matches('/').to_string();
    fs::write(&p, &cleaned).map_err(|e| e.to_string())
}

/// Validate that a URL points to a live Gitea instance by hitting
/// GET /api/v1/version and checking for a 200 response.
#[tauri::command]
pub async fn gitea_validate_url(url: String) -> Result<bool, String> {
    let base = url.trim_end_matches('/').to_string();
    let version_url = format!("{}/api/v1/version", base);
    let res = reqwest::Client::new()
        .get(&version_url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;
    Ok(res.status().is_success())
}

// ---------------------------------------------------------------------------
// Gitea REST API (v1) — /user, /user/repos, POST /user/repos
// Uses the globally-configured Gitea instance URL.
// API docs: https://docs.gitea.com/api/1.22/
// ---------------------------------------------------------------------------

pub(super) async fn gitea_api_get<T: for<'de> Deserialize<'de>>(
    base_url: &str,
    path: &str,
    token: &str,
) -> Result<T, String> {
    let url = format!("{}{}", base_url, path);
    let res = reqwest::Client::new()
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Gitea API {}: {}", status, body));
    }
    res.json::<T>().await.map_err(|e| e.to_string())
}

pub(super) async fn gitea_api_post<B: Serialize, T: for<'de> Deserialize<'de>>(
    base_url: &str,
    path: &str,
    token: &str,
    body: &B,
) -> Result<T, String> {
    let url = format!("{}{}", base_url, path);
    let res = reqwest::Client::new()
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", USER_AGENT)
        .json(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Gitea API {}: {}", status, body));
    }
    res.json::<T>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gitea_user(base_url: String) -> Result<GitHubUser, String> {
    let token = gitea_read_token()?.ok_or("no Gitea token set")?;
    let base = base_url.trim_end_matches('/').to_string();
    gitea_api_get(&base, "/api/v1/user", &token).await
}

#[tauri::command]
pub async fn gitea_list_repos(base_url: String) -> Result<Vec<GitHubRepo>, String> {
    let token = gitea_read_token()?.ok_or("no Gitea token set")?;
    let base = base_url.trim_end_matches('/').to_string();
    // Gitea uses `limit` instead of `per_page` and doesn't support `affiliation`.
    gitea_api_get(&base, "/api/v1/user/repos?limit=100", &token).await
}

#[tauri::command]
pub async fn gitea_create_vault_repo(
    base_url: String,
    name: String,
    private: bool,
) -> Result<GitHubRepo, String> {
    let token = gitea_read_token()?.ok_or("no Gitea token set")?;
    let base = base_url.trim_end_matches('/').to_string();
    let req = CreateRepoRequest {
        name: &name,
        private,
        auto_init: true,
        description: "Notes vault — synced by SoloMD",
    };
    // Gitea uses the same POST /api/v1/user/repos endpoint.
    gitea_api_post(&base, "/api/v1/user/repos", &token, &req).await
}
