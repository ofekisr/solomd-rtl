use chardetng::{EncodingDetector, Iso2022JpDetection, Utf8Detection};
use encoding_rs::{Encoding, UTF_8};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileReadResult {
    pub content: String,
    pub encoding: String,
    pub language: String,
    pub had_bom: bool,
}

/// Read a file from disk, auto-detecting its text encoding (UTF-8/16, GBK, etc.)
/// and returning UTF-8 content along with the original encoding label so we can
/// re-save in the same encoding later.
///
/// Async wrapper to keep file I/O off the IPC thread — see the audit note in
/// `feedback_tauri_sync_command_audit.md`. The inner is exposed for tests.
#[tauri::command]
pub async fn read_file(path: String) -> Result<FileReadResult, String> {
    tauri::async_runtime::spawn_blocking(move || read_file_inner(path))
        .await
        .map_err(|e| format!("join: {e}"))?
}

pub fn read_file_inner(path: String) -> Result<FileReadResult, String> {
    // #139 — iOS delivers a Files-app open as a copy in the app's volatile
    // `tmp/<bundleid>-Inbox/` dir. That copy can lag behind the open event or
    // be reclaimed by the system, so a single `fs::read` intermittently hit
    // ENOENT ("looked successful sometimes"). Retry briefly on NotFound to win
    // the race; if it still fails, attach the parent-dir listing so the cause
    // (empty dir = gone, other name = mismatch, missing dir = bad path) is
    // visible in the diagnostic. iOS-only: on desktop a missing file is just
    // missing (stale recent, moved in Finder) and should fail fast, not stall
    // a spawn_blocking slot for 800ms. Non-NotFound errors return immediately.
    let bytes = match fs::read(&path) {
        Ok(b) => b,
        #[cfg(target_os = "ios")]
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            // Keep the LAST error, not the initial NotFound: if the file shows
            // up mid-retry but with a transient permission/IO error, that is
            // the truthful cause to report.
            let mut last_err = e;
            let mut recovered: Option<Vec<u8>> = None;
            for _ in 0..8 {
                std::thread::sleep(std::time::Duration::from_millis(100));
                match fs::read(&path) {
                    Ok(b) => {
                        recovered = Some(b);
                        break;
                    }
                    Err(re) => last_err = re,
                }
            }
            match recovered {
                Some(b) => b,
                None => {
                    let listing = match Path::new(&path).parent() {
                        Some(dir) => match fs::read_dir(dir) {
                            Ok(rd) => {
                                let names: Vec<String> = rd
                                    .filter_map(|e| e.ok())
                                    .map(|e| e.file_name().to_string_lossy().into_owned())
                                    .collect();
                                format!("dir {} => [{}]", dir.display(), names.join(", "))
                            }
                            Err(de) => format!("dir {} unreadable: {de}", dir.display()),
                        },
                        None => "no parent dir".to_string(),
                    };
                    return Err(format!("read failed: {last_err} | {listing}"));
                }
            }
        }
        Err(e) => return Err(format!("read failed: {e}")),
    };

    // Try BOM first.
    let (encoding, had_bom, body) = if let Some((enc, bom_len)) = sniff_bom(&bytes) {
        (enc, true, &bytes[bom_len..])
    } else {
        // chardetng for everything else.
        let mut detector = EncodingDetector::new(Iso2022JpDetection::Allow);
        detector.feed(&bytes, true);
        let enc = detector.guess(None, Utf8Detection::Allow);
        (enc, false, bytes.as_slice())
    };

    let (cow, _used_enc, had_errors) = encoding.decode_without_bom_handling_and_without_replacement(body)
        .map(|c| (c, encoding, false))
        .unwrap_or_else(|| {
            let (c, used, errs) = encoding.decode(body);
            (c, used, errs)
        });

    if had_errors {
        // Fall back to lossy UTF-8 so the user sees something rather than an error.
        let lossy = String::from_utf8_lossy(body).into_owned();
        return Ok(FileReadResult {
            content: lossy,
            encoding: encoding.name().to_string(),
            language: detect_language(&path),
            had_bom,
        });
    }

    Ok(FileReadResult {
        content: cow.into_owned(),
        encoding: encoding.name().to_string(),
        language: detect_language(&path),
        had_bom,
    })
}

