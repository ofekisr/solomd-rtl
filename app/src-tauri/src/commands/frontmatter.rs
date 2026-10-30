use std::fs;
// ---------------------------------------------------------------------------
// Frontmatter property editing (v4.6 F1 — Properties inspector).
//
// The YAML frontmatter block at the top of a note is the ONLY source of truth
// for the Properties inspector. These two commands perform a *line-surgical*
// edit: instead of re-serializing the whole `---`…`---` block (which would
// reflow inline arrays into block style, drop comments, and renormalize quote
// styles on UNTOUCHED keys), we map the block into logical entries — each one
// owning the exact source lines of a top-level key, including any indented /
// sequence continuation lines — then mutate ONLY the lines of the single key
// being changed/added/removed. Every other line in the block is preserved
// byte-for-byte, as is the note BODY (everything after the closing `---`). Only
// the value we actually write is rendered through `serde_yaml`, so quoting /
// typing of that one scalar is correct while neighbors keep their original
// spelling (inline arrays, comments, quote style) and git diffs stay to a
// single key.
//
// A note with NO prior frontmatter that gains its first key gets a block
// synthesized at the very top, ahead of any leading `# H1`, with no spurious
// blank line. Deleting the last key drops the block entirely.
// ---------------------------------------------------------------------------

/// The line layout of a parsed frontmatter block, split so we can do
/// line-surgical edits while preserving every untouched byte.
struct BlockLayout {
    /// `\r\n` if the file used CRLF in the block, else `\n`.
    nl: &'static str,
    /// `true` when the source actually had a `---`…`---` block.
    had_block: bool,
    /// The exact bytes of the open fence line incl. its newline (e.g. "---\n").
    open: String,
    /// The exact bytes of the close fence line incl. its newline.
    close: String,
    /// The inner YAML lines (between the fences), each WITHOUT its trailing
    /// newline. Reassembled with `nl`.
    inner_lines: Vec<String>,
    /// Everything after the closing fence line, byte-for-byte. When there was
    /// no block this holds the entire original file.
    body: String,
}

/// One logical top-level key's footprint inside the block: the inclusive line
/// range it occupies (the `key:` line plus indented/sequence continuations).
struct KeySpan {
    key: String,
    /// First inner-line index (the `key:` line).
    start: usize,
    /// One-past-last inner-line index (covers continuation lines).
    end: usize,
}

/// A top-level YAML key line looks like `key:` or `key: value` at column 0
/// (no leading whitespace, not a comment, not a sequence item). Quoted keys
/// (`"a: b": x`) are handled by scanning for the first unquoted `:` followed by
/// space/EOL. Returns the raw key token (still quoted if quoted in source) or
/// None for non-key lines (comments, blanks, indented continuations, sequence
/// items).
fn top_level_key_of(line: &str) -> Option<String> {
    if line.is_empty() || line.starts_with([' ', '\t', '#', '-']) {
        return None;
    }
    let bytes = line.as_bytes();
    let mut in_single = false;
    let mut in_double = false;
    for (i, &b) in bytes.iter().enumerate() {
        match b {
            b'\'' if !in_double => in_single = !in_single,
            b'"' if !in_single => in_double = !in_double,
            b':' if !in_single && !in_double => {
                let next = bytes.get(i + 1);
                if next.is_none() || next == Some(&b' ') || next == Some(&b'\t') {
                    return Some(line[..i].to_string());
                }
            }
            _ => {}
        }
    }
    None
}

/// Unquote a raw YAML key token into its logical string (so `"a: b"` → `a: b`).
/// Falls back to the trimmed raw token for plain scalars.
fn unquote_key(raw: &str) -> String {
    let t = raw.trim();
    if t.len() >= 2
        && ((t.starts_with('"') && t.ends_with('"'))
            || (t.starts_with('\'') && t.ends_with('\'')))
    {
        if let Ok(serde_yaml::Value::Mapping(m)) =
            serde_yaml::from_str::<serde_yaml::Value>(&format!("{t}: 0"))
        {
            if let Some((serde_yaml::Value::String(k), _)) = m.into_iter().next() {
                return k;
            }
        }
    }
    t.to_string()
}

