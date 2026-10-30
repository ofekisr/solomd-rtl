//! v4.0 — Public REST API server.
//!
//! Localhost HTTP server that exposes the same surface as the in-process
//! `agent_tools` registry — list / read / search / write notes, list runs,
//! read a run's trace — to **non-MCP** clients (Alfred / Raycast / n8n /
//! shell scripts / browser extensions / iOS shortcuts that don't speak
//! MCP). Same wire pattern as `capture_endpoint.rs`: hand-rolled HTTP/1.1,
//! single bearer token, 127.0.0.1 only, opt-in via Settings → Integrations.
//!
//! Off by default. The user toggles it on, copies the bearer token, and
//! pings the endpoint. Turning it off shuts down the listener and clears
//! the on-disk port + token files.
//!
//! Routes (every route except `GET /` requires `Authorization: Bearer …`):
//!
//!   GET  /                     → server banner (no auth)
//!   GET  /health               → workspace status
//!   GET  /tools                → list available tools + JSON schemas
//!   POST /tools/<name>         → invoke tool, body = JSON args
//!   GET  /runs                 → list recent agent runs (meta.json blobs)
//!   GET  /runs/<id>/meta       → meta.json for a single run
//!   GET  /runs/<id>/trace      → trace.jsonl text
//!   GET  /runs/<id>/run.md     → run.md text
//!
//! Write tools (`write_note`, `append_to_note`) are gated behind a separate
//! `allow_write` toggle in settings — when off, POST returns 403 even if the
//! token checks out. This mirrors the recipe runner's write-cap UX: read
//! access is the default, writes are an explicit opt-in per integration.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::net::{TcpListener, TcpStream};

use super::agent_tools;

mod http;
use http::{auth_ok, read_request, write_err, write_resp, write_text};

// ---------------------------------------------------------------------------
// Public state
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RestState {
    pub enabled: bool,
    pub running: bool,
    pub port: u16,
    pub token: String,
    /// When false, POST /tools/<write_*> returns 403. Defaults off.
    pub allow_write: bool,
}

#[derive(Debug, Clone)]
struct InnerState {
    enabled: bool,
    running: bool,
    port: u16,
    token: String,
    allow_write: bool,
    workspace: Option<PathBuf>,
    shutdown_gen: u64,
}

static STATE: Lazy<Mutex<InnerState>> = Lazy::new(|| {
    Mutex::new(InnerState {
        enabled: false,
        running: false,
        port: 7878,
        token: String::new(),
        allow_write: false,
        workspace: None,
        shutdown_gen: 0,
    })
});

static SERVER_RUNNING: AtomicBool = AtomicBool::new(false);

// ---------------------------------------------------------------------------
// Token mint — same shape as capture_endpoint::random_token. 32 hex chars.
// ---------------------------------------------------------------------------

fn random_token() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id() as u128;
    let mix = nanos.wrapping_mul(0x9E37_79B9_7F4A_7C15).wrapping_add(pid);
    let mut s = String::with_capacity(32);
    let mut x = mix;
    for _ in 0..16 {
        s.push_str(&format!("{:02x}", (x & 0xff) as u8));
        x = x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    }
    s
}