/// Write a UTF-8 string back to disk in the requested encoding.
/// `encoding` should be a label like "UTF-8", "GBK", "UTF-16LE".
///
/// v4.0 Pillar 2 — also fires the `on-save` / `on-tag-add` recipe
/// triggers if the saved file lives inside the active workspace. The
/// dispatch is async + best-effort so a save never blocks on a recipe.
/// `workspace` is optional; when absent, no recipe dispatch happens
/// (this keeps callers that save scratch files outside any workspace
/// from accidentally triggering recipes against the wrong vault).
#[tauri::command]
pub async fn write_file(
    app: tauri::AppHandle,
    path: String,
    content: String,
    encoding: String,
    workspace: Option<String>,
) -> Result<(), String> {
    let path_for_dispatch = path.clone();
    let content_for_dispatch = content.clone();
    tauri::async_runtime::spawn_blocking({
        let path = path.clone();
        let content = content.clone();
        move || write_file_inner(path, content, encoding)
    })
    .await
    .map_err(|e| format!("join: {e}"))??;

    // After a successful save, fire the on-save / on-tag-add triggers
    // for the active workspace. We re-extract tags from the *content*
    // we just wrote (rather than re-reading from disk) so the trigger
    // sees the same bytes the user just saved.
    #[cfg(not(target_os = "android"))]
    if let Some(ws) = workspace {
        let ws_path = std::path::PathBuf::from(&ws);
        let new_tags = extract_tags_for_dispatch(&content_for_dispatch);
        // Detached — we don't want the save IPC call to wait on a
        // recipe firing.
        tauri::async_runtime::spawn(async move {
            super::super::recipe_runner::dispatch_on_save(app, ws_path, path_for_dispatch, new_tags).await;
        });
    }
    #[cfg(target_os = "android")]
    {
        let _ = (workspace, content_for_dispatch, path_for_dispatch, app);
    }

    Ok(())
}

/// Quick-and-dirty tag extraction used by the on-tag-add trigger. We
/// reuse the same scanner shape as `mcp-server/src/workspace.rs` —
/// duplicated here because P4 (Federation) hasn't merged yet and we
/// don't want to depend on the mcp-server crate from inside the Tauri
/// app. After P4 lands, swap this for the canonical helper.
///
/// Android disables the recipe-runner / on-save trigger surface (AutoGit
/// and the whole desktop-class workflow), so this helper is unused on
/// that target. cfg-gating the definition silences the dead_code
/// warning that started showing up after v4.0 Android port landed.
#[cfg(not(target_os = "android"))]
fn extract_tags_for_dispatch(body: &str) -> Vec<String> {
    let mut tags: Vec<String> = Vec::new();
    let mut in_fence = false;
    for line in body.lines() {
        if line.trim_start().starts_with("```") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        let chars: Vec<char> = line.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            let c = chars[i];
            let preceded_ok = i == 0 || chars[i - 1].is_whitespace();
            if c == '#' && preceded_ok {
                if i + 1 < chars.len() && chars[i + 1].is_alphanumeric() {
                    let mut j = i + 1;
                    while j < chars.len()
                        && (chars[j].is_alphanumeric()
                            || chars[j] == '_'
                            || chars[j] == '/'
                            || chars[j] == '-')
                    {
                        j += 1;
                    }
                    tags.push(chars[i + 1..j].iter().collect());
                    i = j;
                    continue;
                }
            }
            i += 1;
        }
    }
    tags.sort();
    tags.dedup();
    tags
}

pub fn write_file_inner(path: String, content: String, encoding: String) -> Result<(), String> {
    let enc = Encoding::for_label(encoding.as_bytes()).unwrap_or(UTF_8);
    let (cow, _, had_errors) = enc.encode(&content);
    if had_errors {
        return Err(format!(
            "Some characters cannot be represented in {}",
            enc.name()
        ));
    }
    fs::write(&path, cow.as_ref()).map_err(|e| format!("write failed: {e}"))?;

    super::super::watcher::mark_self_write(&path);

    Ok(())
}

/// Read raw bytes from disk. v3.5: counterpart to `write_binary_file` —
/// the export pipeline (PDF / DOCX / PNG) needs to embed local images
/// into the output document, which means it has to read those image
/// bytes regardless of the webview's CSP. Returns a `Vec<u8>`; on the
/// JS side this lands as `number[]` so the caller can construct a Blob
/// or base64-encode for the renderer. Async + spawn_blocking like its
/// siblings so a slow disk doesn't queue parallel IPC calls.
#[tauri::command]
pub async fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        fs::read(&path).map_err(|e| format!("read failed: {e}"))
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

