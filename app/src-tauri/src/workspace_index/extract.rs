use super::*;

// ---------------------------------------------------------------------------
// F3 — typed relationships extraction (mirrors lib/relationships.ts).
// ---------------------------------------------------------------------------

/// Front-matter keys that are structural and never count as a typed
/// relationship even if they contain a wikilink. Must stay byte-for-byte in
/// sync with `RESERVED_RELATIONSHIP_KEYS` in `app/src/lib/relationships.ts`.
/// `_`-prefixed keys are also reserved (handled in `is_reserved_key`).
pub(super) const RESERVED_RELATIONSHIP_KEYS: &[&str] = &[
    "title",
    "aliases",
    "alias",
    "tags",
    "tag",
    "status",
    "date",
    "created",
    "modified",
    "updated",
    "icon",
    "color",
    "colour",
    "cssclass",
    "cssclasses",
    "publish",
    "permalink",
    "inbox",
];

pub(super) fn is_reserved_key(key: &str) -> bool {
    let k = key.trim();
    if k.is_empty() || k.starts_with('_') {
        return true;
    }
    let lc = k.to_lowercase();
    RESERVED_RELATIONSHIP_KEYS.iter().any(|r| *r == lc)
}

/// Collect every wikilink in `text`, returning each in canonical `[[target]]`
/// form (alias / heading stripped). Mirrors the regex used by
/// `extract_wikilinks`.
pub(super) fn refs_in_str(text: &str, out: &mut Vec<String>) {
    static RE: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\[\[([^\[\]\n]+?)\]\]").expect("wikilink regex"));
    for cap in RE.captures_iter(text) {
        let inner = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        let target_raw = match inner.split_once('|') {
            Some((t, _)) => t.trim().to_string(),
            None => inner.trim().to_string(),
        };
        let target = match target_raw.split_once('#') {
            Some((t, _)) => t.trim().to_string(),
            None => target_raw,
        };
        if !target.is_empty() {
            out.push(format!("[[{target}]]"));
        }
    }
}

/// Recurse into a front-matter value collecting wikilink refs (string scalars
/// and arrays of strings, at any depth).
pub(super) fn collect_refs(value: &serde_json::Value, out: &mut Vec<String>) {
    match value {
        serde_json::Value::String(s) => refs_in_str(s, out),
        serde_json::Value::Array(arr) => {
            for v in arr {
                collect_refs(v, out);
            }
        }
        _ => {}
    }
}

/// Extract typed relationships from parsed front matter: every non-reserved
/// key whose value contains at least one wikilink, mapped to its canonical
/// `[[ref]]` list. Mirrors `extractRelationships` in `lib/relationships.ts`.
pub(super) fn extract_relationships(fm: &serde_json::Value) -> HashMap<String, Vec<String>> {
    let mut out: HashMap<String, Vec<String>> = HashMap::new();
    if let serde_json::Value::Object(map) = fm {
        for (key, value) in map {
            if is_reserved_key(key) {
                continue;
            }
            let mut refs = Vec::new();
            collect_refs(value, &mut refs);
            if !refs.is_empty() {
                out.insert(key.clone(), refs);
            }
        }
    }
    out
}

/// Strip `[[ ]]` (and any `#heading` / `|alias`) from a ref, returning the
/// bare target stem.
pub(super) fn parse_ref_target(reference: &str) -> String {
    let mut v = Vec::new();
    refs_in_str(reference, &mut v);
    if let Some(first) = v.first() {
        // first is `[[target]]`
        return first
            .trim_start_matches("[[")
            .trim_end_matches("]]")
            .to_string();
    }
    reference.trim().to_string()
}

pub(super) fn split_front_matter(raw: &str) -> (Option<String>, &str) {
    let trimmed = raw.trim_start_matches('\u{feff}');
    if !trimmed.starts_with("---") {
        return (None, raw);
    }
    let after_first = match trimmed.find('\n') {
        Some(i) => &trimmed[i + 1..],
        None => return (None, raw),
    };
    if let Some(end) = after_first.find("\n---") {
        let yaml = &after_first[..end];
        let rest_offset_in_after = end + "\n---".len();
        // skip past the closing line break
        let rest = &after_first[rest_offset_in_after..];
        let rest = rest.strip_prefix('\n').unwrap_or(rest);
        return (Some(yaml.to_string()), rest);
    }
    (None, raw)
}

pub(super) fn extract_wikilinks(body: &str) -> Vec<WikilinkRef> {
    static RE: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r"\[\[([^\[\]\n]+?)\]\]").expect("wikilink regex")
    });
    let mut out = Vec::new();
    for (line_idx, line) in body.lines().enumerate() {
        for cap in RE.captures_iter(line) {
            let inner = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            // Form: target[#heading][|alias]
            let (target_raw, alias) = match inner.split_once('|') {
                Some((t, a)) => (t.trim().to_string(), Some(a.trim().to_string())),
                None => (inner.trim().to_string(), None),
            };
            let (target, heading) = match target_raw.split_once('#') {
                Some((t, h)) => (t.trim().to_string(), Some(h.trim().to_string())),
                None => (target_raw, None),
            };
            if target.is_empty() {
                continue;
            }
            out.push(WikilinkRef {
                target,
                heading,
                alias,
                line: (line_idx as u32) + 1,
            });
        }
    }
    out
}

