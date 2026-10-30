use super::*;

// ---------------------------------------------------------------------------
// Cache (JSON on disk per workspace)
// ---------------------------------------------------------------------------

pub(super) fn cache_path(app: &AppHandle, root: &Path) -> Option<PathBuf> {
    let app_data = super::super::portable::app_data_dir(app.path()).ok()?;
    let mut hasher = Sha256::new();
    hasher.update(root.to_string_lossy().as_bytes());
    let hash = format!("{:x}", hasher.finalize());
    let dir = app_data.join("index");
    let _ = fs::create_dir_all(&dir);
    Some(dir.join(format!("{}.json", &hash[..16])))
}

pub(super) fn save_cache(app: &AppHandle, root: &Path) -> Result<(), String> {
    let path = match cache_path(app, root) {
        Some(p) => p,
        None => return Ok(()),
    };
    let s = STATE.read().map_err(|e| e.to_string())?;
    let entries: Vec<&IndexEntry> = s.entries.values().collect();
    let json = serde_json::to_vec_pretty(&entries).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

pub(super) fn load_cache(app: &AppHandle, root: &Path) -> Option<Vec<IndexEntry>> {
    let path = cache_path(app, root)?;
    if !path.exists() {
        return None;
    }
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

// Helper for backlink context.
pub(super) fn read_context(path: &Path, line_no: u32) -> Vec<String> {
    let raw = match fs::read_to_string(path) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };
    let lines: Vec<&str> = raw.lines().collect();
    let i = (line_no as usize).saturating_sub(1);
    let prev = if i > 0 { lines.get(i - 1) } else { None };
    let cur = lines.get(i);
    let next = lines.get(i + 1);
    [prev, cur, next]
        .iter()
        .filter_map(|x| x.map(|s| s.to_string()))
        .collect()
}