fn snapshot() -> RestState {
    let s = STATE.lock().expect("rest state lock");
    RestState {
        enabled: s.enabled,
        running: s.running,
        port: s.port,
        token: s.token.clone(),
        allow_write: s.allow_write,
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn rest_get_state() -> RestState {
    snapshot()
}

#[tauri::command]
pub async fn rest_set_enabled(
    app: AppHandle,
    enabled: bool,
    port: Option<u16>,
) -> Result<RestState, String> {
    {
        let mut s = STATE.lock().expect("rest state lock");
        s.enabled = enabled;
        if let Some(p) = port {
            s.port = p;
        }
        if enabled && s.token.is_empty() {
            s.token = random_token();
        }
        if !enabled {
            s.shutdown_gen = s.shutdown_gen.wrapping_add(1);
            s.running = false;
        }
    }
    if enabled {
        spawn_if_needed(app);
    }
    Ok(snapshot())
}

#[tauri::command]
pub fn rest_regenerate_token() -> RestState {
    {
        let mut s = STATE.lock().expect("rest state lock");
        s.token = random_token();
    }
    snapshot()
}

#[tauri::command]
pub fn rest_set_allow_write(allow: bool) -> RestState {
    {
        let mut s = STATE.lock().expect("rest state lock");
        s.allow_write = allow;
    }
    snapshot()
}

/// Frontend pushes the active workspace folder here whenever it changes.
#[tauri::command]
pub fn rest_set_workspace(folder: Option<String>) {
    let mut s = STATE.lock().expect("rest state lock");
    s.workspace = folder
        .map(|f| f.trim().to_string())
        .filter(|f| !f.is_empty())
        .map(PathBuf::from);
}

// ---------------------------------------------------------------------------
// Server boot
// ---------------------------------------------------------------------------

fn spawn_if_needed(app: AppHandle) {
    if SERVER_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    tauri::async_runtime::spawn(async move {
        if let Err(e) = serve(app).await {
            eprintln!("[rest_api] fatal: {e}");
        }
        SERVER_RUNNING.store(false, Ordering::SeqCst);
    });
}

async fn serve(app: AppHandle) -> Result<(), String> {
    let port = STATE.lock().expect("rest state lock").port;
    let listener = TcpListener::bind(format!("127.0.0.1:{port}"))
        .await
        .map_err(|e| format!("bind 127.0.0.1:{port}: {e}"))?;
    let bound_port = listener.local_addr().map(|a| a.port()).unwrap_or(port);
    {
        let mut s = STATE.lock().expect("rest state lock");
        s.port = bound_port;
        s.running = true;
    }

    let my_gen = STATE.lock().expect("rest state lock").shutdown_gen;
    write_port_token(&app, bound_port);

    eprintln!("[rest_api] listening on http://127.0.0.1:{bound_port}");

    loop {
        let (enabled, gen_now) = {
            let s = STATE.lock().expect("rest state lock");
            (s.enabled, s.shutdown_gen)
        };
        if !enabled || gen_now != my_gen {
            break;
        }
        let accept = tokio::time::timeout(Duration::from_millis(500), listener.accept()).await;
        let stream = match accept {
            Ok(Ok((s, _))) => s,
            Ok(Err(e)) => {
                eprintln!("[rest_api] accept: {e}");
                continue;
            }
            Err(_) => continue,
        };
        let app2 = app.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_conn(stream, app2).await {
                eprintln!("[rest_api] conn: {e}");
            }
        });
    }

    {
        let mut s = STATE.lock().expect("rest state lock");
        s.running = false;
    }
    cleanup_port_token(&app);
    eprintln!("[rest_api] stopped");
    Ok(())
}

fn write_port_token(app: &AppHandle, port: u16) {
    let token = STATE.lock().expect("rest state lock").token.clone();
    let dir = match super::portable::app_config_dir(app.path()) {
        Ok(d) => d,
        Err(_) => return,
    };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let _ = std::fs::write(dir.join("rest-api.port"), port.to_string());
    let token_path = dir.join("rest-api.token");
    let _ = std::fs::write(&token_path, &token);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&token_path, std::fs::Permissions::from_mode(0o600));
    }
}

fn cleanup_port_token(app: &AppHandle) {
    if let Ok(dir) = super::portable::app_config_dir(app.path()) {
        let _ = std::fs::remove_file(dir.join("rest-api.port"));
        let _ = std::fs::remove_file(dir.join("rest-api.token"));
    }
}

