//! Worktree, numstat, status and repo-state parsers.

use std::collections::HashMap;
use std::path::Path;

use crate::git_pane::cli::git::{
    NumstatEntry, RepoState, WireFileStatus, WireWorkingTreeFile, WireWorktree,
};

fn unquote_path(p: &str) -> String {
    if p.len() >= 2 && p.starts_with('"') && p.ends_with('"') {
        let inner = &p[1..p.len() - 1];
        let mut out = String::new();
        let mut chars = inner.chars();
        while let Some(c) = chars.next() {
            if c != '\\' {
                out.push(c);
                continue;
            }
            match chars.next() {
                Some('n') => out.push('\n'),
                Some('r') => out.push('\r'),
                Some('t') => out.push('\t'),
                Some('"') => out.push('"'),
                Some('\\') => out.push('\\'),
                Some(d @ '0'..='7') => {
                    let mut oct = String::from(d);
                    oct.push(chars.next().unwrap_or('0'));
                    oct.push(chars.next().unwrap_or('0'));
                    let code = u8::from_str_radix(&oct, 8).unwrap_or(b'?');
                    out.push(code as char);
                }
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => out.push('\\'),
            }
        }
        out
    } else {
        p.to_string()
    }
}

fn normalize_path(p: &str) -> String {
    p.trim_end_matches('/').to_string()
}

pub fn parse_worktrees(stdout: &str, main_path: &str) -> Vec<WireWorktree> {
    let mut worktrees = Vec::new();
    let mut id: u32 = 0;
    for block in stdout.split("\n\n") {
        if block.trim().is_empty() {
            // TS splits on `/\n\n+/` (2+ newlines); a lone extra newline still
            // separates, so skip whitespace-only blocks the same way.
            continue;
        }
        let mut path = String::new();
        let mut branch = String::new();
        let mut detached = false;
        let mut locked = false;
        let mut bare = false;
        for line_raw in block.split('\n') {
            let line = line_raw.strip_suffix('\r').unwrap_or(line_raw);
            let trimmed = line.trim();
            if let Some(rest) = line.strip_prefix("worktree ") {
                path = unquote_path(rest);
            } else if let Some(rest) = line.strip_prefix("branch ") {
                branch = rest.replace("refs/heads/", "");
            } else if trimmed == "detached" {
                detached = true;
            } else if trimmed.starts_with("locked") {
                locked = true;
            } else if trimmed == "bare" {
                bare = true;
            }
        }
        if path.is_empty() {
            continue;
        }
        worktrees.push(WireWorktree {
            id: format!("wt:{id}"),
            is_main: normalize_path(&path) == normalize_path(main_path),
            path,
            branch: if detached {
                "detached HEAD".to_string()
            } else if branch.is_empty() {
                if bare {
                    "bare".to_string()
                } else {
                    String::new()
                }
            } else {
                branch
            },
            is_locked: locked,
        });
        id += 1;
    }
    worktrees
}

pub fn parse_numstat(stdout: &str) -> HashMap<String, NumstatEntry> {
    let mut map = HashMap::new();
    // `-z` numstat: "<add>\t<del>\t" then NUL-terminated path. Renames emit
    // two extra NUL tokens (old, new) in place of the inline path.
    let tokens: Vec<&str> = stdout.split('\0').collect();
    let mut i = 0;
    while i < tokens.len() {
        let head = tokens[i];
        if head.is_empty() || !head.contains('\t') {
            i += 1;
            continue;
        }
        let mut parts = head.split('\t');
        let (add_raw, del_raw, inline_path) = (
            parts.next().unwrap_or(""),
            parts.next().unwrap_or(""),
            parts.next(),
        );
        // `-` counts (e.g. binary files) fold to 0, mirroring the TS parser.
        let additions = if add_raw == "-" {
            0
        } else {
            add_raw.parse().unwrap_or(0)
        };
        let deletions = if del_raw == "-" {
            0
        } else {
            del_raw.parse().unwrap_or(0)
        };
        let path = match inline_path {
            Some(p) if !p.is_empty() => {
                i += 1;
                p.to_string()
            }
            _ => {
                // Rename: next two tokens are old then new path (mirrors TS indexing).
                i += 1; // consume old path token (tokens[i])
                let new_path = tokens.get(i + 1).copied().unwrap_or("");
                let path = new_path.to_string();
                i += 2;
                path
            }
        };
        if !path.is_empty() {
            map.insert(
                path,
                NumstatEntry {
                    additions,
                    deletions,
                },
            );
        }
    }
    map
}

pub fn map_code(code: char) -> WireFileStatus {
    match code {
        'A' => WireFileStatus::Added,
        'D' => WireFileStatus::Deleted,
        'R' => WireFileStatus::Renamed,
        'C' => WireFileStatus::Copied,
        'U' => WireFileStatus::Conflicted,
        _ => WireFileStatus::Modified, // 'M', 'T' and anything else
    }
}

fn split_file_path(full: &str) -> (String, String) {
    match full.rfind('/') {
        None => (full.to_string(), String::new()),
        Some(idx) => (full[idx + 1..].to_string(), full[..idx].to_string()),
    }
}

pub struct StatusInput<'a> {
    pub porcelain: &'a str,
    pub staged: &'a HashMap<String, NumstatEntry>,
    pub unstaged: &'a HashMap<String, NumstatEntry>,
}

