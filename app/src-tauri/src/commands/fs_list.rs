use serde::{Deserialize, Serialize};
use std::path::Path;

/// Every folder under `root`, as vault-relative slash-separated paths, for the
/// "Move to…" picker.
///
/// The tree itself only knows about folders the user has expanded, and a
/// picker limited to those is useless for the case it exists to serve: filing
/// a note into a folder you haven't visited today. Build junk and attachment
/// folders are pruned along with their subtrees — nobody files a note into
/// `_assets`. Hidden folders follow the Explorer's own "show hidden files"
/// setting, except `.git`, which is always pruned: walking an entire object
/// store to fill a picker is pure cost, and a note filed in there would be
/// invisible to the app anyway.
#[tauri::command]
pub async fn fs_list_dirs(root: String, show_hidden: Option<bool>) -> Result<Vec<String>, String> {
    let show_hidden = show_hidden.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || fs_list_dirs_inner(root, show_hidden))
        .await
        .map_err(|e| format!("join: {e}"))?
}

pub fn fs_list_dirs_inner(root: String, show_hidden: bool) -> Result<Vec<String>, String> {
    const CAP: usize = 20_000;
    const SKIP: &[&str] = &["node_modules", "target", "dist", "_assets", ".git"];
    let root_p = Path::new(&root);
    if !root_p.is_dir() {
        return Err(format!("not a folder: {root}"));
    }
    let mut out: Vec<String> = Vec::new();
    for entry in walkdir::WalkDir::new(root_p)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let name = e.file_name().to_string_lossy().to_string();
            (show_hidden || !name.starts_with('.'))
                && !SKIP.contains(&name.as_str())
                && !name.ends_with(".assets")
        })
        .filter_map(|e| e.ok())
    {
        if entry.depth() == 0 || !entry.file_type().is_dir() {
            continue;
        }
        if let Ok(rel) = entry.path().strip_prefix(root_p) {
            out.push(rel.to_string_lossy().replace('\\', "/"));
        }
        if out.len() >= CAP {
            break;
        }
    }
    out.sort();
    Ok(out)
}

/// One extension present in the vault, with how many files carry it.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ExtensionCount {
    /// Lower-cased, no leading dot. Empty string = files with no extension.
    pub ext: String,
    pub count: usize,
}

/// Every file extension in the vault, most common first (#282 — "I only want to show
/// the txt or md documents under this folder").
///
/// The picker offers what the vault actually contains rather than a canned
/// list: a vault of `.md` + `.canvas` and one of `.txt` + `.org` should not
/// both be shown the same twenty checkboxes.
#[tauri::command]
pub async fn fs_list_extensions(
    root: String,
    show_hidden: Option<bool>,
) -> Result<Vec<ExtensionCount>, String> {
    let show_hidden = show_hidden.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || fs_list_extensions_inner(root, show_hidden))
        .await
        .map_err(|e| format!("join: {e}"))?
}

pub fn fs_list_extensions_inner(
    root: String,
    show_hidden: bool,
) -> Result<Vec<ExtensionCount>, String> {
    let root_p = Path::new(&root);
    if !root_p.is_dir() {
        return Err(format!("not a folder: {root}"));
    }
    let mut counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for entry in filtered_walk(root_p, show_hidden) {
        if !entry.file_type().is_file() {
            continue;
        }
        *counts.entry(entry_extension(entry.path())).or_insert(0) += 1;
    }
    let mut out: Vec<ExtensionCount> = counts
        .into_iter()
        .map(|(ext, count)| ExtensionCount { ext, count })
        .collect();
    // Most common first, alphabetical within a tie — a stable order matters
    // more than the exact one, because the list is a checkbox column.
    out.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.ext.cmp(&b.ext)));
    Ok(out)
}

/// Vault-relative paths of every directory whose SUBTREE holds at least one
/// file with one of `exts`.
///
/// This exists because the tree is lazy: a folder the user hasn't expanded has
/// no loaded children, so the frontend cannot tell whether hiding it would
/// hide a match. Filtering to `.txt` and still being shown every folder until
/// you open it is the difference between a filter and a suggestion. One walk
/// per filter change answers it for the whole vault.
#[tauri::command]
pub async fn fs_dirs_with_extensions(
    root: String,
    exts: Vec<String>,
    show_hidden: Option<bool>,
) -> Result<Vec<String>, String> {
    let show_hidden = show_hidden.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || {
        fs_dirs_with_extensions_inner(root, exts, show_hidden)
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

pub fn fs_dirs_with_extensions_inner(
    root: String,
    exts: Vec<String>,
    show_hidden: bool,
) -> Result<Vec<String>, String> {
    let root_p = Path::new(&root);
    if !root_p.is_dir() {
        return Err(format!("not a folder: {root}"));
    }
    let wanted: std::collections::HashSet<String> =
        exts.into_iter().map(|e| e.trim_start_matches('.').to_ascii_lowercase()).collect();
    let mut hits: std::collections::HashSet<String> = std::collections::HashSet::new();
    for entry in filtered_walk(root_p, show_hidden) {
        if !entry.file_type().is_file() || !wanted.contains(&entry_extension(entry.path())) {
            continue;
        }
        // Every ancestor up to (but not including) the root now has a match.
        let mut dir = entry.path().parent();
        while let Some(d) = dir {
            if d == root_p {
                break;
            }
            match d.strip_prefix(root_p) {
                Ok(rel) => {
                    let key = rel.to_string_lossy().replace('\\', "/");
                    // Already recorded: so are all of its ancestors.
                    if !hits.insert(key) {
                        break;
                    }
                }
                Err(_) => break,
            }
            dir = d.parent();
        }
    }
    let mut out: Vec<String> = hits.into_iter().collect();
    out.sort();
    Ok(out)
}

/// Shared walk for the two commands above: skips build junk, attachment
/// folders and `.git`, and honours the Explorer's hidden-files setting.
fn filtered_walk(root: &Path, show_hidden: bool) -> impl Iterator<Item = walkdir::DirEntry> {
    const SKIP: &[&str] = &["node_modules", "target", "dist", ".git"];
    walkdir::WalkDir::new(root)
        .into_iter()
        .filter_entry(move |e| {
            if e.depth() == 0 {
                return true;
            }
            let name = e.file_name().to_string_lossy().to_string();
            (show_hidden || !name.starts_with('.')) && !SKIP.contains(&name.as_str())
        })
        .filter_map(|e| e.ok())
        .take(200_000)
}

/// A path's extension, lower-cased and without the dot. Files with no
/// extension collapse to the empty string, which the picker shows as its own
/// bucket — `Makefile` and `LICENSE` are real vault contents.
fn entry_extension(p: &Path) -> String {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default()
}
