use super::*;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

pub(super) fn scan_into(root: &Path) -> Result<(), String> {
    let mut new_entries: HashMap<PathBuf, IndexEntry> = HashMap::new();
    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let lower = path
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();
        if lower != "md" && lower != "markdown" && lower != "mdown" {
            continue;
        }
        if let Ok(idx) = scan_file(path) {
            new_entries.insert(path.to_path_buf(), idx);
        }
    }
    let mut s = STATE.write().map_err(|e| e.to_string())?;
    s.entries = new_entries;
    Ok(())
}

pub(super) fn scan_file(path: &Path) -> Result<IndexEntry, String> {
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();

    let (frontmatter, body) = split_front_matter(&raw);
    let frontmatter_json: serde_json::Value = match frontmatter {
        Some(fm) => serde_yaml::from_str::<serde_json::Value>(&fm).unwrap_or(serde_json::Value::Null),
        None => serde_json::Value::Null,
    };

    let wikilinks = extract_wikilinks(body);
    let mut tags = extract_body_tags(body);
    if let serde_json::Value::Object(map) = &frontmatter_json {
        if let Some(t) = map.get("tags") {
            collect_yaml_tags(t, &mut tags);
        }
    }
    tags.sort();
    tags.dedup();

    let headings = extract_headings(body);
    // Over `raw`, not `body`: task line numbers have to match the file.
    let tasks = extract_tasks(&raw);
    let title = extract_title(&frontmatter_json, &headings);
    let summary = extract_summary(body);
    let relationships = extract_relationships(&frontmatter_json);

    Ok(IndexEntry {
        path: path.to_string_lossy().to_string(),
        name,
        stem,
        mtime,
        size: meta.len(),
        frontmatter: frontmatter_json,
        wikilinks,
        tags,
        headings,
        tasks,
        summary,
        title,
        relationships,
    })
}
