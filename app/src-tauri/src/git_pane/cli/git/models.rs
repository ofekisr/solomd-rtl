//! Repository, ref, commit, branch, tag, stash and working-tree wire models.

use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct RepoInfo {
    pub path: PathBuf,
    pub git_dir: PathBuf,
    pub git_version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireAuthor {
    pub name: String,
    pub email: String,
    pub avatar_url: String,
    pub initials: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoState {
    pub detached_head: bool,
    pub merging: bool,
    pub rebasing: bool,
    pub cherry_picking: bool,
    pub reverting: bool,
    pub bisecting: bool,
    pub operation_label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireRemote {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireRepository {
    pub name: String,
    pub path: String,
    pub git_version: String,
    pub current_branch: String,
    pub detached: bool,
    pub head_sha: String,
    pub ahead: u32,
    pub behind: u32,
    pub remote_url: String,
    pub remotes: Vec<WireRemote>,
    pub state: RepoState,
    pub can_undo: bool,
    pub can_redo: bool,
    pub undo_label: Option<String>,
    pub redo_label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitPageInfo {
    pub oldest_sha: Option<String>,
    pub has_more: bool,
    pub total: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireSnapshot {
    pub repository: WireRepository,
    pub commits: Vec<WireCommit>,
    pub page: CommitPageInfo,
    pub branches: Vec<WireBranch>,
    pub tags: Vec<WireTag>,
    pub stashes: Vec<WireStash>,
    pub worktrees: Vec<WireWorktree>,
    pub working_tree: Vec<WireWorkingTreeFile>,
    pub authors: Vec<WireAuthor>,
    pub commit_author: WireAuthor,
}

/// Mirrors `WireRefType` in `shared/git/models.ts` (values are camelCase literals).
/// `Head` is never produced by the parser (kept for wire completeness).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WireRefType {
    #[allow(dead_code)]
    Head,
    LocalBranch,
    RemoteBranch,
    Tag,
    Stash,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireRef {
    #[serde(rename = "type")]
    pub ref_type: WireRefType,
    pub name: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_head: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireCommit {
    pub sha: String,
    pub short_sha: String,
    pub parents: Vec<String>,
    pub subject: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    pub author: WireAuthor,
    pub committer: WireAuthor,
    pub date: String,
    pub refs: Vec<WireRef>,
    pub is_merge: bool,
    pub is_cherry_pick: bool,
    /// Stash base backfilled outside the loaded window (GitKraken-style
    /// anchoring). Excluded from pagination cursors, never from display.
    #[serde(default)]
    pub is_stash_base: bool,
}

/// Mirrors branch/tag/stash/worktree/status wire models in `shared/git/models.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WireBranchKind {
    Local,
    Remote,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireBranch {
    pub id: String,
    pub name: String,
    pub kind: WireBranchKind,
    pub group: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote: Option<String>,
    pub tip_sha: String,
    pub ahead: u32,
    pub behind: u32,
    pub is_current: bool,
    pub is_favorite: bool,
    pub last_activity: String,
    pub lane_color_index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upstream: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireTag {
    pub id: String,
    pub name: String,
    pub sha: String,
    pub message: String,
    pub date: String,
    pub annotated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireStash {
    pub id: String,
    pub index: u32,
    pub message: String,
    pub branch: String,
    pub date: String,
    pub files_changed: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_sha: Option<String>,
    /// Subject of the base commit (`git show -s --format=%s <base>`);
    /// lets the UI explain a floating stash whose base left the loaded window.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_subject: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireWorktree {
    pub id: String,
    pub path: String,
    pub branch: String,
    pub is_main: bool,
    pub is_locked: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WireFileStatus {
    Modified,
    Added,
    Deleted,
    Renamed,
    Copied,
    Untracked,
    Ignored,
    Conflicted,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireWorkingTreeFile {
    pub id: String,
    pub path: String,
    pub file_name: String,
    pub directory: String,
    pub status: WireFileStatus,
    pub staged: bool,
    pub additions: u32,
    pub deletions: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_submodule: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct NumstatEntry {
    pub additions: u32,
    pub deletions: u32,
}
