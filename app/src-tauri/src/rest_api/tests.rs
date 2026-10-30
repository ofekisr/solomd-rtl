use super::*;
use std::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// All tests share the singleton `STATE` mutex (auth token + workspace +
/// allow_write). Without serialization they trample each other's setup
/// and 401 randomly, so we hold a real `Mutex` for the duration of every
/// test. Test functions just take this lock as their first line.
static TEST_LOCK: Lazy<std::sync::Mutex<()>> = Lazy::new(|| std::sync::Mutex::new(()));

/// Spin a serve-loop up on an ephemeral port, return (port, token).
/// Caller is responsible for tearing down via `_test_clear_state` if
/// they care; the test process exits between runs.
pub async fn _test_bind() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("bind: {e}"))?;
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
    tokio::spawn(async move {
        loop {
            let (stream, _) = match listener.accept().await {
                Ok(p) => p,
                Err(_) => break,
            };
            tokio::spawn(async move {
                let _ = handle_conn_test(stream).await;
            });
        }
    });
    Ok(port)
}

/// Same handler as `handle_conn` but doesn't need a real `AppHandle` —
/// the production handler only uses the handle for the on-disk port/token
/// drop, which the tests don't care about.
async fn handle_conn_test(mut stream: TcpStream) -> Result<(), String> {
    let req = read_request(&mut stream).await?;
    if req.method == "GET" && req.path == "/" {
        let _ = write_resp(
            &mut stream,
            200,
            "OK",
            &json!({"ok": true, "server": "solomd-rest"}).to_string(),
        )
        .await;
        return Ok(());
    }
    let token = STATE.lock().unwrap().token.clone();
    if !auth_ok(&req, &token) {
        write_err(&mut stream, 401, "auth").await;
        return Ok(());
    }
    let (workspace, allow_write) = {
        let s = STATE.lock().unwrap();
        (s.workspace.clone(), s.allow_write)
    };
    if req.method == "GET" && req.path == "/health" {
        let body = json!({
            "ok": true,
            "workspace_open": workspace.is_some(),
            "allow_write": allow_write,
        })
        .to_string();
        let _ = write_resp(&mut stream, 200, "OK", &body).await;
        return Ok(());
    }
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
    if req.method == "POST" && req.path.starts_with("/tools/") {
        let name = req.path["/tools/".len()..].to_string();
        if agent_tools::tool_descriptor(&name).is_none() {
            write_err(&mut stream, 404, "unknown").await;
            return Ok(());
        }
        if agent_tools::is_write_tool(&name) && !allow_write {
            write_err(&mut stream, 403, "write disabled").await;
            return Ok(());
        }
        let workspace = match workspace {
            Some(w) => w,
            None => {
                write_err(&mut stream, 503, "no ws").await;
                return Ok(());
            }
        };
        let args: Value = if req.body.is_empty() {
            json!({})
        } else {
            serde_json::from_slice(&req.body).map_err(|e| e.to_string())?
        };
        let res = agent_tools::dispatch_tool_inner(&workspace, &name, args);
        match res {
            Ok(v) => {
                let _ = write_resp(
                    &mut stream,
                    200,
                    "OK",
                    &json!({"ok": true, "result": v}).to_string(),
                )
                .await;
            }
            Err(msg) => write_err(&mut stream, 500, &msg).await,
        }
        return Ok(());
    }
    write_err(&mut stream, 404, "nope").await;
    Ok(())
}

pub fn _test_set(token: &str, allow_write: bool, workspace: Option<PathBuf>) {
    let mut s = STATE.lock().unwrap();
    s.token = token.to_string();
    s.allow_write = allow_write;
    s.workspace = workspace;
}

/// Hit the ephemeral server with a single request, return (status, body).
async fn http(
    port: u16,
    method: &str,
    path: &str,
    token: Option<&str>,
    body: Option<&str>,
) -> (u16, String) {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
    let body_bytes = body.unwrap_or("").as_bytes();
    let auth_h = match token {
        Some(t) => format!("Authorization: Bearer {t}\r\n"),
        None => String::new(),
    };
    let req = format!(
        "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1\r\n{auth_h}Content-Length: {}\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n",
        body_bytes.len()
    );
    stream.write_all(req.as_bytes()).await.unwrap();
    stream.write_all(body_bytes).await.unwrap();
    let mut buf = Vec::new();
    stream.read_to_end(&mut buf).await.unwrap();
    let raw = String::from_utf8_lossy(&buf).to_string();
    let status: u16 = raw
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let body_part = raw.split("\r\n\r\n").nth(1).unwrap_or("").to_string();
    (status, body_part)
}

