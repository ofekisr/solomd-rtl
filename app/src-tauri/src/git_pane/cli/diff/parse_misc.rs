//! Blame, file-history, conflict, rebase-log and commit-files parsers.

use crate::git_pane::cli::git::{
    ConflictBlock, FileHistoryEntry, GitError, RebaseCommitEntry, WireBlameLine, WireWorkingTreeFile,
};
use crate::git_pane::cli::refs::parse_numstat;

/// Parses `git blame --line-porcelain` (mirrors `blameParser`).
pub fn parse_blame_porcelain(stdout: &str) -> Vec<WireBlameLine> {
    let mut lines = Vec::new();
    let raw_lines: Vec<&str> = stdout.split('\n').collect();
    let mut i = 0;
    while i < raw_lines.len() {
        let header = raw_lines[i];
        if header.is_empty() {
            i += 1;
            continue;
        }
        let Some((sha, line_number)) = parse_blame_header(header) else {
            i += 1;
            continue;
        };
        i += 1;

        let (mut author, mut author_email, mut author_time, mut summary, mut content) =
            (String::new(), String::new(), 0i64, None, String::new());
        while i < raw_lines.len() {
            let line = raw_lines[i];
            if let Some(rest) = line.strip_prefix('\t') {
                content = rest.to_string();
                i += 1;
                break;
            }
            if let Some(rest) = line.strip_prefix("author ") {
                author = rest.to_string();
            } else if let Some(rest) = line.strip_prefix("author-mail ") {
                author_email = rest.to_string();
            } else if let Some(rest) = line.strip_prefix("author-time ") {
                author_time = rest.trim().parse().unwrap_or(0);
            } else if let Some(rest) = line.strip_prefix("summary ") {
                summary = Some(rest.to_string());
            }
            i += 1;
        }
        lines.push(WireBlameLine {
            line_number,
            short_sha: sha.chars().take(7).collect(),
            commit_sha: sha,
            author,
            author_email,
            author_time,
            summary,
            content,
        });
    }
    lines
}

/// `^?<sha4..40> <orig> <final> [group]` — mirrors the TS header regex.
fn parse_blame_header(header: &str) -> Option<(String, u32)> {
    let header = header.strip_prefix('^').unwrap_or(header);
    let mut parts = header.split_whitespace();
    let sha = parts.next()?;
    if !(4..=40).contains(&sha.len()) || !sha.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    parts.next()?;
    let line_number: u32 = parts.next()?.parse().ok()?;
    Some((sha.to_string(), line_number))
}

/// Parses `git log --follow` file history (mirrors `fileHistoryParser`).
pub fn parse_file_history(stdout: &str) -> Vec<FileHistoryEntry> {
    let mut entries = Vec::new();
    for line in stdout.split('\n') {
        if line.is_empty() {
            continue;
        }
        let cleaned = line.strip_suffix('\r').unwrap_or(line);
        let mut fields = cleaned.split('\x1f');
        let (sha, subject, author, at) = (
            fields.next().unwrap_or(""),
            fields.next(),
            fields.next(),
            fields.next(),
        );
        if sha.is_empty() {
            continue;
        }
        let Ok(timestamp) = at.unwrap_or("").parse::<i64>() else {
            continue;
        };
        entries.push(FileHistoryEntry {
            sha: sha.to_string(),
            short_sha: sha.chars().take(7).collect(),
            subject: subject.unwrap_or("").to_string(),
            author: author.unwrap_or("").to_string(),
            date: chrono::DateTime::from_timestamp(timestamp, 0)
                .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        });
    }
    entries
}

pub struct ConflictParse {
    pub blocks: Vec<ConflictBlock>,
    pub has_markers: bool,
}

/// Replace one conflict block with the chosen side (mirrors
/// `applyConflictResolution` in `conflictParser.ts`).
pub fn apply_conflict_resolution(
    content: &str,
    block_index: usize,
    side: &str,
) -> Result<String, GitError> {
    use crate::git_pane::cli::git::GitError;
    let parsed = parse_conflict_markers(content);
    let block = parsed
        .blocks
        .get(block_index)
        .ok_or_else(|| GitError::unknown(format!("Conflict block {block_index} not found")))?;
    let replacement = if side == "theirs" {
        &block.theirs
    } else {
        &block.ours
    };
    let lines: Vec<&str> = content.split('\n').collect();
    let mut out: Vec<&str> = Vec::new();
    out.extend_from_slice(&lines[..block.start_line as usize - 1]);
    let new_lines: Vec<&str> = replacement.split('\n').collect();
    out.extend(new_lines);
    out.extend_from_slice(&lines[block.end_line as usize..]);
    Ok(out.join("\n"))
}

