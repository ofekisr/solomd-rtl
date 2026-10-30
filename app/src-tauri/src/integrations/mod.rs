//! v2.4 Integrations panel — Tauri commands backing Settings → Integrations.
//!
//! Two surfaces:
//!
//!   * `cli_status()` — `which solomd` + `solomd --version` so the panel
//!     can render "Installed at /usr/local/bin/solomd" (green) or
//!     "Not installed" (faint) without the JS layer having to spawn
//!     processes itself. Mirrors the spawn_blocking pattern from
//!     `git_history.rs` so a slow `which` (e.g. cold NFS PATH) can't
//!     freeze the UI thread.
//!
//!   * `mcp_path()` — absolute path to the bundled `solomd-mcp` sidecar.
//!     Resolved via Tauri's path API rather than hardcoded:
//!     - macOS: `<App>.app/Contents/MacOS/solomd-mcp`
//!     - Windows: `<install dir>\solomd-mcp.exe`
//!     - Linux: alongside the executable
//!     Returns `None` when the sidecar isn't found (e.g. dev builds where
//!     `pnpm tauri dev` skips bundle-time externalBin staging).
//!
//!   * `mcp_claude_desktop_config_path()` — the conventional location of
//!     `claude_desktop_config.json` per OS. The frontend uses this to
//!     wire up the "Open Claude Desktop config file" button without
//!     dragging path glue into TS.

use std::path::PathBuf;
use std::process::Command;

/// Build a `Command` that never flashes a console window on Windows.
/// Without `CREATE_NO_WINDOW` (0x08000000) every probe (`where`, `solomd
/// --version`, …) pops a black cmd window for a frame — very visible when the
/// Integrations settings tab runs its status checks (user report). No-op off
/// Windows.
fn no_window_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    #[allow(unused_mut)]
    let mut c = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000);
    }
    c
}

use serde::Serialize;
use serde_json::Value as JsonValue;
use tauri::{AppHandle, Manager};

mod client_config;
use client_config::{build_solomd_args, read_json_or_empty, splice_solomd_entry, write_json_with_backup, build_solomd_entry};

// ---------------------------------------------------------------------------
// Public types — kept in sync with `app/src/lib/integrations.ts`.
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct CliStatus {
    /// True iff `which solomd` resolved to an executable file.
    pub installed: bool,
    /// Absolute path on disk (None when not installed).
    pub path: Option<String>,
    /// Output of `solomd --version` truncated to the first line. None on
    /// install_failure or non-zero exit.
    pub version: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct McpPath {
    /// Absolute path to the bundled `solomd-mcp` binary, or None if it
    /// couldn't be located (typical in `pnpm tauri dev`).
    pub path: Option<String>,
    /// True iff `path` is `Some` AND the file exists on disk.
    pub bundled: bool,
}

// ---------------------------------------------------------------------------
// CLI status.
// ---------------------------------------------------------------------------

/// Sync impl. Public command below dispatches to spawn_blocking — never
/// call this directly from a Tauri command thread.
pub fn cli_status_inner() -> Result<CliStatus, String> {
    // `which` (Unix) / `where` (Windows). On Windows there's no PATHEXT
    // helper either way; we just check stdout for a valid file.
    #[cfg(target_os = "windows")]
    let probe = no_window_command("where").arg("solomd").output();
    #[cfg(not(target_os = "windows"))]
    let probe = no_window_command("/usr/bin/env").args(["which", "solomd"]).output();

    let path = match probe {
        Ok(out) if out.status.success() => {
            // `where` on Windows can return multiple lines — take the first.
            let s = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .map(|l| l.trim().to_string())
                .filter(|s| !s.is_empty());
            s
        }
        _ => None,
    };

    let installed = path
        .as_ref()
        .map(|p| std::path::Path::new(p).is_file())
        .unwrap_or(false);

    if !installed {
        return Ok(CliStatus {
            installed: false,
            path: None,
            version: None,
        });
    }

    // `solomd --version` — our shell CLI doesn't actually accept --version
    // today, but it does accept `help`. Keep the field for future Rust-port
    // upgrade and try help as a fallback so the panel can show *something*
    // confirming the binary is reachable.
    let version = path.as_ref().and_then(|p| {
        let out = no_window_command(p).arg("--version").output().ok()?;
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .map(|l| l.trim().to_string())
                .filter(|s| !s.is_empty());
            return s;
        }
        // Fall back to a known-good subcommand.
        let out = no_window_command(p).arg("help").output().ok()?;
        if !out.status.success() {
            return None;
        }
        // Strip ANSI escapes (the bash CLI uses colored output).
        let raw = String::from_utf8_lossy(&out.stdout).into_owned();
        let plain = strip_ansi(&raw);
        plain.lines().next().map(|l| l.trim().to_string())
    });

    Ok(CliStatus {
        installed: true,
        path,
        version,
    })
}

