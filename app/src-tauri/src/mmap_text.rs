//! Text fields inside a `.mmap` mind map, for folder search & replace.
//!
//! A `.mmap` file is JSON; users search the node text, not the JSON. This
//! scanner walks the raw text and yields every string value whose key is
//! `topic` or `note`, with its byte span and the `id` of the enclosing node
//! object. Replacing rewrites only those spans, so key order, indentation and
//! every other byte of the file stay exactly as they were.

use std::ops::Range;
use std::path::Path;

const TEXT_KEYS: &[&str] = &["topic", "note"];
const ID_KEY: &str = "id";
pub const MMAP_EXT: &str = "mmap";

#[derive(Debug, Clone, PartialEq)]
pub struct TextField {
    pub node_id: Option<String>,
    pub key: &'static str,
    pub value: String,
    pub span: Range<usize>,
}

pub fn is_mmap(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case(MMAP_EXT))
        .unwrap_or(false)
}

pub fn text_fields(json: &str) -> Vec<TextField> {
    let mut scanner = Scanner::default();
    scanner.run(json);
    scanner.fields
}

/// Rebuild `json`, replacing each text field for which `edit` returns a new
/// value. Returns `None` when nothing changed.
pub fn replace_fields(json: &str, mut edit: impl FnMut(&TextField) -> Option<String>) -> Option<String> {
    let mut out = String::with_capacity(json.len());
    let mut cursor = 0;
    let mut changed = false;
    for field in text_fields(json) {
        let Some(new_value) = edit(&field) else { continue };
        if new_value == field.value {
            continue;
        }
        let Ok(encoded) = serde_json::to_string(&new_value) else { continue };
        out.push_str(&json[cursor..field.span.start]);
        out.push_str(&encoded);
        cursor = field.span.end;
        changed = true;
    }
    if !changed {
        return None;
    }
    out.push_str(&json[cursor..]);
    Some(out)
}

#[derive(Default)]
struct Scanner {
    fields: Vec<TextField>,
    /// One entry per open `{`: the `id` seen so far in that object.
    objects: Vec<Option<String>>,
    pending_key: Option<String>,
    prev_significant: u8,
}

impl Scanner {
    fn run(&mut self, json: &str) {
        let bytes = json.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            match bytes[i] {
                b'"' => {
                    let end = string_end(bytes, i);
                    self.on_string(json, i..end);
                    self.prev_significant = b'"';
                    i = end;
                    continue;
                }
                b'{' => self.objects.push(None),
                b'}' => {
                    self.objects.pop();
                }
                b if b.is_ascii_whitespace() => {
                    i += 1;
                    continue;
                }
                _ => {}
            }
            self.prev_significant = bytes[i];
            i += 1;
        }
    }

    fn on_string(&mut self, json: &str, span: Range<usize>) {
        let Ok(text) = serde_json::from_str::<String>(&json[span.clone()]) else { return };
        if next_significant(json.as_bytes(), span.end) == Some(b':') {
            self.pending_key = Some(text);
            return;
        }
        let key = self.pending_key.take();
        if self.prev_significant != b':' {
            return;
        }
        match key.as_deref() {
            Some(ID_KEY) => {
                if let Some(slot) = self.objects.last_mut() {
                    *slot = Some(text);
                }
            }
            Some(k) => {
                if let Some(key) = TEXT_KEYS.iter().find(|t| **t == k) {
                    let node_id = self.objects.last().cloned().flatten();
                    self.fields.push(TextField { node_id, key, value: text, span });
                }
            }
            None => {}
        }
    }
}

/// Index one past the closing quote of the string starting at `start`.
fn string_end(bytes: &[u8], start: usize) -> usize {
    let mut j = start + 1;
    while j < bytes.len() {
        match bytes[j] {
            b'\\' => j += 2,
            b'"' => return j + 1,
            _ => j += 1,
        }
    }
    bytes.len()
}

fn next_significant(bytes: &[u8], from: usize) -> Option<u8> {
    bytes[from..].iter().copied().find(|b| !b.is_ascii_whitespace())
}

#[cfg(test)]
mod tests {
    use super::*;

    const MAP: &str = r#"{
  "format": "solomd-mindmap",
  "data": {
    "nodeData": {
      "id": "root",
      "topic": "שלום \"world\"",
      "tags": ["topic", "note"],
      "children": [
        { "id": "a", "topic": "alpha", "note": "line1\nline2", "children": [] }
      ]
    }
  },
  "snippets": [{ "id": "s1", "title": "topic", "body": "alpha" }]
}"#;

    #[test]
    fn finds_topic_and_note_values_with_node_ids() {
        let fields = text_fields(MAP);
        let summary: Vec<_> = fields
            .iter()
            .map(|f| (f.node_id.as_deref(), f.key, f.value.as_str()))
            .collect();
        assert_eq!(
            summary,
            vec![
                (Some("root"), "topic", "שלום \"world\""),
                (Some("a"), "topic", "alpha"),
                (Some("a"), "note", "line1\nline2"),
            ]
        );
    }

    #[test]
    fn replace_rewrites_only_text_values() {
        let out = replace_fields(MAP, |f| Some(f.value.replace("alpha", "beta"))).unwrap();
        assert!(out.contains(r#""topic": "beta""#));
        assert!(out.contains(r#""body": "alpha""#));
        assert_eq!(out.len(), MAP.len() - 1);
    }

    #[test]
    fn replace_escapes_quotes_and_newlines() {
        let out = replace_fields(MAP, |f| (f.value == "alpha").then(|| "a \"q\"\nb".to_string())).unwrap();
        assert!(out.contains(r#""topic": "a \"q\"\nb""#));
        let reparsed: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(reparsed["data"]["nodeData"]["children"][0]["topic"], "a \"q\"\nb");
    }

    #[test]
    fn no_change_returns_none() {
        assert!(replace_fields(MAP, |_| None).is_none());
    }
}
