use super::*;

// ---------------------------------------------------------------------------
// Capture core — pure: takes a JSON body, returns a created file path.
// Exposed for the e2e test as `capture_write_inner`.
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub enum CaptureError {
    NoWorkspace,
    BadRequest(String),
    Io(String),
}

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CaptureError::NoWorkspace => write!(f, "no workspace folder open"),
            CaptureError::BadRequest(s) => write!(f, "{s}"),
            CaptureError::Io(s) => write!(f, "{s}"),
        }
    }
}

#[derive(Debug, Deserialize)]
pub(super) struct CaptureBody {
    pub(super) title: Option<String>,
    pub(super) content: Option<String>,
    pub(super) url: Option<String>,
    pub(super) tags: Option<Vec<String>>,
    /// Defaults to true — captures land in the inbox by default.
    pub(super) inbox: Option<bool>,
    /// v2.4 append mode (iOS Shortcuts "append to today's daily note").
    /// When set to a workspace-relative path, the body is appended to
    /// that file with a leading newline. Path-traversal is rejected
    /// the same way the workspace_index resolver rejects it.
    pub(super) append_path: Option<String>,
}

pub(super) fn handle_capture(body: &[u8]) -> Result<String, CaptureError> {
    let parsed: CaptureBody = serde_json::from_slice(body)
        .map_err(|e| CaptureError::BadRequest(format!("parse body: {e}")))?;
    let content = parsed
        .content
        .as_deref()
        .ok_or_else(|| CaptureError::BadRequest("missing field: content".into()))?
        .to_string();

    let (workspace, inbox_folder) = {
        let s = STATE.lock().expect("capture state lock");
        (s.workspace.clone(), s.inbox_folder.clone())
    };
    let workspace = workspace.ok_or(CaptureError::NoWorkspace)?;

    // Append branch: bypass the create-note flow, just open-for-append.
    if let Some(rel) = parsed.append_path.as_deref() {
        let trimmed = rel.trim();
        if trimmed.is_empty() {
            return Err(CaptureError::BadRequest(
                "append_path is empty; pass a workspace-relative path or omit the field".into(),
            ));
        }
        return capture_append_inner(&workspace, trimmed, &content);
    }

    capture_write_inner(
        &workspace,
        &inbox_folder,
        parsed.title.as_deref(),
        &content,
        parsed.url.as_deref(),
        parsed.tags.as_deref(),
        parsed.inbox.unwrap_or(true),
        local_iso8601_now(),
    )
}

/// Pure append — open-or-create the workspace-relative file at `rel_path`,
/// then append the body with a single leading newline so successive appends
/// stack on separate lines. Same path-traversal protection as the create
/// branch: rejects absolute paths, `..` segments, drive-letter prefixes,
/// and anything that resolves outside the workspace canonical root.
pub fn capture_append_inner(
    workspace: &Path,
    rel_path: &str,
    content: &str,
) -> Result<String, CaptureError> {
    if !workspace.is_dir() {
        return Err(CaptureError::Io(format!(
            "workspace folder does not exist: {}",
            workspace.display()
        )));
    }

    let target = resolve_safe_workspace_path(workspace, rel_path)
        .map_err(CaptureError::BadRequest)?;

    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| CaptureError::Io(format!("mkdir {}: {e}", parent.display())))?;
    }

    use std::fs::OpenOptions;
    use std::io::Write;
    let mut f = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&target)
        .map_err(|e| CaptureError::Io(format!("open {}: {e}", target.display())))?;
    // A leading newline keeps successive appends on separate lines without
    // requiring the caller to know whether the file already ends in one.
    f.write_all(b"\n")
        .map_err(|e| CaptureError::Io(format!("write nl {}: {e}", target.display())))?;
    f.write_all(content.as_bytes())
        .map_err(|e| CaptureError::Io(format!("write body {}: {e}", target.display())))?;
    if !content.ends_with('\n') {
        f.write_all(b"\n")
            .map_err(|e| CaptureError::Io(format!("write trailing nl {}: {e}", target.display())))?;
    }

    Ok(target.to_string_lossy().to_string())
}