/// Split the raw file into a line-preserving block layout.
fn split_block(raw: &str) -> Result<BlockLayout, String> {
    let starts_lf = raw.starts_with("---\n");
    let starts_crlf = raw.starts_with("---\r\n");
    if !starts_lf && !starts_crlf {
        return Ok(BlockLayout {
            nl: if raw.contains("\r\n") { "\r\n" } else { "\n" },
            had_block: false,
            open: String::new(),
            close: String::new(),
            inner_lines: Vec::new(),
            body: raw.to_string(),
        });
    }
    let nl: &'static str = if starts_crlf { "\r\n" } else { "\n" };
    let open_len = if starts_crlf { 5 } else { 4 };
    let rest = &raw[open_len..];

    // Locate the closing fence line (`---` or `...`).
    let mut offset = 0usize;
    let mut close_start: Option<usize> = None;
    let mut close_len = 0usize;
    for line in rest.split_inclusive('\n') {
        let trimmed = line.trim_end_matches(['\n', '\r']);
        if trimmed == "---" || trimmed == "..." {
            close_start = Some(offset);
            close_len = line.len();
            break;
        }
        offset += line.len();
    }
    let Some(close_start) = close_start else {
        // Unterminated — don't risk destroying content we can't bound.
        return Ok(BlockLayout {
            nl,
            had_block: false,
            open: String::new(),
            close: String::new(),
            inner_lines: Vec::new(),
            body: raw.to_string(),
        });
    };
    let yaml_src = &rest[..close_start];
    let close = rest[close_start..close_start + close_len].to_string();
    let body = rest[close_start + close_len..].to_string();

    // Validate the YAML up front so we reject malformed blocks rather than
    // silently corrupting them (matches the old surface-the-error behavior).
    if !yaml_src.trim().is_empty() {
        match serde_yaml::from_str::<serde_yaml::Value>(yaml_src) {
            Ok(_) => {}
            Err(e) => return Err(format!("invalid frontmatter YAML: {e}")),
        }
    }

    // Split the inner region into lines without their trailing newline. We
    // split on '\n' and strip a trailing '\r' so CRLF survives via `nl`.
    let inner_lines: Vec<String> = if yaml_src.is_empty() {
        Vec::new()
    } else {
        yaml_src
            .strip_suffix('\n')
            .unwrap_or(yaml_src)
            .split('\n')
            .map(|l| l.trim_end_matches('\r').to_string())
            .collect()
    };

    Ok(BlockLayout {
        nl,
        had_block: true,
        open: raw[..open_len].to_string(),
        close,
        inner_lines,
        body,
    })
}

/// Compute the line spans of each top-level key in the inner lines. A key's
/// span runs from its `key:` line up to (but excluding) the next top-level key
/// line; indented lines and `- ` sequence items in between are continuations.
fn key_spans(inner: &[String]) -> Vec<KeySpan> {
    let mut spans: Vec<KeySpan> = Vec::new();
    let mut i = 0;
    while i < inner.len() {
        if let Some(raw_key) = top_level_key_of(&inner[i]) {
            let start = i;
            let mut end = i + 1;
            while end < inner.len() {
                let l = &inner[end];
                let is_continuation = l.is_empty()
                    || l.starts_with([' ', '\t'])
                    || l.starts_with('-'); // top-level sequence item
                // A blank line is only a continuation if a real continuation
                // follows it; otherwise it's a separator and the key ends here.
                if l.is_empty() {
                    let next_real = inner[end + 1..]
                        .iter()
                        .find(|x| !x.is_empty());
                    let follows = next_real
                        .map(|x| x.starts_with([' ', '\t', '-']))
                        .unwrap_or(false);
                    if !follows {
                        break;
                    }
                    end += 1;
                } else if is_continuation {
                    end += 1;
                } else {
                    break;
                }
            }
            spans.push(KeySpan {
                key: unquote_key(&raw_key),
                start,
                end,
            });
            i = end;
        } else {
            i += 1;
        }
    }
    spans
}

/// Render a single `key: value` (or multi-line) entry through serde_yaml,
/// returning the lines WITHOUT trailing newlines. Only used for the one key
/// being written, so neighbor formatting is never disturbed.
fn render_entry(key: &str, value: &serde_json::Value) -> Result<Vec<String>, String> {
    let mut m = serde_yaml::Mapping::new();
    m.insert(
        serde_yaml::Value::String(key.to_string()),
        json_to_yaml(value),
    );
    let yaml = serde_yaml::to_string(&serde_yaml::Value::Mapping(m))
        .map_err(|e| format!("serialize frontmatter: {e}"))?;
    Ok(yaml
        .trim_end_matches('\n')
        .split('\n')
        .map(|l| l.to_string())
        .collect())
}

/// Reassemble a block layout into a full file.
fn rebuild_block(layout: &BlockLayout) -> String {
    // Empty block (no keys/lines left) → drop the frontmatter, keep body.
    if layout.had_block && layout.inner_lines.is_empty() {
        return layout.body.clone();
    }
    let mut out = String::new();
    if layout.had_block {
        out.push_str(&layout.open);
        out.push_str(&layout.inner_lines.join(layout.nl));
        out.push_str(layout.nl);
        out.push_str(&layout.close);
        out.push_str(&layout.body);
        return out;
    }
    // Synthesizing a brand-new block at the very top. No spurious blank line
    // ahead of a leading `# H1`: the closing fence's newline already separates
    // the block from the body. Trim leading newlines the body carried.
    out.push_str("---");
    out.push_str(layout.nl);
    out.push_str(&layout.inner_lines.join(layout.nl));
    out.push_str(layout.nl);
    out.push_str("---");
    out.push_str(layout.nl);
    if !layout.body.is_empty() {
        out.push_str(layout.body.trim_start_matches(['\n', '\r']));
    }
    out
}

