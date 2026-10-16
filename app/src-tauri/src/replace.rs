//! Folder-wide find & replace, the write half of `search.rs`.
//!
//! Matching reuses `search::build_matcher`, line by line, so every line the
//! search pane lists is exactly a line this module rewrites. In regex mode the
//! replacement takes JavaScript / VS Code syntax (`$1`, `$<name>`, `$&`, `$$`,
//! `\n`, `\t`), translated here into the `regex` crate's `${…}` form; in literal
//! mode it is inserted verbatim.
//!
//! Files open in an editor tab are passed in `exclude`: the webview rewrites
//! those buffers itself through `replace_in_text`, so unsaved edits are never
//! clobbered by a disk write underneath them.

use regex::{NoExpand, Regex};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use super::md_code_spans::{code_ranges_by_line, overlaps, ByteRange};
use super::mmap_text::{is_mmap, replace_fields};
use super::search::{build_matcher, is_text_file, text_files, SearchOptions};

const UTF8_LABEL: &str = "UTF-8";

pub struct Replacement {
    text: String,
    expand: bool,
}

impl Replacement {
    pub fn new(raw: &str, regex_mode: bool) -> Self {
        if regex_mode {
            Self { text: translate_js_replacement(raw), expand: true }
        } else {
            Self { text: raw.to_string(), expand: false }
        }
    }
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceRequest {
    pub root: String,
    pub query: String,
    pub replacement: String,
    #[serde(default)]
    pub options: SearchOptions,
    /// Restrict the run to these files (per-file replace). `None` = whole tree.
    #[serde(default)]
    pub only: Option<Vec<String>>,
    #[serde(default)]
    pub exclude: Vec<String>,
    /// Count what would change without writing anything.
    #[serde(default)]
    pub dry_run: bool,
}

#[derive(Serialize, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceSummary {
    pub files_changed: usize,
    pub replacements: usize,
    pub errors: Vec<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct TextReplaceResult {
    pub text: String,
    pub count: usize,
}

#[tauri::command]
pub async fn replace_in_dir(request: ReplaceRequest) -> Result<ReplaceSummary, String> {
    tauri::async_runtime::spawn_blocking(move || replace_in_dir_inner(&request))
        .await
        .map_err(|e| format!("join: {e}"))?
}

/// `file_path` only picks the format: `.mmap` buffers get node-text
/// replacement, everything else plain line-by-line.
#[tauri::command]
pub fn replace_in_text(
    text: String,
    query: String,
    replacement: String,
    options: Option<SearchOptions>,
    file_path: Option<String>,
) -> Result<TextReplaceResult, String> {
    let opts = options.unwrap_or_default();
    let re = build_matcher(&query, opts)?;
    let rep = Replacement::new(&replacement, opts.regex);
    let is_map = file_path.as_deref().map(Path::new).is_some_and(is_mmap);
    let (text, count) = apply_to_file_text(is_map, &re, &text, &rep, opts.skip_code);
    Ok(TextReplaceResult { text, count })
}

fn apply_to_file_text(is_map: bool, re: &Regex, text: &str, rep: &Replacement, skip_code: bool) -> (String, usize) {
    if is_map {
        apply_to_mmap(re, text, rep)
    } else if skip_code {
        apply_to_text_skipping_code(re, text, rep)
    } else {
        apply_to_text(re, text, rep)
    }
}

/// Replace inside node `topic` / `note` values only.
pub fn apply_to_mmap(re: &Regex, json: &str, rep: &Replacement) -> (String, usize) {
    let mut total = 0;
    let updated = replace_fields(json, |field| {
        let (value, count) = apply_to_text(re, &field.value, rep);
        total += count;
        (count > 0).then_some(value)
    });
    (updated.unwrap_or_else(|| json.to_string()), total)
}

pub fn replace_in_dir_inner(req: &ReplaceRequest) -> Result<ReplaceSummary, String> {
    if req.query.is_empty() {
        return Err("empty query".into());
    }
    let re = build_matcher(&req.query, req.options)?;
    let rep = Replacement::new(&req.replacement, req.options.regex);
    let root = fs::canonicalize(&req.root).map_err(|e| format!("bad root: {e}"))?;
    let exclude: HashSet<PathBuf> = req.exclude.iter().map(|p| canonical(Path::new(p))).collect();
    let mut summary = ReplaceSummary::default();

    for path in targets(req, &root) {
        if exclude.contains(&canonical(&path)) {
            continue;
        }
        replace_file(&path, &re, &rep, req.dry_run, req.options.skip_code, &mut summary);
    }
    Ok(summary)
}

fn targets(req: &ReplaceRequest, root: &Path) -> Vec<PathBuf> {
    match &req.only {
        None => text_files(&req.root).collect(),
        Some(list) => list
            .iter()
            .map(PathBuf::from)
            .filter(|p| is_text_file(p) && canonical(p).starts_with(root))
            .collect(),
    }
}

fn replace_file(path: &Path, re: &Regex, rep: &Replacement, dry_run: bool, skip_code: bool, summary: &mut ReplaceSummary) {
    let Ok(content) = fs::read_to_string(path) else {
        return;
    };
    let (updated, count) = apply_to_file_text(is_mmap(path), re, &content, rep, skip_code);
    if count == 0 || updated == content {
        return;
    }
    if !dry_run {
        let target = path.to_string_lossy().to_string();
        if let Err(e) = super::commands::write_file_inner(target.clone(), updated, UTF8_LABEL.into()) {
            summary.errors.push(format!("{target}: {e}"));
            return;
        }
    }
    summary.files_changed += 1;
    summary.replacements += count;
}

fn canonical(p: &Path) -> PathBuf {
    fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf())
}