/// Parses merge-conflict markers incl. `|||||||` base (mirrors `conflictParser`).
pub fn parse_conflict_markers(content: &str) -> ConflictParse {
    let lines: Vec<&str> = content
        .split('\n')
        .map(|l| l.strip_suffix('\r').unwrap_or(l))
        .collect();
    let mut blocks = Vec::new();
    let mut saw_marker = false;
    let mut i = 0;
    while i < lines.len() {
        let Some(rest) = lines[i].strip_prefix("<<<<<<< ") else {
            i += 1;
            continue;
        };
        if rest.is_empty() {
            i += 1;
            continue;
        }
        let start_line = (i + 1) as u32;
        let ours_label = rest.trim().to_string();
        saw_marker = true;
        i += 1;
        let mut ours_lines: Vec<&str> = Vec::new();
        let mut base: Option<String> = None;
        while i < lines.len() && !lines[i].starts_with("=======") {
            // TS requires a label after `|||||||`; a bare marker is content.
            if let Some(base_rest) = lines[i].strip_prefix("||||||| ") {
                if base_rest.is_empty() {
                    ours_lines.push(lines[i]);
                    i += 1;
                    continue;
                }
                i += 1;
                let mut base_lines: Vec<&str> = Vec::new();
                while i < lines.len() && !lines[i].starts_with("=======") {
                    base_lines.push(lines[i]);
                    i += 1;
                }
                base = Some(base_lines.join("\n"));
                break;
            }
            ours_lines.push(lines[i]);
            i += 1;
        }
        if i >= lines.len() || !lines[i].starts_with("=======") {
            break;
        }
        i += 1;
        let mut theirs_lines: Vec<&str> = Vec::new();
        while i < lines.len() && !lines[i].starts_with(">>>>>>>") {
            theirs_lines.push(lines[i]);
            i += 1;
        }
        let end_label = lines.get(i).and_then(|l| l.strip_prefix(">>>>>>> "));
        let Some(end_label) = end_label else { break };
        if end_label.is_empty() {
            break;
        }
        blocks.push(ConflictBlock {
            index: blocks.len() as u32,
            ours_label,
            theirs_label: end_label.trim().to_string(),
            ours: ours_lines.join("\n"),
            theirs: theirs_lines.join("\n"),
            base,
            start_line,
            end_line: (i + 1) as u32,
        });
        i += 1;
    }
    ConflictParse {
        blocks,
        has_markers: saw_marker,
    }
}

/// Parses the rebase todo log (mirrors `rebaseCommitsParser`).
pub fn parse_rebase_commits(stdout: &str) -> Vec<RebaseCommitEntry> {
    let mut commits = Vec::new();
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return commits;
    }
    for record in trimmed.split('\x1e') {
        let line = record.trim_matches(|c| c == '\r' || c == '\n');
        if line.is_empty() {
            continue;
        }
        let mut fields = line.split('\x1f');
        let (sha, short_sha, subject, author_name, at) = (
            fields.next().unwrap_or(""),
            fields.next().unwrap_or(""),
            fields.next(),
            fields.next(),
            fields.next(),
        );
        if sha.is_empty() || short_sha.is_empty() || subject.is_none() {
            continue;
        }
        let timestamp: i64 = at.unwrap_or("").parse().unwrap_or(0);
        // TS falls back to epoch only when the timestamp is not finite;
        // a missing/unparsable timestamp parses as NaN → epoch. Same here.
        let date = chrono::DateTime::from_timestamp(timestamp, 0)
            .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string());
        commits.push(RebaseCommitEntry {
            sha: sha.to_string(),
            short_sha: short_sha.to_string(),
            subject: subject.unwrap_or("").to_string(),
            author_name: author_name.unwrap_or("").to_string(),
            date,
        });
    }
    commits
}

/// Parses `git diff-tree --name-status -z` into commit file rows.
pub fn parse_commit_files(
    name_status_stdout: &str,
    numstat_stdout: &str,
) -> Vec<WireWorkingTreeFile> {
    use crate::git_pane::cli::git::WireFileStatus;
    use crate::git_pane::cli::refs::map_code;
    let numstat = parse_numstat(numstat_stdout);
    let mut files = Vec::new();
    let mut id: u32 = 0;
    let tokens: Vec<&str> = name_status_stdout
        .split('\0')
        .filter(|t| !t.is_empty())
        .collect();
    let mut i = 0;
    while i < tokens.len() {
        let status_token = tokens[i];
        i += 1;
        let status = map_code(status_token.chars().next().unwrap_or('M'));
        let (path, old_path) =
            if status == WireFileStatus::Renamed || status == WireFileStatus::Copied {
                let old = tokens.get(i).copied().unwrap_or("");
                i += 1;
                let new = tokens.get(i).copied().unwrap_or(old);
                i += 1;
                (
                    new.to_string(),
                    if old.is_empty() {
                        None
                    } else {
                        Some(old.to_string())
                    },
                )
            } else {
                let p = tokens.get(i).copied().unwrap_or("");
                i += 1;
                (p.to_string(), None)
            };
        if path.is_empty() {
            continue;
        }
        let (file_name, directory) = match path.rfind('/') {
            None => (path.clone(), String::new()),
            Some(idx) => (path[idx + 1..].to_string(), path[..idx].to_string()),
        };
        let (additions, deletions) = numstat
            .get(&path)
            .map(|c| (c.additions, c.deletions))
            .unwrap_or((0, 0));
        if let Some(existing) = files
            .iter_mut()
            .find(|f: &&mut WireWorkingTreeFile| f.path == path)
        {
            existing.additions = existing.additions.max(additions);
            existing.deletions = existing.deletions.max(deletions);
            if existing.old_path.is_none() {
                existing.old_path = old_path;
            }
            continue;
        }
        files.push(WireWorkingTreeFile {
            id: format!("commit-{id}"),
            path,
            file_name,
            directory,
            status,
            staged: false,
            additions,
            deletions,
            old_path,
            is_submodule: None,
        });
        id += 1;
    }
    files
}