/// Convert an incoming JSON value (from the JS side, where typing survives) to
/// a YAML value so quoting/typing is decided by serde_yaml's emitter:
/// numbers stay bare, booleans stay bare, strings get quoted only if needed,
/// arrays become sequences per serde_yaml defaults.
fn json_to_yaml(v: &serde_json::Value) -> serde_yaml::Value {
    match v {
        serde_json::Value::Null => serde_yaml::Value::Null,
        serde_json::Value::Bool(b) => serde_yaml::Value::Bool(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                serde_yaml::Value::Number(i.into())
            } else if let Some(u) = n.as_u64() {
                serde_yaml::Value::Number(u.into())
            } else if let Some(f) = n.as_f64() {
                serde_yaml::Value::Number(f.into())
            } else {
                serde_yaml::Value::String(n.to_string())
            }
        }
        serde_json::Value::String(s) => serde_yaml::Value::String(s.clone()),
        serde_json::Value::Array(a) => {
            serde_yaml::Value::Sequence(a.iter().map(json_to_yaml).collect())
        }
        serde_json::Value::Object(o) => {
            let mut m = serde_yaml::Mapping::new();
            for (k, val) in o {
                m.insert(serde_yaml::Value::String(k.clone()), json_to_yaml(val));
            }
            serde_yaml::Value::Mapping(m)
        }
    }
}

/// Set (insert or update) a single frontmatter key with a *line-surgical* edit:
/// only the target key's lines are rewritten (in place on update, appended on
/// insert). Every other line — comments, inline arrays, quote styles of other
/// keys — and the note body are preserved byte-for-byte. Returns the full
/// rewritten file content. Pure function over strings so it's unit-testable
/// without Tauri/IO — see `tests/frontmatter_edit_test.rs`.
pub fn set_frontmatter_property_str(
    raw: &str,
    key: &str,
    value: &serde_json::Value,
) -> Result<String, String> {
    if key.trim().is_empty() {
        return Err("frontmatter key must not be empty".into());
    }
    let mut layout = split_block(raw)?;
    let entry = render_entry(key, value)?;
    let spans = key_spans(&layout.inner_lines);

    if let Some(span) = spans.iter().find(|s| s.key == key) {
        // Update in place: replace exactly the lines this key occupied with the
        // freshly rendered single-key entry. Neighboring keys and their inline
        // formatting / comments are untouched.
        layout
            .inner_lines
            .splice(span.start..span.end, entry.into_iter());
    } else {
        // Append at the end of the block (after the last existing line).
        layout.inner_lines.extend(entry);
    }
    Ok(rebuild_block(&layout))
}

/// Delete a single frontmatter key with a line-surgical edit: only that key's
/// lines are removed; all other lines and the note body are preserved
/// byte-for-byte. A missing key is a no-op. Deleting the last key drops the
/// whole frontmatter block. Returns the full rewritten file content.
pub fn delete_frontmatter_property_str(raw: &str, key: &str) -> Result<String, String> {
    let mut layout = split_block(raw)?;
    let spans = key_spans(&layout.inner_lines);
    if let Some(span) = spans.iter().find(|s| s.key == key) {
        layout.inner_lines.drain(span.start..span.end);
        // If only blank lines / comments remain (no real keys left), treat the
        // block as empty so `rebuild_block` drops the frontmatter entirely.
        if key_spans(&layout.inner_lines).is_empty() {
            layout.inner_lines.clear();
        }
    }
    Ok(rebuild_block(&layout))
}

/// Tauri command: surgically set a frontmatter property on `path` and persist
/// it to disk, returning the rewritten file content so the caller can reflow
/// the open editor without a re-read. Body bytes + key order are preserved.
#[tauri::command]
pub async fn update_frontmatter_property(
    path: String,
    key: String,
    value: serde_json::Value,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let next = set_frontmatter_property_str(&raw, &key, &value)?;
        fs::write(&path, &next).map_err(|e| e.to_string())?;
        Ok(next)
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

/// Tauri command: surgically delete a frontmatter property on `path` and
/// persist it, returning the rewritten file content. Body bytes + key order
/// of the remaining keys are preserved.
#[tauri::command]
pub async fn delete_frontmatter_property(
    path: String,
    key: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let next = delete_frontmatter_property_str(&raw, &key)?;
        fs::write(&path, &next).map_err(|e| e.to_string())?;
        Ok(next)
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}
