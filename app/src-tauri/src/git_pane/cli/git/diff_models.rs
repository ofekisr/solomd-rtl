//! Diff/blame/history/conflict/search/rebase wire models.

use serde::Serialize;

/// Diff/blame/history/conflict/search wire models (`shared/git/models.ts`, `shared/git/rebase.ts`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DiffLineType {
    Context,
    Add,
    Del,
    #[allow(dead_code)]
    Hunk,
    Meta,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    #[serde(rename = "type")]
    pub line_type: DiffLineType,
    pub content: String,
    pub old_line: Option<u32>,
    pub new_line: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
    pub binary: bool,
    pub too_large: bool,
    pub language: String,
    pub hunks: Vec<DiffHunk>,
    pub additions: u32,
    pub deletions: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireBlameLine {
    pub line_number: u32,
    pub commit_sha: String,
    pub short_sha: String,
    pub author: String,
    pub author_email: String,
    pub author_time: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlameResult {
    pub path: String,
    pub language: String,
    pub lines: Vec<WireBlameLine>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHistoryEntry {
    pub sha: String,
    pub short_sha: String,
    pub subject: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHistoryResult {
    pub path: String,
    pub entries: Vec<FileHistoryEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictBlock {
    pub index: u32,
    pub ours_label: String,
    pub theirs_label: String,
    pub ours: String,
    pub theirs: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base: Option<String>,
    pub start_line: u32,
    pub end_line: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictVersions {
    pub base: Option<String>,
    pub ours: Option<String>,
    pub theirs: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictResult {
    pub path: String,
    pub binary: bool,
    pub has_markers: bool,
    pub blocks: Vec<ConflictBlock>,
    pub versions: ConflictVersions,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchCommitHit {
    pub sha: String,
    pub short_sha: String,
    pub subject: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResults {
    pub commits: Vec<SearchCommitHit>,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseCommitEntry {
    pub sha: String,
    pub short_sha: String,
    pub subject: String,
    pub author_name: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseCommitsResult {
    pub base: String,
    pub base_short_sha: String,
    pub commits: Vec<RebaseCommitEntry>,
}
