//! Global recursive search across a directory tree.
//!
//! Walks `root` (following the caller-controlled path) and returns every line
//! in every text-ish file that matches `query`, capped at `max_results`.
//! Matching is literal or regex (Rust `regex` syntax), case-insensitive unless
//! `case_sensitive` is set, and always line-by-line. Hidden directories and a
//! small deny-list of heavy build/VCS directories are skipped.
//!
//! Folder-wide replace lives in `replace.rs` and reuses `build_matcher` and
//! `text_files` from here so search and replace can never disagree.

use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use super::replace::{apply_to_line, Replacement};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SearchHit {
    pub file: String,
    pub line: usize,
    pub snippet: String,
    /// Match spans inside `snippet`, as UTF-16 `[start, end)` offsets so the
    /// webview can slice the string directly.
    #[serde(default)]
    pub ranges: Vec<[usize; 2]>,
    /// `snippet` with the replacement applied, when one was requested.
    #[serde(default)]
    pub preview: Option<String>,
}

#[derive(Deserialize, Debug, Clone, Copy, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    #[serde(default)]
    pub regex: bool,
    #[serde(default)]
    pub case_sensitive: bool,
}

/// File extensions we are willing to open and scan. Anything else is skipped
/// without even opening the file, so binary assets won't slow the walker.
const ALLOWED_EXT: &[&str] = &["md", "markdown", "mdown", "mkd", "txt"];

/// Directory names that should never be descended into. We match by name
/// (not full path), which is enough for the usual suspects.
const SKIP_DIRS: &[&str] = &["node_modules", "target", ".git", "dist"];

/// Caps a user pattern's compiled size so a pathological regex can't eat
/// memory. The `regex` crate is linear-time, so runtime is already bounded.
const REGEX_SIZE_LIMIT: usize = 1 << 20;

const SNIPPET_MAX_CHARS: usize = 200;

pub fn build_matcher(query: &str, opts: SearchOptions) -> Result<Regex, String> {
    let pattern = if opts.regex {
        query.to_string()
    } else {
        regex::escape(query)
    };
    RegexBuilder::new(&pattern)
        .case_insensitive(!opts.case_sensitive)
        .size_limit(REGEX_SIZE_LIMIT)
        .build()
        .map_err(|e| format!("invalid pattern: {e}"))
}

pub fn is_text_file(path: &Path) -> bool {
    path.extension()
        .and_then(|s| s.to_str())
        .map(|e| ALLOWED_EXT.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn is_skipped_name(name: &str) -> bool {
    name.starts_with('.') || SKIP_DIRS.contains(&name)
}

/// Every searchable file under `root`, skipping dot-dirs and `SKIP_DIRS`.
pub fn text_files(root: &str) -> impl Iterator<Item = PathBuf> {
    WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| e.depth() == 0 || !is_skipped_name(&e.file_name().to_string_lossy()))
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file() && is_text_file(e.path()))
        .map(|e| e.into_path())
}

