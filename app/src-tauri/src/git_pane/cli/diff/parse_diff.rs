//! Language guess, repo-path guard and unified-diff parsing.

use crate::git_pane::cli::git::{DiffHunk, DiffLine, DiffLineType, DiffResult, GitError};

const EXTENSION_MAP: &[(&str, &str)] = &[
    ("ts", "typescript"),
    ("tsx", "typescript"),
    ("mts", "typescript"),
    ("cts", "typescript"),
    ("js", "javascript"),
    ("jsx", "javascript"),
    ("mjs", "javascript"),
    ("cjs", "javascript"),
    ("rb", "ruby"),
    ("rake", "ruby"),
    ("gemspec", "ruby"),
    ("erb", "ruby"),
    ("vue", "vue"),
    ("css", "css"),
    ("scss", "css"),
    ("json", "json"),
    ("md", "markdown"),
    ("py", "python"),
    ("rs", "rust"),
    ("go", "go"),
    ("java", "java"),
    ("html", "html"),
    ("htm", "html"),
    ("xml", "xml"),
    ("yml", "yaml"),
    ("yaml", "yaml"),
    ("sh", "bash"),
    ("sql", "sql"),
];

/// Mirrors `guessLanguage` in `shared/diff/guessLanguage.ts`.
pub fn guess_language(path: &str) -> String {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    // TS `path.split('.').pop()` on extensionless names returns the whole
    // name, which then misses the map → plaintext. Same outcome here.
    for (key, lang) in EXTENSION_MAP {
        if *key == ext {
            return lang.to_string();
        }
    }
    "plaintext".to_string()
}

/// Reject relative paths escaping the repo root (mirrors `pathUtils`).
pub fn assert_path_inside_repo(repo_root: &str, relative_path: &str) -> Result<String, GitError> {
    // TS strips a single leading `./` before normalizing.
    let stripped = relative_path.strip_prefix("./").unwrap_or(relative_path);
    if stripped.starts_with('/') {
        // Absolute paths resolve outside the root (unless coincidentally
        // inside — rejected here like the TS `resolve` + prefix check).
        return Err(GitError::new(
            "Unknown",
            "Path escapes the repository root.".to_string(),
        ));
    }
    let mut parts: Vec<&str> = Vec::new();
    let mut escaped = false;
    for part in stripped.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                if parts.pop().is_none() {
                    escaped = true;
                }
            }
            _ => parts.push(part),
        }
    }
    let normalized = parts.join("/");
    if escaped || normalized == ".." || normalized.starts_with("../") {
        return Err(GitError::new(
            "Unknown",
            "Path escapes the repository root.".to_string(),
        ));
    }
    let root = repo_root.trim_end_matches('/');
    let full = if normalized.is_empty() {
        root.to_string()
    } else {
        format!("{root}/{normalized}")
    };
    if full != root && !full.starts_with(&format!("{root}/")) {
        return Err(GitError::new(
            "Unknown",
            "Path escapes the repository root.".to_string(),
        ));
    }
    Ok(normalized)
}

/// Parses unified diff output into structured hunks (mirrors `diffParser`).
pub fn parse_unified_diff(path: &str, raw: &str) -> DiffResult {
    let empty = || DiffResult {
        path: path.to_string(),
        old_path: None,
        binary: false,
        too_large: false,
        language: guess_language(path),
        hunks: Vec::new(),
        additions: 0,
        deletions: 0,
    };
    if raw.trim().is_empty() {
        return empty();
    }
    if raw
        .lines()
        .any(|l| l.starts_with("Binary files ") || l.starts_with("GIT binary patch"))
    {
        let mut result = empty();
        result.binary = true;
        return result;
    }

    let lines: Vec<&str> = raw.split('\n').collect();
    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut current: Option<DiffHunk> = None;
    let mut old_line: u32 = 0;
    let mut new_line: u32 = 0;
    let mut additions: u32 = 0;
    let mut deletions: u32 = 0;
    let mut old_path: Option<String> = None;

    let line_entry =
        |t: DiffLineType, content: String, old: Option<u32>, new: Option<u32>| DiffLine {
            line_type: t,
            content,
            old_line: old,
            new_line: new,
        };

    for (idx, raw_line) in lines.iter().enumerate() {
        let line = raw_line.strip_suffix('\r').unwrap_or(raw_line);
        let is_last = idx == lines.len() - 1;
        if line.starts_with("+++ ") {
            continue;
        }
        if let Some(stripped) = line.strip_prefix("--- ") {
            let p = stripped.trim();
            if let Some(rest) = p.strip_prefix("a/") {
                old_path = Some(rest.to_string());
            } else if p != "/dev/null" {
                old_path = Some(p.to_string());
            }
            continue;
        }
        if let Some((o_start, o_lines, n_start, n_lines)) = parse_hunk_header(line) {
            if let Some(done) = current.take() {
                hunks.push(done);
            }
            old_line = o_start;
            new_line = n_start;
            current = Some(DiffHunk {
                header: line.to_string(),
                old_start: o_start,
                old_lines: o_lines,
                new_start: n_start,
                new_lines: n_lines,
                lines: Vec::new(),
            });
            continue;
        }
        // Combined diff (merge) headers use `@@@`; skip without losing the file.
        if line.starts_with("@@@") {
            continue;
        }
        let Some(hunk) = current.as_mut() else {
            continue;
        };
        if line.starts_with('+') && !line.starts_with("+++") {
            let n = new_line;
            new_line += 1;
            hunk.lines.push(line_entry(
                DiffLineType::Add,
                line[1..].to_string(),
                None,
                Some(n),
            ));
            additions += 1;
        } else if line.starts_with('-') && !line.starts_with("---") {
            let n = old_line;
            old_line += 1;
            hunk.lines.push(line_entry(
                DiffLineType::Del,
                line[1..].to_string(),
                Some(n),
                None,
            ));
            deletions += 1;
        } else if line.starts_with(' ') || (line.is_empty() && !is_last) {
            let (o, n) = (old_line, new_line);
            old_line += 1;
            new_line += 1;
            hunk.lines.push(line_entry(
                DiffLineType::Context,
                line[1..].to_string(),
                Some(o),
                Some(n),
            ));
        } else if line.starts_with('\\') {
            hunk.lines
                .push(line_entry(DiffLineType::Meta, line.to_string(), None, None));
        }
    }

    if let Some(done) = current {
        hunks.push(done);
    }
    DiffResult {
        path: path.to_string(),
        old_path,
        binary: false,
        too_large: false,
        language: guess_language(path),
        hunks,
        additions,
        deletions,
    }
}

/// `@@ -old[,count] +new[,count] @@...` — counts default to 1 like the TS regex.
fn parse_hunk_header(line: &str) -> Option<(u32, u32, u32, u32)> {
    let rest = line.strip_prefix("@@ ")?;
    let (ranges, _trailing) = rest.split_once(" @@")?;
    let mut parts = ranges.split_whitespace();
    let old = parts.next()?.strip_prefix('-')?;
    let new = parts.next()?.strip_prefix('+')?;
    if parts.next().is_some() {
        return None;
    }
    let (old_start, old_lines) = parse_range(old)?;
    let (new_start, new_lines) = parse_range(new)?;
    Some((old_start, old_lines, new_start, new_lines))
}

fn parse_range(s: &str) -> Option<(u32, u32)> {
    let (start, count) = match s.split_once(',') {
        Some((a, b)) => (a, Some(b)),
        None => (s, None),
    };
    let start: u32 = start.parse().ok()?;
    let count: u32 = match count {
        Some(c) => c.parse().ok()?,
        None => 1,
    };
    Some((start, count))
}