#[tauri::command]
pub async fn cli_status() -> Result<CliStatus, String> {
    tauri::async_runtime::spawn_blocking(cli_status_inner)
        .await
        .map_err(|e| format!("join: {e}"))?
}

// ---------------------------------------------------------------------------
// MCP sidecar path.
// ---------------------------------------------------------------------------

/// Resolve the bundled `solomd-mcp` path. Strategy:
///
/// 1. On a Tauri-bundled app, externalBin places it as a *resource* —
///    `app.path().resource_dir()` returns
///    - macOS: `<App>.app/Contents/Resources`
///    - Windows: `<install dir>\resources` (or alongside .exe)
///    - Linux (AppImage): `<mount>/usr/lib/<id>`
///    However, Tauri's externalBin specifically copies the binary next to
///    the main executable on macOS / Windows — *not* into Resources — so
///    we look beside the running executable first.
/// 2. Fallback to `resource_dir/solomd-mcp[.exe]` for AppImage / Linux
///    bundles where externalBin lands inside resources.
fn resolve_mcp_path(app: &AppHandle) -> Option<PathBuf> {
    let exe_name = if cfg!(target_os = "windows") {
        "solomd-mcp.exe"
    } else {
        "solomd-mcp"
    };

    // Sibling of the main exe — the canonical bundled location.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = dir.join(exe_name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    // Resource dir fallback (Linux deb/AppImage put externalBin here).
    if let Ok(dir) = app.path().resource_dir() {
        let candidate = dir.join(exe_name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

#[tauri::command]
pub fn mcp_path(app: AppHandle) -> McpPath {
    let p = resolve_mcp_path(&app);
    let bundled = p.as_ref().map(|x| x.is_file()).unwrap_or(false);
    McpPath {
        path: p.map(|x| x.to_string_lossy().to_string()),
        bundled,
    }
}

// ---------------------------------------------------------------------------
// Claude Desktop config file location.
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn mcp_claude_desktop_config_path(app: AppHandle) -> Option<String> {
    // Convention: same folder Claude Desktop reads.
    //   macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
    //   Windows: %APPDATA%\Claude\claude_desktop_config.json
    //   Linux:   ~/.config/Claude/claude_desktop_config.json (best-effort —
    //            Claude Desktop is mac/win-only at time of writing)
    let parent = if cfg!(target_os = "macos") {
        app.path()
            .home_dir()
            .ok()
            .map(|h| h.join("Library/Application Support/Claude"))
    } else if cfg!(target_os = "windows") {
        std::env::var_os("APPDATA").map(|a| PathBuf::from(a).join("Claude"))
    } else {
        app.path().home_dir().ok().map(|h| h.join(".config/Claude"))
    }?;
    Some(
        parent
            .join("claude_desktop_config.json")
            .to_string_lossy()
            .to_string(),
    )
}

// ---------------------------------------------------------------------------
// Tiny utilities.
// ---------------------------------------------------------------------------

/// Strip a subset of ANSI escape sequences (CSI ... letter). Good enough
/// for the colored output our bash `solomd` script emits.
fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' && chars.peek() == Some(&'[') {
            chars.next(); // consume '['
            // Skip until letter (the "final byte" of CSI).
            for c2 in chars.by_ref() {
                if c2.is_ascii_alphabetic() {
                    break;
                }
            }
        } else {
            out.push(c);
        }
    }
    out
}

// ---------------------------------------------------------------------------
// v4.4.5 MCP auto-install — detect + inject + remove across 6 AI clients.
//
// One-shot user flow:
//
//   1. First-run wizard calls `detect_ai_clients()`.
//   2. UI shows checklist with which configs already exist and whether
//      they already mention solomd.
//   3. User picks workspace + allow-write, clicks "Inject".
//   4. UI calls `inject_mcp(client_id, workspace, allow_write)` per
//      checked client. Each call backs up the original config
//      (`<path>.bak.<unix_seconds>`) and merges in the solomd entry.
//   5. User restarts the AI client (we surface a reminder in the UI).
//
// Each client has its own config schema — Claude Desktop, Claude Code, and
// Cursor share `mcpServers.<name> = { command, args }`; Cline adds
// `disabled` + `autoApprove`; Continue uses `mcp: [{ name, ... }]` (an
// array, not a map); Zed uses `context_servers.<name> = { command: {
// path, args }, settings: {} }`. The injection function dispatches on
// `client_id`.

#[derive(Serialize, Debug, Clone)]
pub struct AiClient {
    pub id: &'static str,
    pub display_name: &'static str,
    pub config_path: String,
    pub config_exists: bool,
    pub config_dir_exists: bool,
    pub has_solomd_entry: bool,
}

/// Resolve a client's MCP config path. Returns `None` when we can't infer
/// it (eg. Linux + Claude Desktop, which doesn't ship for Linux).
fn ai_client_config_path(client_id: &str, app: &AppHandle) -> Option<PathBuf> {
    let home = app.path().home_dir().ok();

    match client_id {
        "claude-desktop" => {
            if cfg!(target_os = "macos") {
                home.map(|h| h.join("Library/Application Support/Claude/claude_desktop_config.json"))
            } else if cfg!(target_os = "windows") {
                std::env::var_os("APPDATA")
                    .map(|a| PathBuf::from(a).join("Claude/claude_desktop_config.json"))
            } else {
                // Claude Desktop has no Linux build as of writing — return
                // the conventional path anyway so the UI can still surface
                // "expected here when it lands".
                home.map(|h| h.join(".config/Claude/claude_desktop_config.json"))
            }
        }
        // Claude Code keeps user-scope MCP servers in ~/.claude.json — the
        // single dotfile, NOT ~/.claude/mcp.json (a path it never reads).
        // The schema is the same `mcpServers.<name> = { command, args }`
        // map Claude Desktop uses, so the splice below needs no special
        // case; only the location differs.
        "claude-code" => home.map(|h| h.join(".claude.json")),
        "cursor" => home.map(|h| h.join(".cursor/mcp.json")),
        "cline" => {
            // VS Code globalStorage. Path varies by OS but follows the same
            // shape under each platform's user-data dir.
            if cfg!(target_os = "macos") {
                home.map(|h| h.join(
                    "Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
                ))
            } else if cfg!(target_os = "windows") {
                std::env::var_os("APPDATA").map(|a| {
                    PathBuf::from(a).join(
                        "Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
                    )
                })
            } else {
                home.map(|h| h.join(
                    ".config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
                ))
            }
        }
        "continue" => home.map(|h| h.join(".continue/config.json")),
        "zed" => {
            if cfg!(target_os = "macos") || cfg!(target_os = "linux") {
                home.map(|h| h.join(".config/zed/settings.json"))
            } else if cfg!(target_os = "windows") {
                std::env::var_os("APPDATA").map(|a| PathBuf::from(a).join("Zed/settings.json"))
            } else {
                None
            }
        }
        _ => None,
    }
}

/// "Is this client installed on this machine?" probe. Usually the config
/// file's own directory — but Claude Code's config is `~/.claude.json`,
/// whose parent is `$HOME` and therefore always exists, so probe the
/// `~/.claude` data dir instead.
fn ai_client_probe_dir(client_id: &str, app: &AppHandle) -> Option<PathBuf> {
    if client_id == "claude-code" {
        return app.path().home_dir().ok().map(|h| h.join(".claude"));
    }
    ai_client_config_path(client_id, app).and_then(|p| p.parent().map(|p| p.to_path_buf()))
}

const AI_CLIENTS: &[(&str, &str)] = &[
    ("claude-desktop", "Claude Desktop"),
    ("claude-code", "Claude Code"),
    ("cursor", "Cursor"),
    ("cline", "Cline (VS Code)"),
    ("continue", "Continue.dev"),
    ("zed", "Zed"),
];

/// Does this config already declare a `solomd` MCP server?
///
/// Parses the config and looks under the key the client actually uses. A
/// substring match is not good enough: `~/.claude.json` (Claude Code) also
/// carries per-project history, so any user who has opened a folder with
/// "solomd" in its path would otherwise read as "already configured". Falls
/// back to the substring check only when the file doesn't parse as JSON.
fn config_has_solomd(client_id: &str, raw: &str) -> bool {
    let Ok(v) = serde_json::from_str::<JsonValue>(raw) else {
        return raw.contains("solomd");
    };
    match client_id {
        "continue" => v
            .get("mcp")
            .and_then(|m| m.as_array())
            .map(|list| {
                list.iter()
                    .any(|e| e.get("name").and_then(|n| n.as_str()) == Some("solomd"))
            })
            .unwrap_or(false),
        "zed" => v
            .get("context_servers")
            .and_then(|m| m.get("solomd"))
            .is_some(),
        // claude-desktop / claude-code / cursor / cline
        _ => v.get("mcpServers").and_then(|m| m.get("solomd")).is_some(),
    }
}

/// List every supported AI client, whether its config file / directory
/// already exists on this machine, and whether the config already mentions
/// "solomd" (cheap substring check — avoids parsing JSON just for the
/// summary view).
#[tauri::command]
pub fn detect_ai_clients(app: AppHandle) -> Vec<AiClient> {
    AI_CLIENTS
        .iter()
        .filter_map(|(id, display)| {
            let path = ai_client_config_path(id, &app)?;
            let config_exists = path.is_file();
            let config_dir_exists = ai_client_probe_dir(id, &app)
                .map(|p| p.is_dir())
                .unwrap_or(false);
            let has_solomd_entry = if config_exists {
                std::fs::read_to_string(&path)
                    .map(|s| config_has_solomd(id, &s))
                    .unwrap_or(false)
            } else {
                false
            };
            Some(AiClient {
                id,
                display_name: display,
                config_path: path.to_string_lossy().to_string(),
                config_exists,
                config_dir_exists,
                has_solomd_entry,
            })
        })
        .collect()
}

/// Frontend command: merge a solomd entry into one client's config.
#[tauri::command]
pub fn inject_mcp(
    app: AppHandle,
    client_id: String,
    workspace: String,
    allow_write: bool,
) -> Result<String, String> {
    let config_path = ai_client_config_path(&client_id, &app)
        .ok_or_else(|| format!("no config path for {client_id} on this OS"))?;
    let mcp_path = resolve_mcp_path(&app)
        .ok_or_else(|| "bundled solomd-mcp not found".to_string())?
        .to_string_lossy()
        .to_string();
    let args = build_solomd_args(&workspace, allow_write);
    let entry = build_solomd_entry(&client_id, &mcp_path, &args);

    let mut config = read_json_or_empty(&config_path)?;
    splice_solomd_entry(&client_id, &mut config, entry)?;
    write_json_with_backup(&config_path, &config)?;
    Ok(config_path.to_string_lossy().to_string())
}

/// Frontend command: remove the solomd entry from one client's config
/// (used by uninstall + by the wizard's "undo last inject" affordance).
#[tauri::command]
pub fn remove_mcp(app: AppHandle, client_id: String) -> Result<(), String> {
    let config_path = ai_client_config_path(&client_id, &app)
        .ok_or_else(|| format!("no config path for {client_id} on this OS"))?;
    if !config_path.exists() {
        return Ok(());
    }
    let mut config = read_json_or_empty(&config_path)?;
    match client_id.as_str() {
        "claude-desktop" | "claude-code" | "cursor" | "cline" => {
            if let Some(servers) = config
                .get_mut("mcpServers")
                .and_then(|v| v.as_object_mut())
            {
                servers.remove("solomd");
            }
        }
        "continue" => {
            if let Some(list) = config.get_mut("mcp").and_then(|v| v.as_array_mut()) {
                list.retain(|e| e.get("name").and_then(|n| n.as_str()) != Some("solomd"));
            }
        }
        "zed" => {
            if let Some(servers) = config
                .get_mut("context_servers")
                .and_then(|v| v.as_object_mut())
            {
                servers.remove("solomd");
            }
        }
        _ => return Err(format!("unknown client_id: {client_id}")),
    }
    write_json_with_backup(&config_path, &config)?;
    Ok(())
}

#[cfg(test)]
mod tests;