/// Resolve a workspace-relative `rel_path` to an absolute path, refusing
/// any input that would escape the workspace. Three layers of defense:
///
///   1. Reject `..` segments outright (no need to canonicalize first).
///   2. Reject absolute paths and Windows drive prefixes.
///   3. After joining + canonicalizing both the workspace and the target,
///      assert the target starts with the workspace canonical prefix.
///
/// Returns `Err(String)` with a 400-suitable message on any rejection.
pub(super) fn resolve_safe_workspace_path(workspace: &Path, rel_path: &str) -> Result<PathBuf, String> {
    if rel_path.is_empty() {
        return Err("append_path is empty".into());
    }
    // Layer 1: any `..` segment, anywhere, is rejected.
    for seg in rel_path.split(|c| c == '/' || c == '\\') {
        if seg == ".." {
            return Err("append_path contains a `..` segment (path-traversal denied)".into());
        }
    }
    // Layer 2: absolute / drive-prefix paths rejected.
    if rel_path.starts_with('/') || rel_path.starts_with('\\') {
        return Err("append_path must be workspace-relative, not absolute".into());
    }
    let bytes = rel_path.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic() {
        return Err("append_path must be workspace-relative, not a drive path".into());
    }

    let candidate = workspace.join(rel_path);
    // Layer 3: when the file already exists we can canonicalize it; when
    // it doesn't, canonicalize the parent and assert containment from
    // there. Symlinks pointing outside the workspace are rejected by the
    // canonical-prefix check.
    let workspace_canon = std::fs::canonicalize(workspace)
        .map_err(|e| format!("canonicalize workspace: {e}"))?;
    let resolved = if candidate.exists() {
        std::fs::canonicalize(&candidate)
            .map_err(|e| format!("canonicalize append_path: {e}"))?
    } else {
        let parent = candidate
            .parent()
            .ok_or_else(|| "append_path has no parent component".to_string())?;
        // Walk up to the deepest existing ancestor — canonicalize that —
        // then re-attach the remainder. Avoids "no such file" errors on
        // brand-new files in brand-new folders.
        let mut existing: PathBuf = parent.to_path_buf();
        let mut suffix: Vec<std::ffi::OsString> = Vec::new();
        loop {
            if existing.exists() {
                break;
            }
            let name_opt = existing.file_name().map(|s| s.to_os_string());
            let parent_opt = existing.parent().map(|p| p.to_path_buf());
            if let Some(name) = name_opt {
                suffix.push(name);
            }
            match parent_opt {
                Some(p) if p != existing => existing = p,
                _ => return Err("append_path resolves outside workspace".into()),
            }
        }
        let canon_existing = std::fs::canonicalize(&existing)
            .map_err(|e| format!("canonicalize parent: {e}"))?;
        let mut out = canon_existing;
        for seg in suffix.iter().rev() {
            out.push(seg);
        }
        if let Some(name) = candidate.file_name() {
            out.push(name);
        }
        out
    };

    if !resolved.starts_with(&workspace_canon) {
        return Err("append_path resolves outside workspace (denied)".into());
    }
    Ok(resolved)
}

/// Pure write — no global state touched. Public so the e2e test can drive
/// it without spinning up the HTTP server.
#[allow(clippy::too_many_arguments)]
pub fn capture_write_inner(
    workspace: &Path,
    inbox_folder: &str,
    title: Option<&str>,
    content: &str,
    url: Option<&str>,
    tags: Option<&[String]>,
    inbox: bool,
    captured_at: String,
) -> Result<String, CaptureError> {
    if !workspace.is_dir() {
        return Err(CaptureError::Io(format!(
            "workspace folder does not exist: {}",
            workspace.display()
        )));
    }

    // Resolve title: explicit → first H1 → "Untitled".
    let derived_title = title
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| extract_first_h1(content))
        .unwrap_or_else(|| "Untitled".to_string());

    // Build slug + filename.
    let slug = slugify(&derived_title);
    let prefix = filename_prefix();
    let filename = if slug.is_empty() {
        format!("{prefix}.md")
    } else {
        format!("{prefix}-{slug}.md")
    };

    let target_dir = workspace.join(inbox_folder);
    std::fs::create_dir_all(&target_dir)
        .map_err(|e| CaptureError::Io(format!("mkdir {}: {e}", target_dir.display())))?;

    // Avoid clobbering an existing file with the same minute-resolution name.
    let mut target = target_dir.join(&filename);
    let mut suffix = 2u32;
    while target.exists() {
        let alt = if slug.is_empty() {
            format!("{prefix}-{suffix}.md")
        } else {
            format!("{prefix}-{slug}-{suffix}.md")
        };
        target = target_dir.join(alt);
        suffix += 1;
    }

    let body = render_note(&derived_title, content, url, tags, inbox, &captured_at);
    std::fs::write(&target, body)
        .map_err(|e| CaptureError::Io(format!("write {}: {e}", target.display())))?;

    Ok(target.to_string_lossy().to_string())
}
