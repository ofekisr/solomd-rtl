use super::*;

// ---------------------------------------------------------------------------
// Token storage (OS keychain via `keyring`)
// ---------------------------------------------------------------------------

pub(super) fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

/// `~/.solomd/github-token-set` — a non-secret marker file written
/// alongside `github_set_token` and removed by `github_clear_token`.
/// Lets `github_has_token()` answer the "did the user log in?" question
/// WITHOUT touching the OS keychain. macOS's keyring fires a
/// password-prompt on every read — opening Settings was triggering it
/// just to render a green dot. The marker file moves that prompt off
/// the read path; the keychain only gets touched on push / pull (which
/// the user explicitly initiates and where the prompt is meaningful).
pub(super) fn token_marker_path() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(std::path::PathBuf::from))
        .map(|h| h.join(".solomd").join("github-token-set"))
}

pub(super) fn write_token_marker() {
    if let Some(p) = token_marker_path() {
        if let Some(parent) = p.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(&p, b"1");
    }
}

pub(super) fn remove_token_marker() {
    if let Some(p) = token_marker_path() {
        let _ = std::fs::remove_file(&p);
    }
}

pub(super) fn read_token() -> Result<Option<String>, String> {
    // Cached read first — if the user already authorized the keychain
    // earlier in this session, never bother them again.
    if let Ok(guard) = TOKEN_CACHE.lock() {
        if let Some(s) = guard.as_ref() {
            return Ok(Some(s.clone()));
        }
    }
    let entry = keyring_entry()?;
    let token = match entry.get_password() {
        Ok(s) => Some(s),
        Err(keyring::Error::NoEntry) => None,
        Err(e) => return Err(e.to_string()),
    };
    if let (Ok(mut guard), Some(t)) = (TOKEN_CACHE.lock(), token.as_ref()) {
        *guard = Some(t.clone());
    }
    Ok(token)
}

#[tauri::command]
pub fn github_set_token(token: String) -> Result<(), String> {
    let trimmed = token.trim().to_string();
    if trimmed.is_empty() {
        return Err("token is empty".into());
    }
    let entry = keyring_entry()?;
    // Order matters: keyring write FIRST, cache populate SECOND. Otherwise
    // a keyring write failure leaves the in-process cache holding a token
    // that the keychain doesn't know about — fine for this run but it
    // disappears on relaunch with no obvious cause.
    entry.set_password(&trimmed).map_err(|e| e.to_string())?;
    if let Ok(mut guard) = TOKEN_CACHE.lock() {
        *guard = Some(trimmed);
    }
    write_token_marker();
    Ok(())
}

#[tauri::command]
pub fn github_clear_token() -> Result<(), String> {
    let entry = keyring_entry()?;
    let r = match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    };
    if let Ok(mut guard) = TOKEN_CACHE.lock() {
        *guard = None;
    }
    remove_token_marker();
    r
}

#[tauri::command]
pub fn github_has_token() -> Result<bool, String> {
    // Marker-file check — no keychain access, no macOS password prompt.
    Ok(token_marker_path().map(|p| p.exists()).unwrap_or(false))
}