/// Replace every match in `text`, one line at a time, keeping each line's
/// original terminator (`\n` or `\r\n`).
pub fn apply_to_text(re: &Regex, text: &str, rep: &Replacement) -> (String, usize) {
    let mut out = String::with_capacity(text.len());
    let mut total = 0;
    for segment in text.split_inclusive('\n') {
        let (body, eol) = split_eol(segment);
        let (replaced, count) = apply_to_line(re, body, rep);
        out.push_str(&replaced);
        out.push_str(eol);
        total += count;
    }
    (out, total)
}

/// `apply_to_text`, leaving matches that touch Markdown code unchanged.
pub fn apply_to_text_skipping_code(re: &Regex, text: &str, rep: &Replacement) -> (String, usize) {
    let code = code_ranges_by_line(text);
    let mut out = String::with_capacity(text.len());
    let mut total = 0;
    for (i, segment) in text.split_inclusive('\n').enumerate() {
        let (body, eol) = split_eol(segment);
        let mask = code.get(i).map(Vec::as_slice).unwrap_or(&[]);
        let (replaced, count) = apply_to_line_masked(re, body, rep, mask);
        out.push_str(&replaced);
        out.push_str(eol);
        total += count;
    }
    (out, total)
}

/// Replace matches outside `code`; matches overlapping it stay as they are.
pub fn apply_to_line_masked(re: &Regex, line: &str, rep: &Replacement, code: &[ByteRange]) -> (String, usize) {
    if code.is_empty() {
        return apply_to_line(re, line, rep);
    }
    let mut out = String::with_capacity(line.len());
    let mut last = 0;
    let mut count = 0;
    for caps in re.captures_iter(line) {
        let m = caps.get(0).expect("group 0 always matches");
        if overlaps(code, m.start(), m.end()) {
            continue;
        }
        out.push_str(&line[last..m.start()]);
        if rep.expand {
            caps.expand(&rep.text, &mut out);
        } else {
            out.push_str(&rep.text);
        }
        last = m.end();
        count += 1;
    }
    out.push_str(&line[last..]);
    (out, count)
}

pub fn apply_to_line(re: &Regex, line: &str, rep: &Replacement) -> (String, usize) {
    let count = re.find_iter(line).count();
    if count == 0 {
        return (line.to_string(), 0);
    }
    let replaced = if rep.expand {
        re.replace_all(line, rep.text.as_str())
    } else {
        re.replace_all(line, NoExpand(&rep.text))
    };
    (replaced.into_owned(), count)
}

fn split_eol(segment: &str) -> (&str, &str) {
    for eol in ["\r\n", "\n"] {
        if let Some(body) = segment.strip_suffix(eol) {
            return (body, eol);
        }
    }
    (segment, "")
}

/// JS / VS Code replacement syntax → `regex` crate syntax. Unknown `$x`
/// sequences stay literal, as they do in JavaScript.
pub fn translate_js_replacement(raw: &str) -> String {
    let chars: Vec<char> = raw.chars().collect();
    let mut out = String::with_capacity(raw.len());
    let mut i = 0;
    while i < chars.len() {
        i += match chars[i] {
            '\\' => translate_escape(&chars[i..], &mut out),
            '$' => translate_dollar(&chars[i..], &mut out),
            c => {
                out.push(c);
                1
            }
        };
    }
    out
}

