use super::*;

// ---------------------------------------------------------------------------
// Tauri commands.
// ---------------------------------------------------------------------------

/// Read the current state. Cheap — just clones the in-memory snapshot.
#[tauri::command]
pub fn capture_get_state() -> CaptureState {
    let s = STATE.lock().expect("capture state lock");
    CaptureState {
        enabled: s.enabled,
        running: s.running,
        port: s.port,
        token: s.token.clone(),
        inbox_folder: s.inbox_folder.clone(),
    }
}

/// Toggle the endpoint on/off. When turning on, a token is minted (if the
/// caller didn't pass one) and the listener is bound. When turning off, the
/// existing listener is asked to stop accepting new connections.
#[tauri::command]
pub async fn capture_set_enabled(
    app: AppHandle,
    enabled: bool,
    port: Option<u16>,
) -> Result<CaptureState, String> {
    {
        let mut s = STATE.lock().expect("capture state lock");
        s.enabled = enabled;
        if let Some(p) = port {
            s.port = p;
        }
        if enabled && s.token.is_empty() {
            s.token = random_token();
        }
        if !enabled {
            // Bumping the shutdown generation makes the running accept loop
            // notice on its next iteration (we poll a short timeout).
            s.shutdown_gen = s.shutdown_gen.wrapping_add(1);
            s.running = false;
        }
    }
    if enabled {
        spawn_if_needed(app);
    }
    Ok(capture_get_state())
}

/// Mint a fresh bearer token. The old one stops working immediately —
/// in-flight requests already past auth check are unaffected, but the
/// next request with the old header gets 401.
#[tauri::command]
pub fn capture_regenerate_token() -> CaptureState {
    {
        let mut s = STATE.lock().expect("capture state lock");
        s.token = random_token();
    }
    capture_get_state()
}

/// Set the inbox sub-folder (relative to workspace). Defaults to "inbox".
#[tauri::command]
pub fn capture_set_inbox_folder(folder: String) -> CaptureState {
    {
        let mut s = STATE.lock().expect("capture state lock");
        let trimmed = folder.trim().trim_matches('/').trim_matches('\\');
        s.inbox_folder = if trimmed.is_empty() {
            "inbox".to_string()
        } else {
            trimmed.to_string()
        };
    }
    capture_get_state()
}

/// Frontend pushes the active workspace folder here whenever it changes.
/// Server reads this on every request — when None, the endpoint replies
/// 503 with a friendly error.
#[tauri::command]
pub fn capture_set_workspace(folder: Option<String>) {
    let mut s = STATE.lock().expect("capture state lock");
    s.workspace = folder
        .map(|f| f.trim().to_string())
        .filter(|f| !f.is_empty())
        .map(PathBuf::from);
}

/// Where a capture should land right now: the open workspace plus the
/// configured inbox folder. `None` when no workspace is open.
///
/// Quick capture (global hotkey) writes through the same pair as the HTTP
/// endpoint so both agree on the destination without the caller having to
/// pass it in — the frontend already keeps `capture_set_workspace` current.
pub fn current_target() -> Option<(PathBuf, String)> {
    let s = STATE.lock().expect("capture state lock");
    s.workspace.clone().map(|w| (w, s.inbox_folder.clone()))
}
