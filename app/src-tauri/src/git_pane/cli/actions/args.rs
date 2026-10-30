// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;

pub(super) const CHECKOUT_END_OF_PATHS: &str = "--";
pub(super) const GLOB_SPECIALS: [char; 5] = ['[', ']', '*', '?', '\\'];

pub(super) fn checkout_base(is_forced: bool) -> Vec<String> {
    let mut base = vec!["checkout".to_string()];
    if is_forced {
        base.push("-f".to_string());
    }
    base
}

pub(super) fn checkout_args(base: &[String], rest: &[&str]) -> Vec<String> {
    let mut argv = base.to_vec();
    argv.extend(rest.iter().map(|arg| arg.to_string()));
    argv.push(CHECKOUT_END_OF_PATHS.to_string());
    argv
}

pub(crate) fn escape_glob(path: &str) -> String {
    path.chars().fold(String::with_capacity(path.len()), |mut out, c| {
        if GLOB_SPECIALS.contains(&c) {
            out.push('\\');
        }
        out.push(c);
        out
    })
}

pub(super) fn meta_str<'a>(meta: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    meta.get(key)?.as_str()
}

pub(super) fn meta_bool(meta: &serde_json::Value, key: &str) -> bool {
    meta.get(key).and_then(|v| v.as_bool()).unwrap_or(false)
}

pub(super) fn s_arg(value: &str) -> String {
    value.to_string()
}

/// Cap for captured git output (stdout/stderr each). Prevents a huge
/// `git log/diff/status` from ballooning renderer memory.
pub const MAX_OUTPUT_BYTES: usize = 8 * 1024 * 1024;

pub(super) fn truncate_output(mut buf: Vec<u8>) -> Vec<u8> {
    if buf.len() > MAX_OUTPUT_BYTES {
        buf.truncate(MAX_OUTPUT_BYTES);
    }
    buf
}

/// Reject values that could be parsed as CLI flags or inject new argv
/// entries (e.g. a branch named `-h` or a ref containing a newline).
pub(super) fn reject_option_like(value: &str, what: &str) -> Result<(), GitError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(GitError::unknown(format!("{what} is required.")));
    }
    if trimmed.starts_with('-') || trimmed.contains(['\0', '\n', '\r']) {
        return Err(GitError::unknown(format!("Invalid {what}.")));
    }
    Ok(())
}

pub(super) fn checked_target<'a>(target: Option<&'a str>, what: &str) -> Result<&'a str, GitError> {
    let value = target
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| GitError::unknown(format!("{what} is required.")))?;
    reject_option_like(value, what)?;
    Ok(value)
}

pub(super) fn checked_meta<'a>(
    meta: &'a serde_json::Value,
    key: &str,
    what: &str,
) -> Result<&'a str, GitError> {
    let value = meta
        .get(key)
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| GitError::unknown(format!("{what} is required.")))?;
    reject_option_like(value, what)?;
    Ok(value)
}

/// A rev spec is valid when it is short, has no whitespace/control chars,
/// and does not look like a CLI flag. Git itself is the final validator.
pub(crate) fn checked_rev(value: &str, what: &str) -> Result<String, GitError> {
    let trimmed = value.trim();
    reject_option_like(trimmed, what)?;
    if trimmed.len() > 256 || trimmed.contains(char::is_whitespace) || trimmed.contains('\0') {
        return Err(GitError::unknown(format!("Invalid {what}.")));
    }
    Ok(trimmed.to_string())
}

/// Single-line text for the rebase todo file: newlines would inject extra
/// todo entries, so collapse them to spaces.
pub(super) fn todo_line(action: &str, sha: &str, subject: &str) -> String {
    let clean = |s: &str| s.replace(['\r', '\n'], " ");
    format!("{} {} {}\n", clean(action), clean(sha), clean(subject))
}