pub fn parse_status(input: StatusInput) -> Vec<WireWorkingTreeFile> {
    let mut files = Vec::new();
    let mut id: u32 = 0;
    let mut push = |path: String,
                    status: WireFileStatus,
                    staged: bool,
                    counts: Option<&NumstatEntry>,
                    old_path: Option<String>,
                    is_submodule: bool| {
        let (file_name, directory) = split_file_path(&path);
        files.push(WireWorkingTreeFile {
            id: format!("file:{id}"),
            path,
            file_name,
            directory,
            status,
            staged,
            additions: counts.map(|c| c.additions).unwrap_or(0),
            deletions: counts.map(|c| c.deletions).unwrap_or(0),
            old_path,
            is_submodule: Some(is_submodule),
        });
        id += 1;
    };

    let tokens: Vec<&str> = input.porcelain.split('\0').collect();
    let mut i = 0;
    while i < tokens.len() {
        let line = tokens[i];
        if line.is_empty() {
            i += 1;
            continue;
        }
        let kind = line.chars().next().unwrap();
        if kind == '1' {
            // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
            let parts: Vec<&str> = line.split(' ').collect();
            let xy = parts.get(1).copied().unwrap_or("..");
            let sub = parts.get(2).copied().unwrap_or("....");
            let path = parts.get(8..).map(|p| p.join(" ")).unwrap_or_default();
            let is_submodule = sub.starts_with('S');
            let mut chars = xy.chars();
            let (x, y) = (chars.next().unwrap_or('.'), chars.next().unwrap_or('.'));
            if x != '.' {
                push(
                    path.clone(),
                    map_code(x),
                    true,
                    input.staged.get(&path),
                    None,
                    is_submodule,
                );
            }
            if y != '.' {
                let counts = input.unstaged.get(&path);
                push(path, map_code(y), false, counts, None, is_submodule);
            }
        } else if kind == '2' {
            // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <Xscore> <path> then NUL <origPath>
            let parts: Vec<&str> = line.split(' ').collect();
            let xy = parts.get(1).copied().unwrap_or("..");
            let sub = parts.get(2).copied().unwrap_or("....");
            let path = parts.get(9..).map(|p| p.join(" ")).unwrap_or_default();
            let orig_path = tokens.get(i + 1).map(|s| s.to_string());
            i += 1; // consume origPath token
            let is_submodule = sub.starts_with('S');
            let mut chars = xy.chars();
            let (x, y) = (chars.next().unwrap_or('.'), chars.next().unwrap_or('.'));
            if x != '.' {
                push(
                    path.clone(),
                    map_code(x),
                    true,
                    input.staged.get(&path),
                    orig_path.clone(),
                    is_submodule,
                );
            }
            if y != '.' {
                let counts = input.unstaged.get(&path);
                push(path, map_code(y), false, counts, orig_path, is_submodule);
            }
        } else if kind == 'u' {
            // u <xy> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
            let parts: Vec<&str> = line.split(' ').collect();
            let path = parts.get(10..).map(|p| p.join(" ")).unwrap_or_default();
            push(path, WireFileStatus::Conflicted, false, None, None, false);
        } else if kind == '?' {
            // TS `line.slice(2)` skips the marker and the space.
            let path = line.get(2..).unwrap_or("").to_string();
            push(
                path.clone(),
                WireFileStatus::Untracked,
                false,
                input.unstaged.get(&path),
                None,
                false,
            );
        } else if kind == '!' {
            let path = line.get(2..).unwrap_or("").to_string();
            push(path, WireFileStatus::Ignored, false, None, None, false);
        }
        i += 1;
    }
    files
}

/// Derives in-progress operation state from the `.git` dir (mirrors `stateParser`).
pub fn read_repo_state(git_dir: &Path) -> RepoState {
    let exists = |name: &str| git_dir.join(name).exists();
    let read_trimmed = |parts: &[&str]| -> Option<String> {
        let mut p = git_dir.to_path_buf();
        for part in parts {
            p = p.join(part);
        }
        std::fs::read_to_string(p)
            .ok()
            .map(|s| s.trim().to_string())
    };
    let merging = exists("MERGE_HEAD");
    let cherry_picking = exists("CHERRY_PICK_HEAD");
    let reverting = exists("REVERT_HEAD");
    let bisecting = exists("BISECT_LOG");
    let rebase_merge = exists("rebase-merge");
    let rebase_apply = exists("rebase-apply");
    let rebasing = rebase_merge || rebase_apply;

    let head = read_trimmed(&["HEAD"]);
    let detached_head = head
        .as_ref()
        .map(|h| !h.starts_with("ref:"))
        .unwrap_or(false);

    let operation_label = if rebasing {
        let dir = if rebase_merge {
            "rebase-merge"
        } else {
            "rebase-apply"
        };
        let (num_key, end_key) = if rebase_merge {
            ("msgnum", "end")
        } else {
            ("next", "last")
        };
        match (read_trimmed(&[dir, num_key]), read_trimmed(&[dir, end_key])) {
            (Some(msgnum), Some(end)) if !msgnum.is_empty() && !end.is_empty() => {
                Some(format!("REBASING ({msgnum}/{end})"))
            }
            _ => Some("REBASING".to_string()),
        }
    } else if merging {
        Some("MERGING".to_string())
    } else if cherry_picking {
        Some("CHERRY-PICKING".to_string())
    } else if reverting {
        Some("REVERTING".to_string())
    } else if bisecting {
        Some("BISECTING".to_string())
    } else if detached_head {
        Some("DETACHED HEAD".to_string())
    } else {
        None
    };

    RepoState {
        detached_head,
        merging,
        rebasing,
        cherry_picking,
        reverting,
        bisecting,
        operation_label,
    }
}