fn translate_escape(rest: &[char], out: &mut String) -> usize {
    match rest.get(1) {
        Some('n') => out.push('\n'),
        Some('t') => out.push('\t'),
        Some('\\') => out.push('\\'),
        _ => {
            out.push('\\');
            return 1;
        }
    }
    2
}

const MAX_GROUP_DIGITS: usize = 2;

fn translate_dollar(rest: &[char], out: &mut String) -> usize {
    match rest.get(1) {
        Some('$') => {
            out.push_str("$$");
            2
        }
        Some('&') => {
            out.push_str("${0}");
            2
        }
        Some(c) if c.is_ascii_digit() => {
            let digits: String = rest[1..]
                .iter()
                .take(MAX_GROUP_DIGITS)
                .take_while(|c| c.is_ascii_digit())
                .collect();
            out.push_str(&format!("${{{digits}}}"));
            1 + digits.len()
        }
        Some('<') => translate_named_group(rest, out),
        _ => {
            out.push_str("$$");
            1
        }
    }
}

fn translate_named_group(rest: &[char], out: &mut String) -> usize {
    let Some(close) = rest.iter().position(|c| *c == '>') else {
        out.push_str("$$");
        return 1;
    };
    let name: String = rest[2..close].iter().collect();
    out.push_str(&format!("${{{name}}}"));
    close + 1
}

#[cfg(test)]
mod tests {
    use super::*;

    fn regex_opts() -> SearchOptions {
        SearchOptions { regex: true, case_sensitive: true, skip_code: false }
    }

    fn run(text: &str, query: &str, replacement: &str, opts: SearchOptions) -> (String, usize) {
        let re = build_matcher(query, opts).unwrap();
        apply_to_text(&re, text, &Replacement::new(replacement, opts.regex))
    }

    #[test]
    fn translates_js_replacement_tokens() {
        assert_eq!(translate_js_replacement("$1-$2"), "${1}-${2}");
        assert_eq!(translate_js_replacement("$1a"), "${1}a");
        assert_eq!(translate_js_replacement("$<year>"), "${year}");
        assert_eq!(translate_js_replacement("[$&]"), "[${0}]");
        assert_eq!(translate_js_replacement("$$5"), "$$5");
        assert_eq!(translate_js_replacement("cost $x"), "cost $$x");
        assert_eq!(translate_js_replacement(r"a\nb\tc\\d"), "a\nb\tc\\d");
    }

    #[test]
    fn regex_groups_reorder_text() {
        let (out, n) = run("2026-10-16\nno date\n", r"(\d{4})-(\d\d)-(\d\d)", "$3/$2/$1", regex_opts());
        assert_eq!(out, "16/10/2026\nno date\n");
        assert_eq!(n, 1);
    }

    #[test]
    fn named_groups_work() {
        let (out, _) = run("foo=bar", r"(?<k>\w+)=(?<v>\w+)", "$<v>=$<k>", regex_opts());
        assert_eq!(out, "bar=foo");
    }

    #[test]
    fn literal_mode_inserts_dollar_signs_verbatim() {
        let opts = SearchOptions { regex: false, case_sensitive: false, skip_code: false };
        let (out, n) = run("price: X, x", "x", "$1", opts);
        assert_eq!(out, "price: $1, $1");
        assert_eq!(n, 2);
    }

    #[test]
    fn crlf_line_endings_are_preserved() {
        let (out, n) = run("a1\r\nb2\r\nc", r"\d$", "#", regex_opts());
        assert_eq!(out, "a#\r\nb#\r\nc");
        assert_eq!(n, 2);
    }

    #[test]
    fn replace_text_command_returns_count() {
        let res = replace_in_text("aa\nba".into(), "a".into(), "z".into(), None, None).unwrap();
        assert_eq!(res, TextReplaceResult { text: "zz\nbz".into(), count: 3 });
    }

    fn request(root: &Path, query: &str, replacement: &str) -> ReplaceRequest {
        ReplaceRequest {
            root: root.to_string_lossy().to_string(),
            query: query.into(),
            replacement: replacement.into(),
            options: regex_opts(),
            only: None,
            exclude: vec![],
            dry_run: false,
        }
    }