async fn handle_conn(mut stream: TcpStream, _app: AppHandle) -> Result<(), String> {
    let req = match read_request(&mut stream).await {
        Ok(r) => r,
        Err(e) => {
            let _ = write_resp(
                &mut stream,
                400,
                "Bad Request",
                &json!({"ok": false, "error": e}).to_string(),
            )
            .await;
            return Ok(());
        }
    };

    if req.method == "OPTIONS" {
        let _ = write_resp(&mut stream, 204, "No Content", "").await;
        return Ok(());
    }

    // Public banner — confirms the service identity without revealing
    // anything sensitive. Same shape as the capture endpoint banner.
    if req.method == "GET" && req.path == "/" {
        let _ = write_resp(
            &mut stream,
            200,
            "OK",
            &json!({
                "ok": true,
                "server": "solomd-rest",
                "version": env!("CARGO_PKG_VERSION"),
            })
            .to_string(),
        )
        .await;
        return Ok(());
    }

    // Auth gate for every other route.
    let token = STATE.lock().expect("rest state lock").token.clone();
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

    let (workspace, allow_write) = {
        let s = STATE.lock().expect("rest state lock");
        (s.workspace.clone(), s.allow_write)
    };

    // GET /health — does the server have a workspace?
    if req.method == "GET" && req.path == "/health" {
        let body = json!({
            "ok": true,
            "version": env!("CARGO_PKG_VERSION"),
            "workspace": workspace
                .as_ref()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default(),
            "workspace_open": workspace.is_some(),
            "allow_write": allow_write,
        })
        .to_string();
        let _ = write_resp(&mut stream, 200, "OK", &body).await;
        return Ok(());
    }

    // GET /tools — list every registered tool + descriptor.
    if req.method == "GET" && req.path == "/tools" {
        let mut tools: Vec<Value> = Vec::new();
        for name in agent_tools::all_tools() {
            if let Some((desc, schema)) = agent_tools::tool_descriptor(name) {
                tools.push(json!({
                    "name": name,
                    "description": desc,
                    "input_schema": schema,
                    "write": agent_tools::is_write_tool(name),
                }));
            }
        }
        let _ = write_resp(
            &mut stream,
            200,
            "OK",
            &json!({"ok": true, "tools": tools}).to_string(),
        )
        .await;
        return Ok(());
    }

    // POST /tools/<name> — invoke a tool with JSON args.
    if req.method == "POST" && req.path.starts_with("/tools/") {
        let name = &req.path["/tools/".len()..];
        if name.is_empty() {
            write_err(&mut stream, 400, "tool name missing").await;
            return Ok(());
        }
        if agent_tools::tool_descriptor(name).is_none() {
            write_err(&mut stream, 404, &format!("unknown tool: {name}")).await;
            return Ok(());
        }
        if agent_tools::is_write_tool(name) && !allow_write {
            write_err(
                &mut stream,
                403,
                "write tools disabled (enable 'Allow write' in Settings → Integrations → REST API)",
            )
            .await;
            return Ok(());
        }
        let workspace = match workspace {
            Some(w) => w,
            None => {
                write_err(
                    &mut stream,
                    503,
                    "no workspace folder open in SoloMD; open a folder first",
                )
                .await;
                return Ok(());
            }
        };
        let args: Value = if req.body.is_empty() {
            json!({})
        } else {
            match serde_json::from_slice(&req.body) {
                Ok(v) => v,
                Err(e) => {
                    write_err(&mut stream, 400, &format!("parse body: {e}")).await;
                    return Ok(());
                }
            }
        };
        let name_owned = name.to_string();
        // Move dispatch off the runtime thread — agent_tools does sync FS work.
        let result = tauri::async_runtime::spawn_blocking(move || {
            agent_tools::dispatch_tool_inner(&workspace, &name_owned, args)
        })
        .await
        .map_err(|e| format!("dispatch join: {e}"));
        match result {
            Ok(Ok(v)) => {
                let _ = write_resp(
                    &mut stream,
                    200,
                    "OK",
                    &json!({"ok": true, "result": v}).to_string(),
                )
                .await;
            }
            Ok(Err(msg)) | Err(msg) => {
                write_err(&mut stream, 500, &msg).await;
            }
        }
        return Ok(());
    }

    // GET /runs — list recent agent runs.
    if req.method == "GET" && req.path == "/runs" {
        let workspace = match workspace {
            Some(w) => w,
            None => {
                write_err(&mut stream, 503, "no workspace folder open").await;
                return Ok(());
            }
        };
        let runs = super::agent_run::list_runs(&workspace);
        let _ = write_resp(
            &mut stream,
            200,
            "OK",
            &json!({"ok": true, "runs": runs}).to_string(),
        )
        .await;
        return Ok(());
    }

    // GET /runs/<id>/meta | /trace | /run.md
    if req.method == "GET" && req.path.starts_with("/runs/") {
        let workspace = match workspace {
            Some(w) => w,
            None => {
                write_err(&mut stream, 503, "no workspace folder open").await;
                return Ok(());
            }
        };
        let rest = &req.path["/runs/".len()..];
        let (run_id, kind) = match rest.split_once('/') {
            Some((id, k)) => (id, k),
            None => (rest, "meta"),
        };
        // Disallow path traversal — run_id is meant to be the YYYYMMDD-HHMMSS-XXXXXX
        // form, so we refuse anything with a slash or `..`.
        if run_id.is_empty() || run_id.contains('/') || run_id.contains('\\') || run_id.contains("..") {
            write_err(&mut stream, 400, "bad run id").await;
            return Ok(());
        }
        match kind {
            "meta" | "" => match super::agent_run::read_run_meta(&workspace, run_id) {
                Ok(m) => {
                    let body = json!({"ok": true, "run": m}).to_string();
                    let _ = write_resp(&mut stream, 200, "OK", &body).await;
                }
                Err(e) => write_err(&mut stream, 404, &e).await,
            },
            "trace" => match super::agent_run::read_trace(&workspace, run_id) {
                Ok(t) => write_text(&mut stream, 200, "OK", &t).await,
                Err(e) => write_err(&mut stream, 404, &e).await,
            },
            "run.md" => match super::agent_run::read_run_md(&workspace, run_id) {
                Ok(t) => write_text(&mut stream, 200, "OK", &t).await,
                Err(e) => write_err(&mut stream, 404, &e).await,
            },
            other => write_err(&mut stream, 404, &format!("unknown run sub-resource: {other}")).await,
        }
        return Ok(());
    }

    write_err(&mut stream, 404, "unknown route").await;
    Ok(())
}

// ---------------------------------------------------------------------------
// Test surface — drives the server through a real localhost socket so we
// exercise auth, parsing, and dispatch end-to-end.
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests;
