pub(super) fn render_note(
    title: &str,
    content: &str,
    url: Option<&str>,
    tags: Option<&[String]>,
    inbox: bool,
    captured_at: &str,
) -> String {
    let mut out = String::with_capacity(content.len() + 256);
    out.push_str("---\n");
    out.push_str(&format!("title: {}\n", yaml_scalar(title)));
    if let Some(u) = url {
        let u = u.trim();
        if !u.is_empty() {
            out.push_str(&format!("source: {}\n", yaml_scalar(u)));
        }
    }
    if let Some(ts) = tags {
        let cleaned: Vec<String> = ts
            .iter()
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect();
        if !cleaned.is_empty() {
            let inner = cleaned
                .iter()
                .map(|t| yaml_scalar(t))
                .collect::<Vec<_>>()
                .join(", ");
            out.push_str(&format!("tags: [{inner}]\n"));
        }
    }
    out.push_str(&format!("inbox: {}\n", if inbox { "true" } else { "false" }));
    out.push_str(&format!("captured_at: {captured_at}\n"));
    out.push_str("---\n\n");

    // Strip an existing front-matter block from the incoming content so we
    // don't double-stack `---` blocks if the caller pre-formatted.
    let body = strip_front_matter(content);
    out.push_str(body);
    if !body.ends_with('\n') {
        out.push('\n');
    }
    out
}

pub(super) fn strip_front_matter(input: &str) -> &str {
    let trimmed = input.trim_start_matches('\u{feff}');
    if !trimmed.starts_with("---") {
        return input;
    }
    let after_first = match trimmed.find('\n') {
        Some(i) => &trimmed[i + 1..],
        None => return input,
    };
    if let Some(end) = after_first.find("\n---") {
        let rest_offset = end + "\n---".len();
        let rest = &after_first[rest_offset..];
        return rest.strip_prefix('\n').unwrap_or(rest);
    }
    input
}

pub(super) fn yaml_scalar(s: &str) -> String {
    // Quote anything that could trip YAML's plain-scalar parser. Conservative
    // but readable: a `:` is only ambiguous when followed by whitespace
    // (otherwise `https://x.com` would be force-quoted, which is ugly), and
    // a `#` is only a comment marker when preceded by whitespace.
    let mut needs_quote = s.is_empty()
        || s.contains('"')
        || s.contains('\'')
        || s.contains('\n')
        || s.contains(',')
        || s.contains('[')
        || s.contains(']')
        || s.contains('{')
        || s.contains('}')
        || s.starts_with('-')
        || s.starts_with('?')
        || s.starts_with('&')
        || s.starts_with('*')
        || s.starts_with('!')
        || s.starts_with('|')
        || s.starts_with('>')
        || s.starts_with('@')
        || s.starts_with('`')
        || s.starts_with(' ')
        || s.starts_with('#')
        || s.ends_with(' ');
    if !needs_quote {
        // `: ` (colon followed by space) terminates a plain scalar's key.
        let bytes = s.as_bytes();
        for i in 0..bytes.len() {
            if bytes[i] == b':' && (i + 1 >= bytes.len() || bytes[i + 1] == b' ') {
                needs_quote = true;
                break;
            }
            if bytes[i] == b'#' && i > 0 && bytes[i - 1] == b' ' {
                needs_quote = true;
                break;
            }
        }
    }
    if !needs_quote {
        return s.to_string();
    }
    let escaped = s.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n");
    format!("\"{escaped}\"")
}

pub(super) fn extract_first_h1(content: &str) -> Option<String> {
    for line in content.lines().take(40) {
        let t = line.trim_start();
        if let Some(rest) = t.strip_prefix("# ") {
            let h = rest.trim().to_string();
            if !h.is_empty() {
                return Some(h);
            }
        }
    }
    None
}

pub(super) fn slugify(title: &str) -> String {
    let mut out = String::with_capacity(title.len());
    let mut last_dash = false;
    for ch in title.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            last_dash = false;
        } else if ch.is_alphanumeric() {
            // Preserve CJK / accented chars as-is — readable filenames win
            // on every modern FS we ship to (APFS, NTFS, ext4 all UTF-8).
            out.push(ch);
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    // Cap to avoid pathologically long filenames from giant titles.
    if trimmed.chars().count() > 60 {
        trimmed.chars().take(60).collect()
    } else {
        trimmed
    }
}

/// `YYYY-MM-DD-HHMM` in local time. Hand-rolled to avoid pulling chrono.
pub(super) fn filename_prefix() -> String {
    let (y, mo, d, h, mi, _) = local_now_parts();
    format!("{:04}-{:02}-{:02}-{:02}{:02}", y, mo, d, h, mi)
}

/// `YYYY-MM-DDTHH:MM:SS+HH:MM` local time, ISO 8601 with offset.
pub fn local_iso8601_now() -> String {
    let (y, mo, d, h, mi, s) = local_now_parts();
    let off_secs = local_offset_seconds();
    let sign = if off_secs >= 0 { '+' } else { '-' };
    let off_abs = off_secs.unsigned_abs();
    let oh = off_abs / 3600;
    let om = (off_abs % 3600) / 60;
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}{}{:02}:{:02}",
        y, mo, d, h, mi, s, sign, oh, om
    )
}

/// (year, month, day, hour, minute, second) — local time.
pub(super) fn local_now_parts() -> (i64, u32, u32, u32, u32, u32) {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let local_secs = secs + local_offset_seconds();
    civil_from_unix(local_secs)
}

pub(super) fn civil_from_unix(secs: i64) -> (i64, u32, u32, u32, u32, u32) {
    // Howard Hinnant's civil-from-days. Same algo as git_history.rs.
    let days = secs.div_euclid(86_400);
    let mut sod = secs.rem_euclid(86_400);
    let h = (sod / 3600) as u32;
    sod %= 3600;
    let m = (sod / 60) as u32;
    let s = (sod % 60) as u32;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let mo_raw = if mp < 10 { mp + 3 } else { mp - 9 };
    let mo = mo_raw as u32;
    let y = if mo <= 2 { y + 1 } else { y };
    (y, mo, d, h, m, s)
}

/// Local UTC offset, in seconds. Best-effort: we ask `localtime_r` via libc.
/// If we can't determine it (e.g. mis-configured zoneinfo), fall back to UTC.
pub(super) fn local_offset_seconds() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    #[cfg(unix)]
    unsafe {
        // Need libc::localtime_r — but tauri brings it in transitively. Use
        // raw FFI to avoid a new top-level dep.
        extern "C" {
            fn localtime_r(time: *const i64, result: *mut Tm) -> *mut Tm;
        }
        #[repr(C)]
        struct Tm {
            tm_sec: i32,
            tm_min: i32,
            tm_hour: i32,
            tm_mday: i32,
            tm_mon: i32,
            tm_year: i32,
            tm_wday: i32,
            tm_yday: i32,
            tm_isdst: i32,
            tm_gmtoff: i64,
            tm_zone: *const i8,
        }
        let t: i64 = secs;
        let mut out: Tm = std::mem::zeroed();
        let r = localtime_r(&t as *const i64, &mut out as *mut Tm);
        if r.is_null() {
            return 0;
        }
        out.tm_gmtoff
    }
    #[cfg(not(unix))]
    {
        let _ = secs;
        // Windows: GetTimeZoneInformation. Skipped for now — the v2.4 capture
        // endpoint is functional with a UTC `captured_at` on Windows; users
        // rarely care that the timestamp is in Z vs. local offset.
        0
    }
}
