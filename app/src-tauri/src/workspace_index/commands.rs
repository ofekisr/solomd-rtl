use super::*;

// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn workspace_index_init(app: AppHandle, folder: String) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || workspace_index_init_inner(app, folder))
        .await
        .map_err(|e| format!("join: {e}"))?
}

pub(super) fn workspace_index_init_inner(app: AppHandle, folder: String) -> Result<usize, String> {
    let root = PathBuf::from(&folder);
    if !root.is_dir() {
        return Err(format!("not a directory: {folder}"));
    }

    // Reset state.
    {
        let mut s = STATE.write().map_err(|e| e.to_string())?;
        s.entries.clear();
        s.root = Some(root.clone());
        s._watcher = None;
    }

    // Try cache first (fast warm start). If cache is missing or stale per-file
    // mtimes are checked anyway during the rescan loop below, so no separate
    // freshness logic needed here.
    if let Some(cached) = load_cache(&app, &root) {
        let mut s = STATE.write().map_err(|e| e.to_string())?;
        for entry in cached {
            s.entries.insert(PathBuf::from(&entry.path), entry);
        }
    }

    // Full scan (this also corrects any drift from cache).
    scan_into(&root)?;

    // Set up watcher.
    let app_for_watch = app.clone();
    let watcher = make_watcher(app_for_watch, root.clone())?;
    {
        let mut s = STATE.write().map_err(|e| e.to_string())?;
        s._watcher = Some(watcher);
    }

    let count = STATE.read().map_err(|e| e.to_string())?.entries.len();
    save_cache(&app, &root)?;
    let _ = app.emit("solomd://index-updated", &"init");
    Ok(count)
}

#[tauri::command]
pub fn workspace_index_files() -> Result<Vec<IndexEntry>, String> {
    let s = STATE.read().map_err(|e| e.to_string())?;
    let mut v: Vec<IndexEntry> = s.entries.values().cloned().collect();
    v.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(v)
}

#[tauri::command]
pub fn workspace_index_backlinks(target: String) -> Result<Vec<BacklinkRef>, String> {
    let s = STATE.read().map_err(|e| e.to_string())?;
    let target_lc = target.to_lowercase();
    let mut out: Vec<BacklinkRef> = Vec::new();
    for entry in s.entries.values() {
        for link in &entry.wikilinks {
            if link.target.to_lowercase() == target_lc {
                let context = read_context(&PathBuf::from(&entry.path), link.line);
                out.push(BacklinkRef {
                    from_path: entry.path.clone(),
                    from_name: entry.name.clone(),
                    line: link.line,
                    context,
                });
            }
        }
    }
    out.sort_by(|a, b| a.from_name.cmp(&b.from_name));
    Ok(out)
}

/// F3 — inverse relationships: notes whose front matter has a typed
/// relationship key pointing at `target`. Resolution mirrors
/// `workspace_index_resolve`'s precedence (stem → title → alias →
/// path-suffix), case-insensitive; the source note is self-excluded.
#[tauri::command]
pub fn workspace_index_referenced_by(target: String) -> Result<Vec<ReferencedByRef>, String> {
    let s = STATE.read().map_err(|e| e.to_string())?;
    let needle = target.trim().to_lowercase();
    if needle.is_empty() {
        return Ok(Vec::new());
    }

    // Resolve which entry `target` names (so refs by title/alias/stem all
    // collapse to one path). First-match wins, mirroring resolve precedence.
    let resolved_path: Option<String> = {
        let by_stem = s
            .entries
            .values()
            .find(|e| e.stem.to_lowercase() == needle);
        let by_title = || {
            s.entries.values().find(|e| {
                e.title
                    .as_ref()
                    .map(|t| t.to_lowercase() == needle)
                    .unwrap_or(false)
            })
        };
        let by_alias = || {
            s.entries.values().find(|e| {
                if let serde_json::Value::Object(map) = &e.frontmatter {
                    if let Some(a) = map.get("aliases").or_else(|| map.get("alias")) {
                        let mut names = Vec::new();
                        collect_alias_names(a, &mut names);
                        return names.iter().any(|n| n.to_lowercase() == needle);
                    }
                }
                false
            })
        };
        by_stem
            .or_else(by_title)
            .or_else(by_alias)
            .map(|e| e.path.clone())
    };

    let mut out: Vec<ReferencedByRef> = Vec::new();
    for entry in s.entries.values() {
        for (via_key, refs) in &entry.relationships {
            for reference in refs {
                let ref_target = parse_ref_target(reference).to_lowercase();
                // A ref matches if it names this target directly (stem/title/
                // alias) — compare to both the literal needle AND the resolved
                // entry's stem so e.g. `[[The Title]]` resolves to the file.
                let matches_needle = ref_target == needle;
                let matches_resolved = match &resolved_path {
                    Some(p) => s
                        .entries
                        .get(&PathBuf::from(p))
                        .map(|te| te.stem.to_lowercase() == ref_target)
                        .unwrap_or(false),
                    None => false,
                };
                if !(matches_needle || matches_resolved) {
                    continue;
                }
                // Self-exclusion: a note referencing itself isn't an inverse.
                if let Some(p) = &resolved_path {
                    if &entry.path == p {
                        continue;
                    }
                }
                out.push(ReferencedByRef {
                    from_path: entry.path.clone(),
                    from_name: entry.name.clone(),
                    via_key: via_key.clone(),
                });
            }
        }
    }
    out.sort_by(|a, b| {
        a.via_key
            .cmp(&b.via_key)
            .then_with(|| a.from_name.cmp(&b.from_name))
    });
    out.dedup_by(|a, b| a.from_path == b.from_path && a.via_key == b.via_key);
    Ok(out)
}