#[tokio::test]
async fn banner_no_auth_required() {
    let _g = TEST_LOCK.lock().unwrap();
    _test_set("tok", false, None);
    let port = _test_bind().await.unwrap();
    let (code, body) = http(port, "GET", "/", None, None).await;
    assert_eq!(code, 200, "body: {body}");
    let v: Value = serde_json::from_str(&body).unwrap();
    assert_eq!(v["ok"], true);
    assert_eq!(v["server"], "solomd-rest");
}

#[tokio::test]
async fn missing_token_rejected() {
    let _g = TEST_LOCK.lock().unwrap();
    _test_set("tok-A", false, None);
    let port = _test_bind().await.unwrap();
    let (code, _) = http(port, "GET", "/health", None, None).await;
    assert_eq!(code, 401);
    let (code2, _) = http(port, "GET", "/health", Some("wrong"), None).await;
    assert_eq!(code2, 401);
}

#[tokio::test]
async fn list_tools_returns_full_registry() {
    let _g = TEST_LOCK.lock().unwrap();
    _test_set("tok-B", false, None);
    let port = _test_bind().await.unwrap();
    let (code, body) = http(port, "GET", "/tools", Some("tok-B"), None).await;
    assert_eq!(code, 200, "body: {body}");
    let v: Value = serde_json::from_str(&body).unwrap();
    assert_eq!(v["ok"], true);
    let tools = v["tools"].as_array().unwrap();
    // Must include the canonical read tools + the two writers.
    let names: Vec<&str> = tools.iter().map(|t| t["name"].as_str().unwrap()).collect();
    for must in [
        "list_notes",
        "read_note",
        "search",
        "write_note",
        "append_to_note",
    ] {
        assert!(names.contains(&must), "missing tool {must} in {names:?}");
    }
    // Each tool carries a JSON schema.
    assert!(tools[0]["input_schema"].is_object());
}

#[tokio::test]
async fn write_tool_403_when_allow_write_false() {
    let _g = TEST_LOCK.lock().unwrap();
    // Spin a temp workspace so we don't 503 on missing workspace.
    let tmp = std::env::temp_dir().join(format!("solomd-rest-test-{}", super::super::agent_run::mint_run_id()));
    fs::create_dir_all(&tmp).unwrap();
    _test_set("tok-C", false, Some(tmp.clone()));
    let port = _test_bind().await.unwrap();
    let (code, body) = http(
        port,
        "POST",
        "/tools/write_note",
        Some("tok-C"),
        Some(r#"{"path":"hello.md","content":"hi","allow_overwrite":true}"#),
    )
    .await;
    assert_eq!(code, 403, "body: {body}");
    let _ = fs::remove_dir_all(&tmp);
}

#[tokio::test]
async fn read_tool_round_trips_via_http() {
    let _g = TEST_LOCK.lock().unwrap();
    // Seed a tiny workspace with one markdown file so list_notes returns it.
    let tmp = std::env::temp_dir().join(format!("solomd-rest-rt-{}", super::super::agent_run::mint_run_id()));
    fs::create_dir_all(&tmp).unwrap();
    fs::write(tmp.join("note.md"), "# title\n\nhello\n").unwrap();
    _test_set("tok-D", false, Some(tmp.clone()));
    let port = _test_bind().await.unwrap();
    let (code, body) = http(
        port,
        "POST",
        "/tools/list_notes",
        Some("tok-D"),
        Some("{}"),
    )
    .await;
    assert_eq!(code, 200, "body: {body}");
    let v: Value = serde_json::from_str(&body).unwrap();
    assert_eq!(v["ok"], true);
    // list_notes returns { notes: [...] }.
    let notes = v["result"]["notes"].as_array().expect("notes array");
    assert!(!notes.is_empty(), "expected at least one note: {body}");
    let _ = fs::remove_dir_all(&tmp);
}

#[tokio::test]
async fn unknown_tool_returns_404() {
    let _g = TEST_LOCK.lock().unwrap();
    _test_set("tok-E", false, None);
    let port = _test_bind().await.unwrap();
    let (code, _) = http(port, "POST", "/tools/no_such", Some("tok-E"), Some("{}")).await;
    assert_eq!(code, 404);
}
