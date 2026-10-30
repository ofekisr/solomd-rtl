//! Commit/file search fetcher.

use std::path::Path;

use crate::git_pane::cli::git::{GitError, SearchCommitHit, SearchResults};

pub struct SearchFetch {
    pub text: String,
    pub regex: bool,
    pub limit: usize,
    pub graph_all: bool,
    pub author_field: bool,
}

pub async fn fetch_search(cwd: &Path, req: &SearchFetch) -> Result<SearchResults, GitError> {
    use crate::git_pane::cli::git::git_text;
    let text = req.text.trim();
    if text.is_empty() {
        return Ok(SearchResults {
            commits: Vec::new(),
            files: Vec::new(),
        });
    }
    let limit_str = req.limit.to_string();
    let mut args: Vec<String> = vec![
        "log".to_string(),
        "--format=%H\x1f%s\x1f%an\x1f%at".to_string(),
        "-n".to_string(),
        limit_str,
    ];
    if req.graph_all {
        args.insert(1, "--all".to_string());
    }
    let is_sha = text.len() >= 4 && text.len() <= 40 && text.chars().all(|c| c.is_ascii_hexdigit());
    if is_sha {
        args.push(text.to_string());
    } else if req.regex {
        args.push("--extended-regexp".to_string());
        args.push(format!("--grep={text}"));
    } else {
        args.push(format!("--grep={text}"));
    }
    if req.author_field {
        args.push(format!("--author={text}"));
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (_, stdout, _) = git_text(cwd, &arg_refs).await?;
    let mut commits = Vec::new();
    for line in stdout.split('\n') {
        if line.is_empty() {
            continue;
        }
        let mut fields = line.split('\x1f');
        let (sha, subject, author, at) = (
            fields.next().unwrap_or(""),
            fields.next().unwrap_or(""),
            fields.next().unwrap_or(""),
            fields.next().unwrap_or(""),
        );
        if sha.is_empty() {
            continue;
        }
        let timestamp: i64 = at.parse().unwrap_or(0);
        commits.push(SearchCommitHit {
            sha: sha.to_string(),
            short_sha: sha.chars().take(7).collect(),
            subject: subject.to_string(),
            author: author.to_string(),
            date: chrono::DateTime::from_timestamp(timestamp, 0)
                .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        });
    }
    let files = search_files(cwd, text, req.regex, req.limit).await;
    Ok(SearchResults { commits, files })
}

async fn search_files(cwd: &Path, text: &str, regex: bool, limit: usize) -> Vec<String> {
    use crate::git_pane::cli::git::git_text;
    if regex {
        let (_, stdout, _) = git_text(
            cwd,
            &["grep", "-l", "-E", "--full-name", "-e", text, "HEAD"],
        )
        .await
        .unwrap_or_default();
        return stdout
            .split('\n')
            .filter(|s| !s.is_empty())
            .take(limit)
            .map(str::to_string)
            .collect();
    }
    let from_content = git_text(cwd, &["grep", "-l", "-i", "-F", "-e", text, "HEAD"])
        .await
        .map(|(_, out, _)| out)
        .unwrap_or_default();
    let from_content: Vec<&str> = from_content.split('\n').filter(|s| !s.is_empty()).collect();
    let tracked = git_text(cwd, &["ls-files", "-z"])
        .await
        .map(|(_, out, _)| out)
        .unwrap_or_default();
    let needle = text.to_lowercase();
    let from_paths: Vec<&str> = tracked
        .split('\0')
        .filter(|f| !f.is_empty() && f.to_lowercase().contains(&needle))
        .collect();
    let mut merged: Vec<String> = Vec::new();
    for path in from_paths.into_iter().chain(from_content) {
        if !merged.iter().any(|p| p == path) {
            merged.push(path.to_string());
            if merged.len() >= limit {
                break;
            }
        }
    }
    merged
}
