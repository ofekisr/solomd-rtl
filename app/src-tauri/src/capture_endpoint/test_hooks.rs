use super::*;

// ---------------------------------------------------------------------------
// Helpers exposed for the e2e test.
// ---------------------------------------------------------------------------

/// Set the in-memory state directly. Used by the e2e test to avoid running
/// the Tauri command layer.
#[doc(hidden)]
pub fn _test_set_state(workspace: Option<PathBuf>, token: String, inbox_folder: String) {
    let mut s = STATE.lock().expect("capture state lock");
    s.workspace = workspace;
    s.token = token;
    s.inbox_folder = inbox_folder;
    s.enabled = true;
}

#[doc(hidden)]
pub fn _test_current_token() -> String {
    STATE.lock().expect("capture state lock").token.clone()
}

#[doc(hidden)]
pub fn _test_handle_capture(body: &[u8]) -> Result<String, CaptureError> {
    handle_capture(body)
}

#[doc(hidden)]
pub fn _test_resolve_safe_workspace_path(
    workspace: &Path,
    rel_path: &str,
) -> Result<PathBuf, String> {
    resolve_safe_workspace_path(workspace, rel_path)
}

/// Spin a standalone server for live curl testing — no Tauri AppHandle
/// required. Used by `examples/capture_drive.rs`. Binds, accepts, and
/// returns the bound port. Caller is responsible for keeping the tokio
/// runtime alive.
#[doc(hidden)]
pub async fn _test_bind_and_serve() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("bind: {e}"))?;
    let bound_port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
    {
        let mut s = STATE.lock().expect("capture state lock");
        s.port = bound_port;
        s.running = true;
    }
    tokio::spawn(async move {
        loop {
            let stream = match listener.accept().await {
                Ok((s, _)) => s,
                Err(_) => continue,
            };
            tokio::spawn(async move {
                // Read + dispatch without needing an AppHandle. We don't
                // call write_port_token here (no app paths), and we won't
                // touch the live STATE.workspace either — caller seeds it.
                let (mut s, _) = (stream, ());
                let req = match read_request(&mut s).await {
                    Ok(r) => r,
                    Err(e) => {
                        let _ = write_resp(
                            &mut s,
                            400,
                            "Bad Request",
                            &serde_json::json!({"ok": false, "error": e}).to_string(),
                        )
                        .await;
                        return;
                    }
                };
                if req.method == "OPTIONS" {
                    let _ = write_resp(&mut s, 204, "No Content", "").await;
                    return;
                }
                if req.method == "GET" && req.path == "/" {
                    let _ = write_resp(&mut s, 200, "OK", "{\"ok\":true}").await;
                    return;
                }
                if req.method == "GET" && req.path == "/capture/health" {
                    let (token, workspace, inbox_folder) = {
                        let st = STATE.lock().expect("capture state lock");
                        (st.token.clone(), st.workspace.clone(), st.inbox_folder.clone())
                    };
                    if !auth_ok(&req, &token) {
                        let _ = write_resp(
                            &mut s,
                            401,
                            "Unauthorized",
                            "{\"ok\":false,\"error\":\"missing or wrong token\"}",
                        )
                        .await;
                        return;
                    }
                    let workspace_str = workspace
                        .as_ref()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let body = serde_json::json!({
                        "ok": true,
                        "version": env!("CARGO_PKG_VERSION"),
                        "workspace": workspace_str,
                        "inbox_folder": inbox_folder,
                        "workspace_open": workspace.is_some(),
                    })
                    .to_string();
                    let _ = write_resp(&mut s, 200, "OK", &body).await;
                    return;
                }
                if req.method == "POST" && req.path == "/capture" {
                    let token = STATE.lock().expect("capture state lock").token.clone();
                    if !auth_ok(&req, &token) {
                        let _ = write_resp(
                            &mut s,
                            401,
                            "Unauthorized",
                            "{\"ok\":false,\"error\":\"missing or wrong token\"}",
                        )
                        .await;
                        return;
                    }
                    match handle_capture(&req.body) {
                        Ok(p) => {
                            let body = serde_json::json!({"ok": true, "path": p}).to_string();
                            let _ = write_resp(&mut s, 200, "OK", &body).await;
                        }
                        Err(CaptureError::NoWorkspace) => {
                            let _ = write_resp(
                                &mut s,
                                503,
                                "Service Unavailable",
                                "{\"ok\":false,\"error\":\"no workspace open\"}",
                            )
                            .await;
                        }
                        Err(CaptureError::BadRequest(msg)) => {
                            let body = serde_json::json!({"ok": false, "error": msg}).to_string();
                            let _ = write_resp(&mut s, 400, "Bad Request", &body).await;
                        }
                        Err(CaptureError::Io(msg)) => {
                            let body = serde_json::json!({"ok": false, "error": msg}).to_string();
                            let _ = write_resp(&mut s, 500, "Internal Server Error", &body).await;
                        }
                    }
                    return;
                }
                let _ = write_resp(
                    &mut s,
                    404,
                    "Not Found",
                    "{\"ok\":false,\"error\":\"unknown route\"}",
                )
                .await;
            });
        }
    });
    Ok(bound_port)
}

#[doc(hidden)]
pub fn _test_check_auth(header: Option<&str>) -> bool {
    let token = STATE.lock().expect("capture state lock").token.clone();
    let req = Request {
        method: "POST".into(),
        path: "/capture".into(),
        headers: {
            let mut h = HashMap::new();
            if let Some(v) = header {
                h.insert("authorization".to_string(), v.to_string());
            }
            h
        },
        body: vec![],
    };
    auth_ok(&req, &token)
}
