use std::path::PathBuf;

use serde_json::{json, Value as JsonValue};

/// Build the solomd-mcp command line for a given client's config schema.
/// `mcp_path` is the absolute path to the bundled `solomd-mcp` binary;
/// `workspace` and `allow_write` come from the UI.
pub(super) fn build_solomd_args(workspace: &str, allow_write: bool) -> Vec<String> {
    let mut args = vec!["--workspace".to_string(), workspace.to_string()];
    if allow_write {
        args.push("--allow-write".to_string());
    }
    args
}

/// Read JSON from disk, returning an empty `{}` if the file doesn't exist.
/// Any parse error is surfaced — we deliberately refuse to silently clobber
/// a config file the user has hand-edited into something we can't read.
pub(super) fn read_json_or_empty(path: &PathBuf) -> Result<JsonValue, String> {
    if !path.exists() {
        return Ok(json!({}));
    }
    let raw = std::fs::read_to_string(path).map_err(|e| format!("read {}: {e}", path.display()))?;
    if raw.trim().is_empty() {
        return Ok(json!({}));
    }
    serde_json::from_str(&raw).map_err(|e| format!("parse {}: {e}", path.display()))
}

/// Write JSON back with two-space pretty-printing. Creates parent
/// directories as needed. Backs up the original (when present) to
/// `<path>.bak.<unix_seconds>` so the user can recover from any
/// botched merge.
pub(super) fn write_json_with_backup(path: &PathBuf, value: &JsonValue) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir {}: {e}", parent.display()))?;
    }
    if path.exists() {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let backup = path.with_extension(format!("bak.{ts}"));
        std::fs::copy(path, &backup)
            .map_err(|e| format!("backup {} -> {}: {e}", path.display(), backup.display()))?;
    }
    let body = serde_json::to_string_pretty(value).map_err(|e| format!("serialize: {e}"))?;
    std::fs::write(path, body + "\n").map_err(|e| format!("write {}: {e}", path.display()))?;
    Ok(())
}

/// Build the solomd MCP server entry in the shape the given client
/// expects. Returns the value to set under the client's MCP-server map
/// (or, for Continue's array, the single element to insert).
pub(super) fn build_solomd_entry(client_id: &str, mcp_path: &str, args: &[String]) -> JsonValue {
    match client_id {
        "zed" => json!({
            "command": { "path": mcp_path, "args": args },
            "settings": {}
        }),
        "cline" => json!({
            "command": mcp_path,
            "args": args,
            "disabled": false,
            // Pre-approve the read-only tools so Cline doesn't ask the user
            // for confirmation on every list_notes / read_note. Writes still
            // prompt because the user only sees them after the wizard
            // chose to opt in to --allow-write.
            "autoApprove": [
                "list_notes", "read_note", "search",
                "get_outline", "get_backlinks", "list_tags",
                "autogit_log", "autogit_diff", "sync_status",
                "share_url", "read_agent_trace"
            ]
        }),
        "continue" => json!({
            "name": "solomd",
            "command": mcp_path,
            "args": args
        }),
        _ => json!({
            "command": mcp_path,
            "args": args
        }),
    }
}

/// Surgical insert/update of the solomd entry under whichever top-level
/// key the client uses.
pub(super) fn splice_solomd_entry(
    client_id: &str,
    config: &mut JsonValue,
    entry: JsonValue,
) -> Result<(), String> {
    match client_id {
        "claude-desktop" | "claude-code" | "cursor" => {
            let map = config
                .as_object_mut()
                .ok_or("root is not a JSON object")?;
            let servers = map
                .entry("mcpServers")
                .or_insert_with(|| json!({}))
                .as_object_mut()
                .ok_or("mcpServers is not a JSON object")?;
            servers.insert("solomd".to_string(), entry);
        }
        "cline" => {
            let map = config
                .as_object_mut()
                .ok_or("root is not a JSON object")?;
            let servers = map
                .entry("mcpServers")
                .or_insert_with(|| json!({}))
                .as_object_mut()
                .ok_or("mcpServers is not a JSON object")?;
            servers.insert("solomd".to_string(), entry);
        }
        "continue" => {
            let map = config
                .as_object_mut()
                .ok_or("root is not a JSON object")?;
            let list = map
                .entry("mcp")
                .or_insert_with(|| json!([]))
                .as_array_mut()
                .ok_or("mcp is not a JSON array")?;
            // Replace existing solomd entry if present; otherwise append.
            if let Some(existing) = list
                .iter_mut()
                .find(|e| e.get("name").and_then(|n| n.as_str()) == Some("solomd"))
            {
                *existing = entry;
            } else {
                list.push(entry);
            }
        }
        "zed" => {
            let map = config
                .as_object_mut()
                .ok_or("root is not a JSON object")?;
            let servers = map
                .entry("context_servers")
                .or_insert_with(|| json!({}))
                .as_object_mut()
                .ok_or("context_servers is not a JSON object")?;
            servers.insert("solomd".to_string(), entry);
        }
        _ => return Err(format!("unknown client_id: {client_id}")),
    }
    Ok(())
}
