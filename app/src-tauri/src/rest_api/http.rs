use std::collections::HashMap;

use serde_json::json;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

// ---------------------------------------------------------------------------
// Connection handling — same minimal HTTP/1.1 parser as capture_endpoint.
// ---------------------------------------------------------------------------

pub(super) struct Request {
    pub(super) method: String,
    pub(super) path: String,
    pub(super) headers: HashMap<String, String>,
    pub(super) body: Vec<u8>,
}


pub(super) async fn write_err(stream: &mut TcpStream, code: u16, msg: &str) {
    let reason = match code {
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        500 => "Internal Server Error",
        503 => "Service Unavailable",
        _ => "Error",
    };
    let body = json!({"ok": false, "error": msg}).to_string();
    let _ = write_resp(stream, code, reason, &body).await;
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

// ---------------------------------------------------------------------------
// HTTP/1.1 helpers — copied verbatim from capture_endpoint to keep the two
// servers independent. Same body cap (8 MiB), same header cap (64 KiB).
// ---------------------------------------------------------------------------

pub(super) async fn read_request(stream: &mut TcpStream) -> Result<Request, String> {
    let mut buf = Vec::with_capacity(2048);
    let mut tmp = [0u8; 1024];
    let header_end;
    loop {
        if buf.len() > 64 * 1024 {
            return Err("headers too large".into());
        }
        let n = stream.read(&mut tmp).await.map_err(|e| format!("read: {e}"))?;
        if n == 0 {
            return Err("unexpected eof".into());
        }
        buf.extend_from_slice(&tmp[..n]);
        if let Some(pos) = find_double_crlf(&buf) {
            header_end = pos + 4;
            break;
        }
    }
    let (head_bytes, rest) = buf.split_at(header_end);
    let head = std::str::from_utf8(head_bytes)
        .map_err(|_| "non-utf8 headers".to_string())?
        .to_string();
    let mut rest = rest.to_vec();

    let mut lines = head.split("\r\n");
    let request_line = lines.next().ok_or("empty request")?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next().ok_or("no method")?.to_string();
    let path = parts.next().ok_or("no path")?.to_string();

    let mut headers: HashMap<String, String> = HashMap::new();
    for line in lines {
        if line.is_empty() {
            continue;
        }
        if let Some((k, v)) = line.split_once(':') {
            headers.insert(k.trim().to_ascii_lowercase(), v.trim().to_string());
        }
    }

    let content_length: usize = headers
        .get("content-length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    if content_length > 8 * 1024 * 1024 {
        return Err("body too large (max 8 MiB)".into());
    }
    while rest.len() < content_length {
        let n = stream
            .read(&mut tmp)
            .await
            .map_err(|e| format!("read body: {e}"))?;
        if n == 0 {
            break;
        }
        rest.extend_from_slice(&tmp[..n]);
    }
    rest.truncate(content_length);

    Ok(Request {
        method,
        path,
        headers,
        body: rest,
    })
}

pub(super) fn find_double_crlf(buf: &[u8]) -> Option<usize> {
    let needle = b"\r\n\r\n";
    if buf.len() < 4 {
        return None;
    }
    for i in 0..=buf.len() - 4 {
        if &buf[i..i + 4] == needle {
            return Some(i);
        }
    }
    None
}

pub(super) async fn write_resp(stream: &mut TcpStream, code: u16, reason: &str, body: &str) -> Result<(), String> {
    let head = format!(
        "HTTP/1.1 {code} {reason}\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type, Authorization\r\n\
         \r\n",
        body.len()
    );
    stream.write_all(head.as_bytes()).await.map_err(|e| format!("write head: {e}"))?;
    stream.write_all(body.as_bytes()).await.map_err(|e| format!("write body: {e}"))?;
    let _ = stream.shutdown().await;
    Ok(())
}

pub(super) async fn write_text(stream: &mut TcpStream, code: u16, reason: &str, body: &str) {
    let head = format!(
        "HTTP/1.1 {code} {reason}\r\n\
         Content-Type: text/plain; charset=utf-8\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         Access-Control-Allow-Origin: *\r\n\
         \r\n",
        body.len()
    );
    let _ = stream.write_all(head.as_bytes()).await;
    let _ = stream.write_all(body.as_bytes()).await;
    let _ = stream.shutdown().await;
}
