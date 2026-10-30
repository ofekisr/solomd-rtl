use std::fs;
use std::path::Path;

use super::fs_ops::is_markdown_path;

/// An absolute path reduced to its `Normal` components. Prefix and root
/// components are dropped: every comparison here is between two paths under
/// the same vault, so the shared root contributes nothing, and dropping it
/// makes Windows `C:\a\b` and unix `/a/b` behave identically.
pub fn abs_segments(p: &Path) -> Vec<String> {
    p.components()
        .filter_map(|c| match c {
            std::path::Component::Normal(s) => Some(s.to_string_lossy().to_string()),
            _ => None,
        })
        .collect()
}

/// Resolve a relative link target against a directory, purely lexically.
/// `None` when the target climbs above the filesystem root — we leave those
/// alone rather than guess.
pub fn lexical_resolve(base: &[String], target: &str) -> Option<Vec<String>> {
    let mut out = base.to_vec();
    for seg in target.split('/') {
        match seg {
            "" | "." => {}
            ".." => {
                out.pop()?;
            }
            s => out.push(s.to_string()),
        }
    }
    Some(out)
}

/// Express the absolute `target` relative to the absolute `base` directory.
pub fn lexical_relative(base: &[String], target: &[String]) -> String {
    let common = base
        .iter()
        .zip(target.iter())
        .take_while(|(a, b)| a == b)
        .count();
    let mut segs: Vec<String> = vec!["..".to_string(); base.len() - common];
    segs.extend(target[common..].iter().cloned());
    if segs.is_empty() {
        ".".to_string()
    } else {
        segs.join("/")
    }
}

/// A target we must not touch: an anchor, an absolute path, or anything with
/// a URL scheme. The scheme test also catches a Windows drive letter (`C:\…`).
fn is_external_target(t: &str) -> bool {
    if t.is_empty() || t.starts_with('#') || t.starts_with('/') || t.starts_with('\\') {
        return true;
    }
    match t.find(':') {
        None => false,
        Some(i) => {
            let scheme = &t[..i];
            !scheme.is_empty()
                && scheme.starts_with(|c: char| c.is_ascii_alphabetic())
                && scheme
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '-' || c == '.')
        }
    }
}

/// Re-anchor one link target. Returns `None` when nothing should change.
fn shift_target(
    t: &str,
    old_dir: &[String],
    new_dir: &[String],
    moved_roots: &[Vec<String>],
) -> Option<String> {
    if is_external_target(t) {
        return None;
    }
    // `file.md#heading` / `file.md?x=1` — only the path part is a location.
    let cut = t.find(['#', '?']).unwrap_or(t.len());
    let (path, suffix) = t.split_at(cut);
    if path.is_empty() {
        return None;
    }
    let resolved = lexical_resolve(old_dir, path)?;
    // Pointing into something that moved along with us: the relationship is
    // unchanged, so the written target is still correct.
    if moved_roots.iter().any(|r| resolved.starts_with(r)) {
        return None;
    }
    let shifted = format!("{}{}", lexical_relative(new_dir, &resolved), suffix);
    if shifted == t {
        None
    } else {
        Some(shifted)
    }
}

fn inline_link_re() -> &'static regex_lite::Regex {
    static RE: std::sync::OnceLock<regex_lite::Regex> = std::sync::OnceLock::new();
    RE.get_or_init(|| regex_lite::Regex::new(r"\]\(([^)\n]*)\)").unwrap())
}

fn ref_def_re() -> &'static regex_lite::Regex {
    static RE: std::sync::OnceLock<regex_lite::Regex> = std::sync::OnceLock::new();
    RE.get_or_init(|| regex_lite::Regex::new(r"^[ \t]*\[[^\]\n]+\]:[ \t]*(\S+)").unwrap())
}