/// Collect alias names from a front-matter `aliases` value (string or array).
pub(super) fn collect_alias_names(value: &serde_json::Value, out: &mut Vec<String>) {
    match value {
        serde_json::Value::String(s) => out.push(s.trim().to_string()),
        serde_json::Value::Array(arr) => {
            for v in arr {
                collect_alias_names(v, out);
            }
        }
        _ => {}
    }
}

#[tauri::command]
pub fn workspace_index_tags() -> Result<Vec<TagCount>, String> {
    let s = STATE.read().map_err(|e| e.to_string())?;
    let mut by_tag: HashMap<String, (u32, Vec<String>)> = HashMap::new();
    for entry in s.entries.values() {
        let mut seen_in_file: std::collections::HashSet<&str> = std::collections::HashSet::new();
        for tag in &entry.tags {
            if seen_in_file.insert(tag) {
                let e = by_tag.entry(tag.clone()).or_insert_with(|| (0, vec![]));
                e.0 += 1;
                e.1.push(entry.path.clone());
            }
        }
    }
    let mut out: Vec<TagCount> = by_tag
        .into_iter()
        .map(|(tag, (count, files))| TagCount { tag, count, files })
        .collect();
    out.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.tag.cmp(&b.tag)));
    Ok(out)
}

#[tauri::command]
pub fn workspace_index_resolve(name: String) -> Result<Option<String>, String> {
    let s = STATE.read().map_err(|e| e.to_string())?;
    let needle = name.trim();
    if needle.is_empty() {
        return Ok(None);
    }
    let needle_lc = needle.to_lowercase();
    // 1. Exact stem match (case-insensitive)
    for entry in s.entries.values() {
        if entry.stem.to_lowercase() == needle_lc {
            return Ok(Some(entry.path.clone()));
        }
    }
    // 2. Title (H1) match
    for entry in s.entries.values() {
        if entry
            .title
            .as_ref()
            .map(|t| t.to_lowercase() == needle_lc)
            .unwrap_or(false)
        {
            return Ok(Some(entry.path.clone()));
        }
    }
    // 3. Alias match (frontmatter aliases / alias)
    for entry in s.entries.values() {
        if let serde_json::Value::Object(map) = &entry.frontmatter {
            if let Some(a) = map.get("aliases").or_else(|| map.get("alias")) {
                let mut names = Vec::new();
                collect_alias_names(a, &mut names);
                if names.iter().any(|n| n.to_lowercase() == needle_lc) {
                    return Ok(Some(entry.path.clone()));
                }
            }
        }
    }
    // 4. Path-suffix match — handles Obsidian-style [[folder/note]] where
    //    the target includes a folder component. Check if the absolute path
    //    ends with "/needle" or "/needle.md" (case-insensitive, normalized
    //    to forward slashes). This is the fix for wikilinks that previously
    //    fell through and created a new file instead of opening.
    {
        let needle_norm = needle_lc.replace('\\', "/");
        // strip optional .md suffix for suffix check
        let needle_no_ext = needle_norm
            .strip_suffix(".md")
            .unwrap_or(&needle_norm)
            .to_string();
        for entry in s.entries.values() {
            let path_norm = entry.path.replace('\\', "/").to_lowercase();
            // try with and without extension
            if path_norm.ends_with(&format!("/{}", needle_norm))
                || path_norm.ends_with(&format!("/{}", needle_no_ext))
                || path_norm.ends_with(&format!("/{}", format!("{}.md", needle_no_ext)))
            {
                return Ok(Some(entry.path.clone()));
            }
            // also handle needle already containing sub-path without leading slash
            // e.g. entry.path = ".../a/b/c.md", needle = "b/c" → already covered
        }
    }
    // 5. Substring match in stem (legacy fallback)
    for entry in s.entries.values() {
        if entry.stem.to_lowercase().contains(&needle_lc) {
            return Ok(Some(entry.path.clone()));
        }
    }
    Ok(None)
}

#[tauri::command]
pub async fn workspace_index_rescan(app: AppHandle) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || workspace_index_rescan_inner(app))
        .await
        .map_err(|e| format!("join: {e}"))?
}

pub(super) fn workspace_index_rescan_inner(app: AppHandle) -> Result<usize, String> {
    let root = {
        let s = STATE.read().map_err(|e| e.to_string())?;
        match &s.root {
            Some(r) => r.clone(),
            None => return Err("workspace not initialized".into()),
        }
    };
    {
        let mut s = STATE.write().map_err(|e| e.to_string())?;
        s.entries.clear();
    }
    scan_into(&root)?;
    save_cache(&app, &root)?;
    let _ = app.emit("solomd://index-updated", &"rescan");
    let count = STATE.read().map_err(|e| e.to_string())?.entries.len();
    Ok(count)
}