/// Write raw bytes to disk. Used for binary export targets like DOCX/PDF.
#[tauri::command]
pub async fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || write_binary_file_inner(path, data))
        .await
        .map_err(|e| format!("join: {e}"))?
}

pub fn write_binary_file_inner(path: String, data: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("mkdir failed: {e}"))?;
        }
    }
    fs::write(&path, &data).map_err(|e| format!("write failed: {e}"))?;
    // #148 follow-up — binary writes (content:// imports, pasted images) are
    // our own writes too; without the mark, a late watcher event for them
    // pops the "File Changed on Disk" dialog on the file the user just opened.
    super::super::watcher::mark_self_write(&path);
    Ok(())
}

fn sniff_bom(bytes: &[u8]) -> Option<(&'static Encoding, usize)> {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        Some((encoding_rs::UTF_8, 3))
    } else if bytes.starts_with(&[0xFF, 0xFE]) {
        Some((encoding_rs::UTF_16LE, 2))
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        Some((encoding_rs::UTF_16BE, 2))
    } else {
        None
    }
}

fn detect_language(path: &str) -> String {
    let name = Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if matches!(name.as_str(),
        ".bashrc" | ".bash_profile" | ".bash_login" | ".bash_logout" | ".profile"
        | ".zshrc" | ".zshenv" | ".zprofile" | ".zlogin" | ".zlogout"
    ) {
        return "bash".to_string();
    }
    let ext = Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "md" | "markdown" | "mdown" | "mkd" => "markdown".to_string(),
        "mmap" | "xmind" => "mindmap".to_string(),
        "js" | "jsx" | "mjs" | "cjs" => "javascript".to_string(),
        "ts" | "tsx" | "mts" | "cts" => "typescript".to_string(),
        "vue" => "vue".to_string(),
        "svelte" => "svelte".to_string(),
        "scss" => "scss".to_string(),
        "less" => "less".to_string(),
        "sass" => "sass".to_string(),
        "py" | "pyj" => "python".to_string(),
        "rs" => "rust".to_string(),
        "html" | "htm" => "html".to_string(),
        "css" => "css".to_string(),
        "java" => "java".to_string(),
        "json" | "jsonc" => "json".to_string(),
        "yaml" | "yml" => "yaml".to_string(),
        "xml" => "xml".to_string(),
        "c" | "cpp" | "cc" | "h" | "hpp" => "cpp".to_string(),
        "go" => "go".to_string(),
        "sql" => "sql".to_string(),
        "sh" | "bash" | "zsh" | "shell" => "bash".to_string(),
        _ => "plaintext".to_string(),
    }
}

#[cfg(test)]
mod file_language_tests {
    use super::detect_language;

    #[test]
    fn routes_code_files_to_their_language() {
        let cases = [
            ("example.py", "python"), ("EXAMPLE.PY", "python"),
            ("example.pyj", "python"), ("EXAMPLE.PYJ", "python"),
            ("example.js", "javascript"), ("example.jsx", "javascript"),
            ("example.mjs", "javascript"), ("example.cjs", "javascript"),
            ("example.ts", "typescript"), ("example.tsx", "typescript"),
            ("example.rs", "rust"), ("example.html", "html"), ("example.htm", "html"),
            ("example.css", "css"), ("example.json", "json"), ("example.java", "java"),
            ("example.yml", "yaml"), ("example.xml", "xml"),
            ("example.cpp", "cpp"), ("example.h", "cpp"),
            ("example.go", "go"), ("example.sql", "sql"),
            ("notes.full.md", "markdown"), ("README", "plaintext"),
            (".py", "plaintext"), ("example.unknown", "plaintext"),
            ("example.mts", "typescript"), ("example.cts", "typescript"),
            ("App.vue", "vue"), ("App.svelte", "svelte"),
            ("a.scss", "scss"), ("a.less", "less"), ("a.sass", "sass"), ("a.jsonc", "json"),
            ("script.sh", "bash"), ("SCRIPT.SH", "bash"),
            ("script.bash", "bash"), ("script.zsh", "bash"), ("script.shell", "bash"),
            (".bashrc", "bash"), (".bash_profile", "bash"), (".bash_login", "bash"),
            (".bash_logout", "bash"), (".profile", "bash"), (".zshrc", "bash"),
            (".zshenv", "bash"), (".zprofile", "bash"), (".zlogin", "bash"),
            (".zlogout", "bash"), ("/home/user/.zshrc", "bash"),
        ];
        for (path, expected) in cases {
            assert_eq!(detect_language(path), expected, "{path}");
        }
    }
}