#[tauri::command]
pub async fn search_in_dir(
    root: String,
    query: String,
    max_results: usize,
    options: Option<SearchOptions>,
    replacement: Option<String>,
) -> Result<Vec<SearchHit>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        search_in_dir_with(
            &root,
            &query,
            max_results,
            options.unwrap_or_default(),
            replacement.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

/// Literal, case-insensitive search — the original behaviour, kept for the
/// agent tools that call it directly.
pub fn search_in_dir_inner(
    root: String,
    query: String,
    max_results: usize,
) -> Result<Vec<SearchHit>, String> {
    search_in_dir_with(&root, &query, max_results, SearchOptions::default(), None)
}

pub fn search_in_dir_with(
    root: &str,
    query: &str,
    max_results: usize,
    opts: SearchOptions,
    replacement: Option<&str>,
) -> Result<Vec<SearchHit>, String> {
    if query.is_empty() {
        return Ok(vec![]);
    }
    let re = build_matcher(query, opts)?;
    let rep = replacement.map(|r| Replacement::new(r, opts.regex));
    let mut hits: Vec<SearchHit> = Vec::new();

    for path in text_files(root) {
        if hits.len() >= max_results {
            break;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let file = path.to_string_lossy().to_string();
        for (i, line) in content.lines().enumerate() {
            if hits.len() >= max_results {
                break;
            }
            if let Some(hit) = line_hit(&re, rep.as_ref(), &file, i + 1, line) {
                hits.push(hit);
            }
        }
    }

    Ok(hits)
}

fn line_hit(
    re: &Regex,
    rep: Option<&Replacement>,
    file: &str,
    line_no: usize,
    line: &str,
) -> Option<SearchHit> {
    if !re.is_match(line) {
        return None;
    }
    // Cap snippet length so a single giant line can't blow up the IPC payload.
    let snippet: String = line.chars().take(SNIPPET_MAX_CHARS).collect();
    let ranges = utf16_ranges(re, line, snippet.len());
    let preview = rep.map(|r| {
        let (replaced, _) = apply_to_line(re, line, r);
        replaced.chars().take(SNIPPET_MAX_CHARS).collect()
    });
    Some(SearchHit {
        file: file.to_string(),
        line: line_no,
        snippet,
        ranges,
        preview,
    })
}

/// Non-empty match spans that start inside the first `limit` bytes, converted
/// to UTF-16 offsets and clipped to that limit.
fn utf16_ranges(re: &Regex, line: &str, limit: usize) -> Vec<[usize; 2]> {
    let to_u16 = |byte: usize| line[..byte].encode_utf16().count();
    re.find_iter(line)
        .filter(|m| m.start() < limit && m.end() > m.start())
        .map(|m| [to_u16(m.start()), to_u16(m.end().min(limit))])
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opts(regex: bool, case_sensitive: bool) -> SearchOptions {
        SearchOptions { regex, case_sensitive }
    }

    fn vault(files: &[(&str, &str)]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for (name, body) in files {
            fs::write(dir.path().join(name), body).unwrap();
        }
        dir
    }

    fn root(dir: &tempfile::TempDir) -> String {
        dir.path().to_string_lossy().to_string()
    }

    #[test]
    fn literal_search_escapes_regex_metacharacters() {
        let dir = vault(&[("a.md", "cost is $5 (net)\nplain\n")]);
        let hits = search_in_dir_with(&root(&dir), "$5 (net)", 10, opts(false, false), None).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].line, 1);
    }

    #[test]
    fn regex_search_matches_unicode_word_chars() {
        let dir = vault(&[("a.md", "שלום עולם\nhello\n")]);
        let hits = search_in_dir_with(&root(&dir), r"^\w+ \w+$", 10, opts(true, false), None).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].line, 1);
    }

    #[test]
    fn case_sensitive_flag_is_respected() {
        let dir = vault(&[("a.md", "Foo\nfoo\n")]);
        let insensitive = search_in_dir_with(&root(&dir), "foo", 10, opts(false, false), None).unwrap();
        let sensitive = search_in_dir_with(&root(&dir), "foo", 10, opts(false, true), None).unwrap();
        assert_eq!(insensitive.len(), 2);
        assert_eq!(sensitive.len(), 1);
    }

    #[test]
    fn invalid_regex_is_an_error() {
        let dir = vault(&[("a.md", "x\n")]);
        let err = search_in_dir_with(&root(&dir), "(unclosed", 10, opts(true, false), None);
        assert!(err.unwrap_err().starts_with("invalid pattern"));
    }

    #[test]
    fn ranges_are_utf16_offsets() {
        let dir = vault(&[("a.md", "😀 ab ab\n")]);
        let hits = search_in_dir_with(&root(&dir), "ab", 10, opts(false, false), None).unwrap();
        assert_eq!(hits[0].ranges, vec![[3, 5], [6, 8]]);
    }

    #[test]
    fn preview_applies_capture_groups() {
        let dir = vault(&[("a.md", "date 2026-10-16\n")]);
        let hits = search_in_dir_with(
            &root(&dir),
            r"(\d{4})-(\d\d)-(\d\d)",
            10,
            opts(true, false),
            Some("$3/$2/$1"),
        )
        .unwrap();
        assert_eq!(hits[0].preview.as_deref(), Some("date 16/10/2026"));
    }

    #[test]
    fn dot_dirs_below_root_are_skipped_but_root_is_not() {
        let dir = vault(&[("a.md", "needle\n")]);
        fs::create_dir(dir.path().join(".hidden")).unwrap();
        fs::write(dir.path().join(".hidden/b.md"), "needle\n").unwrap();
        let hits = search_in_dir_with(&root(&dir), "needle", 10, opts(false, false), None).unwrap();
        assert_eq!(hits.len(), 1);
    }

    #[test]
    fn non_text_files_are_skipped() {
        let dir = vault(&[("a.md", "needle\n"), ("b.json", "needle\n")]);
        let hits = search_in_dir_with(&root(&dir), "needle", 10, opts(false, false), None).unwrap();
        assert_eq!(hits.len(), 1);
    }
}