    fn vault() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("sub")).unwrap();
        fs::write(dir.path().join("a.md"), "v1 v2\n").unwrap();
        fs::write(dir.path().join("sub/b.txt"), "v3\n").unwrap();
        fs::write(dir.path().join("c.md"), "nothing\n").unwrap();
        dir
    }

    fn read(dir: &tempfile::TempDir, name: &str) -> String {
        fs::read_to_string(dir.path().join(name)).unwrap()
    }

    #[test]
    fn replaces_across_nested_folder() {
        let dir = vault();
        let summary = replace_in_dir_inner(&request(dir.path(), r"v(\d)", "version-$1")).unwrap();
        assert_eq!(summary, ReplaceSummary { files_changed: 2, replacements: 3, errors: vec![] });
        assert_eq!(read(&dir, "a.md"), "version-1 version-2\n");
        assert_eq!(read(&dir, "sub/b.txt"), "version-3\n");
        assert_eq!(read(&dir, "c.md"), "nothing\n");
    }

    #[test]
    fn dry_run_counts_without_writing() {
        let dir = vault();
        let mut req = request(dir.path(), r"v\d", "x");
        req.dry_run = true;
        let summary = replace_in_dir_inner(&req).unwrap();
        assert_eq!((summary.files_changed, summary.replacements), (2, 3));
        assert_eq!(read(&dir, "a.md"), "v1 v2\n");
    }

    #[test]
    fn mmap_replace_touches_node_text_only() {
        let dir = tempfile::tempdir().unwrap();
        let map = "{\n  \"format\": \"solomd-mindmap\",\n  \"data\": {\"nodeData\": {\"id\": \"r\", \"topic\": \"format v1\"}}\n}";
        fs::write(dir.path().join("m.mmap"), map).unwrap();
        let summary = replace_in_dir_inner(&request(dir.path(), "format", "layout")).unwrap();
        assert_eq!(summary.replacements, 1);
        let out = read(&dir, "m.mmap");
        assert!(out.contains("\"format\": \"solomd-mindmap\""));
        assert!(out.contains("\"topic\": \"layout v1\""));
    }

    #[test]
    fn replace_in_text_uses_mmap_mode_for_mmap_paths() {
        let map = r#"{"format":"x","data":{"nodeData":{"id":"r","topic":"x"}}}"#;
        let res = replace_in_text(map.into(), "x".into(), "y".into(), None, Some("/a/b.mmap".into())).unwrap();
        assert_eq!(res.count, 1);
        assert!(res.text.contains(r#""format":"x""#));
        assert!(res.text.contains(r#""topic":"y""#));
    }

    #[test]
    fn excluded_files_are_untouched() {
        let dir = vault();
        let mut req = request(dir.path(), r"v\d", "x");
        req.exclude = vec![dir.path().join("a.md").to_string_lossy().to_string()];
        let summary = replace_in_dir_inner(&req).unwrap();
        assert_eq!(summary.files_changed, 1);
        assert_eq!(read(&dir, "a.md"), "v1 v2\n");
    }

    #[test]
    fn only_list_ignores_files_outside_root() {
        let dir = vault();
        let outside = tempfile::tempdir().unwrap();
        let stray = outside.path().join("x.md");
        fs::write(&stray, "v9\n").unwrap();
        let mut req = request(dir.path(), r"v\d", "x");
        req.only = Some(vec![
            dir.path().join("sub/b.txt").to_string_lossy().to_string(),
            stray.to_string_lossy().to_string(),
        ]);
        let summary = replace_in_dir_inner(&req).unwrap();
        assert_eq!(summary.files_changed, 1);
        assert_eq!(read(&dir, "sub/b.txt"), "x\n");
        assert_eq!(fs::read_to_string(&stray).unwrap(), "v9\n");
        assert_eq!(read(&dir, "a.md"), "v1 v2\n");
    }

    #[test]
    fn skip_code_leaves_inline_and_fenced_code_alone() {
        let opts = SearchOptions { regex: true, case_sensitive: true, skip_code: true };
        let re = build_matcher("find", opts).unwrap();
        let rep = Replacement::new("`$&`", true);
        let text = "find `find` x\n```\nfind\n```\n```sh; find```\nfind\n";
        let (out, count) = apply_to_text_skipping_code(&re, text, &rep);
        assert_eq!(out, "`find` `find` x\n```\nfind\n```\n```sh; find```\n`find`\n");
        assert_eq!(count, 2);
    }
}
