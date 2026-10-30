use super::*;

// ---------------------------------------------------------------------------
// Server boot.
// ---------------------------------------------------------------------------

pub(super) fn spawn_if_needed(app: AppHandle) {
    if SERVER_RUNNING.swap(true, Ordering::SeqCst) {
        // Another accept-loop is already alive; it'll pick up the new
        // token / config on the next request.
        return;
    }
    tauri::async_runtime::spawn(async move {
        if let Err(e) = serve(app).await {
            eprintln!("[capture_endpoint] fatal: {e}");
        }
        SERVER_RUNNING.store(false, Ordering::SeqCst);
    });
}

pub(super) async fn serve(app: AppHandle) -> Result<(), String> {
    let port = STATE.lock().expect("capture state lock").port;
    let listener = TcpListener::bind(format!("127.0.0.1:{port}"))
        .await
        .map_err(|e| format!("bind 127.0.0.1:{port}: {e}"))?;
    let bound_port = listener.local_addr().map(|a| a.port()).unwrap_or(port);
    {
        let mut s = STATE.lock().expect("capture state lock");
        s.port = bound_port;
        s.running = true;
    }

    let my_gen = STATE.lock().expect("capture state lock").shutdown_gen;
    write_port_token(&app, bound_port);

    eprintln!(
        "[capture_endpoint] listening on http://127.0.0.1:{bound_port}"
    );

    loop {
        // Bail out if the user toggled the endpoint off.
        let (enabled, gen_now) = {
            let s = STATE.lock().expect("capture state lock");
            (s.enabled, s.shutdown_gen)
        };
        if !enabled || gen_now != my_gen {
            break;
        }

        // Accept with a small timeout so we can re-check the toggle.
        let accept = tokio::time::timeout(Duration::from_millis(500), listener.accept()).await;
        let stream = match accept {
            Ok(Ok((s, _))) => s,
            Ok(Err(e)) => {
                eprintln!("[capture_endpoint] accept: {e}");
                continue;
            }
            Err(_) => continue, // timeout — loop back, re-check toggle
        };
        let app2 = app.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_conn(stream, app2).await {
                eprintln!("[capture_endpoint] conn: {e}");
            }
        });
    }

    {
        let mut s = STATE.lock().expect("capture state lock");
        s.running = false;
    }
    cleanup_port_token(&app);
    eprintln!("[capture_endpoint] stopped");
    Ok(())
}

/// Mirror dev_bridge: drop a `capture-endpoint.{port,token}` pair next to
/// the dev-bridge files so external clients (e.g. a Mac shortcut) can
/// auto-discover the port and token without the user manually editing
/// their script. Best-effort — we don't fail the boot if the write fails.
pub(super) fn write_port_token(app: &AppHandle, port: u16) {
    let token = STATE.lock().expect("capture state lock").token.clone();
    let dir = match super::super::portable::app_config_dir(app.path()) {
        Ok(d) => d,
        Err(_) => return,
    };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let _ = std::fs::write(dir.join("capture-endpoint.port"), port.to_string());
    let token_path = dir.join("capture-endpoint.token");
    let _ = std::fs::write(&token_path, &token);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(
            &token_path,
            std::fs::Permissions::from_mode(0o600),
        );
    }
}

pub(super) fn cleanup_port_token(app: &AppHandle) {
    if let Ok(dir) = super::super::portable::app_config_dir(app.path()) {
        let _ = std::fs::remove_file(dir.join("capture-endpoint.port"));
        let _ = std::fs::remove_file(dir.join("capture-endpoint.token"));
    }
}

// ---------------------------------------------------------------------------
// Connection handling. Hand-rolled HTTP/1.1 — same minimal parser as
// dev_bridge::handle_conn. Single route, no chunked encoding, no keep-alive.
// ---------------------------------------------------------------------------

pub(super) struct Request {
    pub(super) method: String,
    pub(super) path: String,
    pub(super) headers: HashMap<String, String>,
    pub(super) body: Vec<u8>,
}

pub(super) async fn handle_conn(mut stream: TcpStream, _app: AppHandle) -> Result<(), String> {
    let req = match read_request(&mut stream).await {
        Ok(r) => r,
        Err(e) => {
            let _ = write_resp(
                &mut stream,
                400,
                "Bad Request",
                &serde_json::json!({"ok": false, "error": e}).to_string(),
            )
            .await;
            return Ok(());
        }
    };

    if req.method == "OPTIONS" {
        let _ = write_resp(&mut stream, 204, "No Content", "").await;
        return Ok(());
    }

    if req.method == "GET" && req.path == "/" {
        let _ = write_resp(
            &mut stream,
            200,
            "OK",
            "{\"ok\":true,\"server\":\"solomd-capture\"}",
        )
        .await;
        return Ok(());
    }

    // Health check — used by the browser-extension "Test connection" button
    // to verify URL + token without writing a note. Token-gated so we never
    // reveal anything (workspace path included) to a probe lacking the
    // bearer header. Returns the workspace path so the user can sanity-check
    // they paired the extension with the *right* SoloMD instance.
    if req.method == "GET" && req.path == "/capture/health" {
        let (token, workspace, inbox_folder) = {
            let s = STATE.lock().expect("capture state lock");
            (s.token.clone(), s.workspace.clone(), s.inbox_folder.clone())
        };
        if !auth_ok(&req, &token) {
            let _ = write_resp(
                &mut stream,
                401,
                "Unauthorized",
                "{\"ok\":false,\"error\":\"missing or wrong Authorization: Bearer <token>\"}",
            )
            .await;
            return Ok(());
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
        let _ = write_resp(&mut stream, 200, "OK", &body).await;
        return Ok(());
    }

    if req.method == "POST" && req.path == "/capture" {
        // Auth check.
        let token = STATE.lock().expect("capture state lock").token.clone();
        if !auth_ok(&req, &token) {
            let _ = write_resp(
                &mut stream,
                401,
                "Unauthorized",
                "{\"ok\":false,\"error\":\"missing or wrong Authorization: Bearer <token>\"}",
            )
            .await;
            return Ok(());
        }

        match handle_capture(&req.body) {
            Ok(path) => {
                let body =
                    serde_json::json!({"ok": true, "path": path}).to_string();
                let _ = write_resp(&mut stream, 200, "OK", &body).await;
            }
            Err(CaptureError::NoWorkspace) => {
                let _ = write_resp(
                    &mut stream,
                    503,
                    "Service Unavailable",
                    "{\"ok\":false,\"error\":\"no workspace folder open in SoloMD; open a folder first\"}",
                )
                .await;
            }
            Err(CaptureError::BadRequest(msg)) => {
                let body =
                    serde_json::json!({"ok": false, "error": msg}).to_string();
                let _ = write_resp(&mut stream, 400, "Bad Request", &body).await;
            }
            Err(CaptureError::Io(msg)) => {
                let body =
                    serde_json::json!({"ok": false, "error": msg}).to_string();
                let _ = write_resp(&mut stream, 500, "Internal Server Error", &body).await;
            }
        }
        return Ok(());
    }

    let _ = write_resp(
        &mut stream,
        404,
        "Not Found",
        "{\"ok\":false,\"error\":\"unknown route\"}",
    )
    .await;
    Ok(())
}

pub(super) fn auth_ok(req: &Request, expected: &str) -> bool {
    if expected.is_empty() {
        return false;
    }
    let Some(h) = req.headers.get("authorization") else {
        return false;
    };
    let want = format!("Bearer {expected}");
    h == &want || h.eq_ignore_ascii_case(&want)
}
