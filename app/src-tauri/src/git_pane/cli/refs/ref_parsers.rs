//! Branch, tag, remote and stash list parsers.

use std::collections::{HashMap, HashSet};

use crate::git_pane::cli::git::{WireBranch, WireBranchKind, WireRemote, WireStash, WireTag};

use super::*;

fn parse_ahead_behind(track: &str, keyword: &str) -> u32 {
    let mut rest = track;
    while let Some(idx) = rest.find(keyword) {
        let after = rest[idx + keyword.len()..].trim_start();
        let digits: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(n) = digits.parse::<u32>() {
            return n;
        }
        rest = after;
    }
    0
}

pub fn parse_track(track: &str) -> (u32, u32) {
    (
        parse_ahead_behind(track, "ahead "),
        parse_ahead_behind(track, "behind "),
    )
}

pub fn parse_branches(stdout: &str, favorites: &HashSet<String>) -> Vec<WireBranch> {
    let mut branches = Vec::new();
    for line_raw in stdout.split('\n') {
        let line = line_raw.trim_end_matches(['\r', '\n']);
        if line.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = line.split(FIELD).collect();
        let get = |i: usize| fields.get(i).copied().unwrap_or("");
        let (refname, sha, head, upstream, track, date) =
            (get(0), get(1), get(2), get(3), get(4), get(5));

        if let Some(name) = refname.strip_prefix("refs/heads/") {
            let name = name.to_string();
            let (ahead, behind) = parse_track(track);
            let gone = track.contains("[gone]");
            branches.push(WireBranch {
                id: format!("local:{name}"),
                group: group_for(&name),
                tip_sha: sha.to_string(),
                is_current: head == "*",
                is_favorite: favorites.contains(&name),
                last_activity: if date.is_empty() {
                    epoch_iso()
                } else {
                    parse_git_date(date)
                },
                lane_color_index: lane_color_index_for(&name),
                upstream: if gone { None } else { none_if_empty(upstream) },
                name,
                kind: WireBranchKind::Local,
                remote: None,
                ahead,
                behind,
            });
        } else if let Some(rest) = refname.strip_prefix("refs/remotes/") {
            if rest == "HEAD" || rest.ends_with("/HEAD") {
                continue;
            }
            let (remote, name) = match rest.find('/') {
                Some(idx) => (rest[..idx].to_string(), rest[idx + 1..].to_string()),
                None => (rest.to_string(), rest.to_string()),
            };
            branches.push(WireBranch {
                id: format!("remote:{rest}"),
                group: group_for(&name),
                tip_sha: sha.to_string(),
                last_activity: if date.is_empty() {
                    epoch_iso()
                } else {
                    parse_git_date(date)
                },
                lane_color_index: lane_color_index_for(&name),
                name,
                kind: WireBranchKind::Remote,
                remote: Some(remote),
                ahead: 0,
                behind: 0,
                is_current: false,
                is_favorite: false,
                upstream: None,
            });
        }
    }
    branches
}

fn none_if_empty(s: &str) -> Option<String> {
    if s.is_empty() {
        None
    } else {
        Some(s.to_string())
    }
}

pub fn parse_tags(stdout: &str) -> Vec<WireTag> {
    let mut tags = Vec::new();
    for line_raw in stdout.split('\n') {
        let line = line_raw.trim_end_matches(['\r', '\n']);
        if line.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = line.split(FIELD).collect();
        let get = |i: usize| fields.get(i).copied().unwrap_or("");
        let (name, object_name, deref_name, object_type, date, subject) =
            (get(0), get(1), get(2), get(3), get(4), get(5));
        let annotated = object_type == "tag";
        tags.push(WireTag {
            id: format!("tag:{name}"),
            name: name.to_string(),
            sha: if annotated && !deref_name.is_empty() {
                deref_name.to_string()
            } else {
                object_name.to_string()
            },
            message: subject.to_string(),
            date: if date.is_empty() {
                epoch_iso()
            } else {
                parse_git_date(date)
            },
            annotated,
        });
    }
    tags
}

pub fn parse_remotes(stdout: &str) -> Vec<WireRemote> {
    let mut order: Vec<String> = Vec::new();
    let mut map: HashMap<String, WireRemote> = HashMap::new();
    for line_raw in stdout.split('\n') {
        let line = line_raw.trim();
        if line.is_empty() {
            continue;
        }
        let (kind, rest) = if let Some(rest) = line.strip_suffix("(fetch)") {
            ("fetch", rest)
        } else if let Some(rest) = line.strip_suffix("(push)") {
            ("push", rest)
        } else {
            continue;
        };
        let mut parts = rest.split_whitespace();
        let (Some(name), Some(url)) = (parts.next(), parts.next()) else {
            continue;
        };
        let entry = map.entry(name.to_string()).or_insert_with(|| {
            order.push(name.to_string());
            WireRemote {
                name: name.to_string(),
                fetch_url: String::new(),
                push_url: String::new(),
            }
        });
        if kind == "fetch" {
            entry.fetch_url = url.to_string();
        } else {
            entry.push_url = url.to_string();
        }
    }
    order.into_iter().filter_map(|n| map.remove(&n)).collect()
}

pub fn parse_stashes(stdout: &str) -> Vec<WireStash> {
    let mut stashes = Vec::new();
    let mut index: u32 = 0;
    for line_raw in stdout.split('\n') {
        let line = line_raw.trim_end_matches(['\r', '\n']);
        if line.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = line.split(FIELD).collect();
        let get = |i: usize| fields.get(i).copied().unwrap_or("");
        let (selector, ts, subject) = (get(0), get(1), get(2));
        // `%gs` looks like "WIP on main: 1a2b3c message" or "On main: message".
        let branch = extract_stash_branch(subject);
        let date = ts
            .trim()
            .parse::<i64>()
            .ok()
            .and_then(|t| chrono::DateTime::from_timestamp(t, 0))
            .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .unwrap_or_else(epoch_iso);
        stashes.push(WireStash {
            id: if selector.is_empty() {
                format!("stash@{{{index}}}")
            } else {
                selector.to_string()
            },
            index,
            message: subject.to_string(),
            branch,
            date,
            files_changed: 0,
            base_sha: None,
            base_subject: None,
        });
        index += 1;
    }
    stashes
}

fn extract_stash_branch(subject: &str) -> String {
    for marker in ["WIP on", "On"] {
        if let Some(rest) = subject.split_once(marker) {
            // TS `/(?:WIP on|On)\s+([^:]+):/` requires whitespace after the marker.
            let Some(after) = rest.1.strip_prefix(|c| c == ' ' || c == '\t') else {
                continue;
            };
            if let Some(colon) = after.find(':') {
                return after[..colon].trim().to_string();
            }
        }
    }
    String::new()
}