pub(super) fn extract_body_tags(body: &str) -> Vec<String> {
    // Hand-rolled scanner — `regex-lite` does NOT support Unicode classes
    // (`\p{L}` / `\p{N}`), and trying to compile such a pattern panics at
    // runtime. We use `char::is_alphanumeric` which IS Unicode-aware.
    let mut out = Vec::new();
    let mut in_fence = false;
    for line in body.lines() {
        if line.trim_start().starts_with("```") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        // Strip inline code spans (cheap pass) before scanning.
        let stripped = strip_inline_code(line);
        scan_tags_in_line(&stripped, &mut out);
    }
    out
}

pub(super) fn scan_tags_in_line(line: &str, out: &mut Vec<String>) {
    let bytes = line.as_bytes();
    let mut chars = line.char_indices().peekable();
    while let Some((i, c)) = chars.next() {
        if c != '#' {
            continue;
        }
        // `#` must be at start of line OR preceded by whitespace.
        if i > 0 {
            let prev = bytes[i - 1];
            if !(prev as char).is_whitespace() {
                continue;
            }
        }
        // First char of tag must be alphanumeric (Unicode-aware).
        let mut tag = String::new();
        // Peek next char.
        let first = match chars.peek() {
            Some(&(_, ch)) if ch.is_alphanumeric() => ch,
            _ => continue,
        };
        chars.next();
        tag.push(first);
        // Subsequent chars: alphanumeric or `_` `/` `-`.
        while let Some(&(_, ch)) = chars.peek() {
            if ch.is_alphanumeric() || ch == '_' || ch == '/' || ch == '-' {
                tag.push(ch);
                chars.next();
            } else {
                break;
            }
        }
        if !tag.is_empty() {
            // a) Tag must be followed by whitespace or end-of-line — otherwise
            //    it is likely a CSS property value (e.g. `#488878;`).
            if let Some(&(_, ch)) = chars.peek() {
                if !ch.is_whitespace() {
                    continue;
                }
            }
            // b) 6-char pure hex string → almost certainly a colour code.
            if tag.len() == 6 && tag.chars().all(|c| c.is_ascii_hexdigit()) {
                continue;
            }
            // c) In table rows, skip purely numeric "tags" — they are rankings
            //    (#1, #2, #3) or issue/row numbers (#12, #26), not real tags.
            if tag.chars().all(|c| c.is_ascii_digit()) && line.trim_start().starts_with('|') {
                continue;
            }
            out.push(tag);
        }
    }
}

pub(super) fn strip_inline_code(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_code = false;
    for ch in s.chars() {
        if ch == '`' {
            in_code = !in_code;
            out.push(' ');
        } else if in_code {
            out.push(' ');
        } else {
            out.push(ch);
        }
    }
    out
}

pub(super) fn collect_yaml_tags(value: &serde_json::Value, out: &mut Vec<String>) {
    match value {
        serde_json::Value::String(s) => {
            for piece in s.split(|c: char| c == ',' || c.is_whitespace()) {
                let t = piece.trim().trim_start_matches('#');
                if !t.is_empty() {
                    out.push(t.to_string());
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for v in arr {
                collect_yaml_tags(v, out);
            }
        }
        _ => {}
    }
}


pub(super) fn extract_headings(body: &str) -> Vec<String> {
    static RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^(#{1,6})\s+(.+?)\s*$").expect("heading regex"));
    let mut out = Vec::new();
    let mut in_fence = false;
    for line in body.lines() {
        if line.trim_start().starts_with("```") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        if let Some(cap) = RE.captures(line) {
            if let Some(m) = cap.get(2) {
                out.push(m.as_str().trim().to_string());
            }
        }
    }
    out
}

/// GFM task-list items, scanned over the raw file so line numbers are the
/// file's own.
///
/// Skips fenced code (a `- [ ] step one` inside a shell block is
/// documentation, not a task) and YAML front matter.
pub(super) fn extract_tasks(raw: &str) -> Vec<TaskRef> {
    static RE: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r"^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$").expect("task regex")
    });
    let mut out = Vec::new();
    let mut in_fence = false;
    let mut in_front_matter = false;
    for (idx, line) in raw.lines().enumerate() {
        let trimmed = line.trim_start();
        if idx == 0 && line.trim_end() == "---" {
            in_front_matter = true;
            continue;
        }
        if in_front_matter {
            if line.trim_end() == "---" || line.trim_end() == "..." {
                in_front_matter = false;
            }
            continue;
        }
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        if let Some(cap) = RE.captures(line) {
            let done = cap.get(1).map(|m| m.as_str() != " ").unwrap_or(false);
            let text = cap.get(2).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
            if text.is_empty() {
                continue;
            }
            out.push(TaskRef {
                line: idx as u32 + 1,
                text,
                done,
            });
        }
    }
    out
}

pub(super) fn extract_title(fm: &serde_json::Value, headings: &[String]) -> Option<String> {
    if let serde_json::Value::Object(map) = fm {
        if let Some(serde_json::Value::String(t)) = map.get("title") {
            let trimmed = t.trim().to_string();
            if !trimmed.is_empty() {
                return Some(trimmed);
            }
        }
    }
    headings.first().cloned()
}

pub(super) fn extract_summary(body: &str) -> String {
    let mut in_fence = false;
    for line in body.lines() {
        if line.trim_start().starts_with("```") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let cleaned: String = trimmed
            .chars()
            .take(200)
            .collect();
        return cleaned;
    }
    String::new()
}
