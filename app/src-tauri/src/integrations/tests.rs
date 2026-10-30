use super::*;
use serde_json::json;

#[test]
fn strip_ansi_drops_csi() {
    assert_eq!(strip_ansi("\x1b[0;32mok\x1b[0m"), "ok");
    assert_eq!(strip_ansi("plain"), "plain");
    assert_eq!(strip_ansi("\x1b[1mbold\x1b[0m + \x1b[31mred\x1b[0m"), "bold + red");
}

#[test]
fn splice_claude_desktop_into_empty() {
    let mut c = json!({});
    let entry = json!({ "command": "/bin/solomd-mcp", "args": ["--workspace", "/notes"] });
    splice_solomd_entry("claude-desktop", &mut c, entry.clone()).unwrap();
    assert_eq!(c["mcpServers"]["solomd"], entry);
}

#[test]
fn splice_claude_desktop_preserves_other_servers() {
    let mut c = json!({
        "mcpServers": {
            "other": { "command": "/bin/other", "args": [] }
        },
        "globalShortcut": "Cmd+Shift+J"
    });
    let entry = json!({ "command": "/bin/solomd-mcp", "args": [] });
    splice_solomd_entry("claude-desktop", &mut c, entry.clone()).unwrap();
    assert_eq!(c["mcpServers"]["solomd"], entry);
    assert!(c["mcpServers"]["other"].is_object());
    assert_eq!(c["globalShortcut"], "Cmd+Shift+J");
}

#[test]
fn splice_continue_replaces_existing_solomd() {
    let mut c = json!({
        "mcp": [
            { "name": "solomd", "command": "/old/path", "args": [] },
            { "name": "other", "command": "/bin/other", "args": [] }
        ]
    });
    let entry = json!({ "name": "solomd", "command": "/new/path", "args": ["--allow-write"] });
    splice_solomd_entry("continue", &mut c, entry.clone()).unwrap();
    let arr = c["mcp"].as_array().unwrap();
    assert_eq!(arr.len(), 2);
    let solomd = arr.iter().find(|e| e["name"] == "solomd").unwrap();
    assert_eq!(solomd["command"], "/new/path");
}

#[test]
fn splice_zed_uses_nested_command_object() {
    let mut c = json!({});
    let entry = json!({
        "command": { "path": "/bin/solomd-mcp", "args": ["--workspace", "/notes"] },
        "settings": {}
    });
    splice_solomd_entry("zed", &mut c, entry.clone()).unwrap();
    assert_eq!(c["context_servers"]["solomd"], entry);
}

#[test]
fn detect_reads_the_right_key_per_client() {
    let claude = r#"{"mcpServers":{"solomd":{"command":"/bin/solomd-mcp"}}}"#;
    assert!(config_has_solomd("claude-code", claude));
    assert!(config_has_solomd("claude-desktop", claude));
    assert!(config_has_solomd(
        "continue",
        r#"{"mcp":[{"name":"solomd","command":"/bin/solomd-mcp"}]}"#
    ));
    assert!(config_has_solomd(
        "zed",
        r#"{"context_servers":{"solomd":{"command":{"path":"/bin/solomd-mcp"}}}}"#
    ));
}

#[test]
fn detect_ignores_solomd_mentions_outside_the_server_map() {
    // ~/.claude.json carries per-project history. A user who has opened
    // ~/code/solomd must still read as "not configured".
    let claude = r#"{"projects":{"/Users/me/code/solomd":{"history":[]}},"mcpServers":{}}"#;
    assert!(!config_has_solomd("claude-code", claude));
    // Wrong-shaped configs don't false-positive either.
    assert!(!config_has_solomd(
        "zed",
        r#"{"mcpServers":{"solomd":{"command":"/bin/solomd-mcp"}}}"#
    ));
}

#[test]
fn detect_falls_back_to_substring_on_unparseable_config() {
    assert!(config_has_solomd("claude-code", "{ not json — solomd"));
    assert!(!config_has_solomd("claude-code", "{ not json"));
}
