//! v2.5 Theme marketplace — Tauri commands backing Settings → "Browse community themes".
//!
//! Themes are plain `.css` files that the user installs into their per-user
//! config dir and points the existing `customCssPath` setting at. There is
//! no plugin runtime, no sandbox — these are just stylesheets that override
//! the CSS variables defined in `app/src/styles/main.css`.
//!
//! Layout on disk (`<config_dir>` is whatever Tauri's `path::app_config_dir`
//! returns for this OS):
//!
//!   <config_dir>/
//!     themes/
//!       amber-dark.css
//!       nord-light.css
//!       …
//!
//! The frontend fetches the curator manifest at
//! `https://solomd.app/themes/index.json` and downloads individual `.css`
//! files via `fetch()` (Tauri 2's CSP allows arbitrary HTTPS for the bundled
//! webview). The Rust side here only deals with the *local* filesystem —
//! writing, listing, removing. Network is intentionally kept on the JS side
//! so the manifest cache lives in Pinia memory.
//!
//! Why not write to the workspace folder? Themes are a per-installation
//! preference, not workspace state — they should follow the user across
//! workspaces, and they should not be committed to AutoGit.

use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Manager};

/// Resolve `<config_dir>/themes`, creating the directory if needed.
fn themes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = super::portable::app_config_dir(app.path())
        .map_err(|e| format!("app_config_dir: {e}"))?;
    let dir = base.join("themes");
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("mkdir {}: {e}", dir.display()))?;
    }
    Ok(dir)
}

/// Theme ids are user-facing slugs from the curator manifest. We constrain
/// them tightly so they can't escape the themes dir or shadow OS files.
fn validate_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 64 {
        return Err("invalid theme id (length 1-64)".into());
    }
    if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("invalid theme id (allowed: a-z 0-9 - _)".into());
    }
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct ThemeInstallResult {
    /// Absolute path the CSS landed at — the frontend pipes this directly
    /// into `settings.customCssPath` so the existing
    /// `lib/custom-theme.ts::loadCustomTheme` watcher picks it up.
    pub path: String,
}

/// Write `css` to `<config_dir>/themes/<id>.css`, overwriting any prior
/// install. Returns the absolute path.
#[tauri::command]
pub fn theme_install(app: AppHandle, id: String, css: String) -> Result<ThemeInstallResult, String> {
    validate_id(&id)?;
    let dir = themes_dir(&app)?;
    let path = dir.join(format!("{id}.css"));
    std::fs::write(&path, css.as_bytes())
        .map_err(|e| format!("write {}: {e}", path.display()))?;
    Ok(ThemeInstallResult {
        path: path.to_string_lossy().to_string(),
    })
}

/// Delete a previously-installed theme. No-op if the file is already gone.
#[tauri::command]
pub fn theme_uninstall(app: AppHandle, id: String) -> Result<(), String> {
    validate_id(&id)?;
    let dir = themes_dir(&app)?;
    let path = dir.join(format!("{id}.css"));
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("remove {}: {e}", path.display()))?;
    }
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct InstalledTheme {
    pub id: String,
    pub path: String,
}

/// List every `.css` under `<config_dir>/themes`. Files with non-slug
/// stems (e.g. weird user-dropped names) are silently skipped — they
/// can't have come from `theme_install` so we shouldn't claim them.
#[tauri::command]
pub fn theme_list_installed(app: AppHandle) -> Result<Vec<InstalledTheme>, String> {
    let dir = themes_dir(&app)?;
    let mut out: Vec<InstalledTheme> = Vec::new();
    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(out), // dir may not exist on first run
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("css") {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        if validate_id(stem).is_err() {
            continue;
        }
        out.push(InstalledTheme {
            id: stem.to_string(),
            path: path.to_string_lossy().to_string(),
        });
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

const JSON_EXT: &str = "json";

#[derive(Debug, Serialize)]
pub struct ThemeJsonFile {
    pub id: String,
    pub json: String,
}

fn save_json_in(dir: &std::path::Path, id: &str, json: &str) -> Result<(), String> {
    validate_id(id)?;
    let path = dir.join(format!("{id}.{JSON_EXT}"));
    std::fs::write(&path, json.as_bytes()).map_err(|e| format!("write {}: {e}", path.display()))
}

fn list_json_in(dir: &std::path::Path) -> Result<Vec<ThemeJsonFile>, String> {
    let Ok(entries) = std::fs::read_dir(dir) else { return Ok(Vec::new()) };
    let mut out = Vec::new();
    for path in entries.flatten().map(|e| e.path()) {
        if path.extension().and_then(|s| s.to_str()) != Some(JSON_EXT) { continue; }
        let Some(id) = path.file_stem().and_then(|s| s.to_str()) else { continue };
        if validate_id(id).is_err() { continue; }
        let Ok(json) = std::fs::read_to_string(&path) else { continue };
        out.push(ThemeJsonFile { id: id.to_string(), json });
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

fn remove_json_in(dir: &std::path::Path, id: &str) -> Result<(), String> {
    validate_id(id)?;
    let path = dir.join(format!("{id}.{JSON_EXT}"));
    if !path.exists() { return Ok(()); }
    std::fs::remove_file(&path).map_err(|e| format!("remove {}: {e}", path.display()))
}

#[tauri::command]
pub fn theme_json_save(app: AppHandle, id: String, json: String) -> Result<(), String> {
    save_json_in(&themes_dir(&app)?, &id, &json)
}

#[tauri::command]
pub fn theme_json_list(app: AppHandle) -> Result<Vec<ThemeJsonFile>, String> {
    list_json_in(&themes_dir(&app)?)
}

#[tauri::command]
pub fn theme_json_remove(app: AppHandle, id: String) -> Result<(), String> {
    remove_json_in(&themes_dir(&app)?, &id)
}

#[cfg(test)]
mod tests {
    use super::validate_id;

    #[test]
    fn id_validation_accepts_slugs() {
        assert!(validate_id("amber-dark").is_ok());
        assert!(validate_id("nord_light").is_ok());
        assert!(validate_id("a").is_ok());
    }

    #[test]
    fn id_validation_rejects_traversal() {
        assert!(validate_id("../etc/passwd").is_err());
        assert!(validate_id("foo/bar").is_err());
        assert!(validate_id(".").is_err());
        assert!(validate_id("").is_err());
        // 65 chars
        assert!(validate_id(&"a".repeat(65)).is_err());
    }
}

#[cfg(test)]
mod json_tests {
    use super::*;

    #[test]
    fn json_round_trip_in_a_dir() {
        let dir = std::env::temp_dir().join(format!("solomd-theme-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        save_json_in(&dir, "my-theme", "{\"id\":\"my-theme\"}").unwrap();
        let list = list_json_in(&dir).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "my-theme");
        remove_json_in(&dir, "my-theme").unwrap();
        assert!(list_json_in(&dir).unwrap().is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn json_rejects_path_escape() {
        let dir = std::env::temp_dir();
        assert!(save_json_in(&dir, "../evil", "{}").is_err());
    }
}
