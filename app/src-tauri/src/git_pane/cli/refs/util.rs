//! Date, lane-colour, grouping and SHA helpers.

use crate::git_pane::cli::log::hash_string as hash_string_pub;

pub fn epoch_iso() -> String {
    "1970-01-01T00:00:00.000Z".to_string()
}

/// Parse a git date (`iso-strict`, possibly `+0000` without colon) to ISO millis.
pub fn parse_git_date(raw: &str) -> String {
    let s = raw.trim();
    if s.is_empty() {
        return epoch_iso();
    }
    let mut norm = s.to_string();
    // `+0000` (no colon) → `+00:00` so RFC 3339 parsing accepts both.
    if norm.len() >= 5 {
        let cut = norm.len() - 5;
        let tail = &norm.as_bytes()[cut..];
        if (tail[0] == b'+' || tail[0] == b'-') && tail[1..].iter().all(|b| b.is_ascii_digit()) {
            let head = norm[..cut].to_string();
            let tz = norm[cut..].to_string();
            norm = format!("{}{}:{}", head, &tz[..3], &tz[3..]);
        }
    }
    chrono::DateTime::parse_from_rfc3339(&norm)
        .map(|dt| {
            dt.to_utc()
                .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        })
        .unwrap_or_else(|_| epoch_iso())
}

pub fn lane_color_index_for(name: &str) -> u32 {
    (hash_string_pub(name) as usize % 8) as u32
}

pub fn group_for(name: &str) -> String {
    match name.find('/') {
        Some(idx) => name[..idx].to_string(),
        None => String::new(),
    }
}

pub fn is_full_sha(s: &str) -> bool {
    s.len() == 40 && s.chars().all(|c| c.is_ascii_hexdigit())
}