fn html_attr_re() -> &'static regex_lite::Regex {
    static RE: std::sync::OnceLock<regex_lite::Regex> = std::sync::OnceLock::new();
    RE.get_or_init(|| regex_lite::Regex::new(r#"(?:src|href)[ \t]*=[ \t]*"([^"\n]*)""#).unwrap())
}

/// Inside a `](…)` payload, isolate the destination from an optional title
/// (`path "title"`) and an optional `<>` wrapper. Returns its byte range.
fn destination_range(payload: &str) -> Option<(usize, usize)> {
    let lead = payload.len() - payload.trim_start().len();
    let rest = &payload[lead..];
    if let Some(stripped) = rest.strip_prefix('<') {
        let close = stripped.find('>')?;
        return Some((lead + 1, lead + 1 + close));
    }
    let end = rest
        .find(|c: char| c.is_whitespace())
        .unwrap_or(rest.len());
    if end == 0 {
        None
    } else {
        Some((lead, lead + end))
    }
}

/// Rewrite every relative link target on ONE line. Matches inside an inline
/// code span are skipped — an odd number of backticks before the match means
/// we're inside one, and rewriting sample code in prose would be a bug.
fn rewrite_line(
    line: &str,
    old_dir: &[String],
    new_dir: &[String],
    moved_roots: &[Vec<String>],
) -> Option<String> {
    let mut edits: Vec<(usize, usize, String)> = Vec::new();

    let consider = |start: usize, end: usize, edits: &mut Vec<(usize, usize, String)>| {
        if line[..start].matches('`').count() % 2 == 1 {
            return;
        }
        if let Some(next) = shift_target(&line[start..end], old_dir, new_dir, moved_roots) {
            edits.push((start, end, next));
        }
    };

    for c in inline_link_re().captures_iter(line) {
        let payload = c.get(1).unwrap();
        if let Some((s, e)) = destination_range(payload.as_str()) {
            consider(payload.start() + s, payload.start() + e, &mut edits);
        }
    }
    for re in [ref_def_re(), html_attr_re()] {
        for c in re.captures_iter(line) {
            let m = c.get(1).unwrap();
            consider(m.start(), m.end(), &mut edits);
        }
    }
    if edits.is_empty() {
        return None;
    }

    edits.sort_by_key(|(s, _, _)| *s);
    let mut out = String::with_capacity(line.len());
    let mut cursor = 0usize;
    for (s, e, replacement) in edits {
        if s < cursor {
            continue; // overlapping match (an href inside a markdown link) — first wins
        }
        out.push_str(&line[cursor..s]);
        out.push_str(&replacement);
        cursor = e;
    }
    out.push_str(&line[cursor..]);
    Some(out)
}

/// Rewrite a whole note body. Fenced code blocks are passed through verbatim.
pub fn rewrite_links_after_move(
    body: &str,
    old_dir: &[String],
    new_dir: &[String],
    moved_roots: &[Vec<String>],
) -> Option<String> {
    let mut out = String::with_capacity(body.len());
    let mut in_fence = false;
    let mut changed = false;
    for line in body.split_inclusive('\n') {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fence = !in_fence;
            out.push_str(line);
            continue;
        }
        if in_fence {
            out.push_str(line);
            continue;
        }
        match rewrite_line(line, old_dir, new_dir, moved_roots) {
            Some(next) => {
                changed = true;
                out.push_str(&next);
            }
            None => out.push_str(line),
        }
    }
    if changed {
        Some(out)
    } else {
        None
    }
}

/// Walk everything that just moved and re-anchor the relative links in each
/// markdown file. Non-UTF-8 bodies are skipped rather than transcoded: a
/// GBK-encoded note round-trips through the editor, not through here.
pub(super) fn relink_moved_tree(new_root: &Path, old_root: &Path, moved_roots: &[Vec<String>]) {
    let files: Vec<std::path::PathBuf> = if new_root.is_dir() {
        walkdir::WalkDir::new(new_root)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file() && is_markdown_path(e.path()))
            .map(|e| e.path().to_path_buf())
            .collect()
    } else if is_markdown_path(new_root) {
        vec![new_root.to_path_buf()]
    } else {
        Vec::new()
    };

    for file in files {
        // Where this exact file used to live. For a single-file move the
        // relative part is empty and the old path is just `old_root`.
        let old_file = match file.strip_prefix(new_root) {
            Ok(rel) if !rel.as_os_str().is_empty() => old_root.join(rel),
            _ => old_root.to_path_buf(),
        };
        let (Some(od), Some(nd)) = (old_file.parent(), file.parent()) else {
            continue;
        };
        let old_dir = abs_segments(od);
        let new_dir = abs_segments(nd);
        if old_dir == new_dir {
            continue;
        }
        let Ok(bytes) = fs::read(&file) else { continue };
        let Ok(body) = std::str::from_utf8(&bytes) else {
            continue;
        };
        if let Some(next) = rewrite_links_after_move(body, &old_dir, &new_dir, moved_roots) {
            if let Err(e) = fs::write(&file, next) {
                eprintln!("[fs_move] link rewrite write-back failed for {}: {e}", file.display());
            }
        }
    }
}
