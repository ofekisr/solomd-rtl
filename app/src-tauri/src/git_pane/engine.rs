use super::cli::actions::{self, ActionEnvelope, Journal, Operations};
use super::cli::diff::{self, DiffFetch};
use super::cli::git::{
    self, CommitPageInfo, DiffResult, GitError, RepoInfo, SnapshotOptions, WireCommit,
    WireSnapshot, WireWorkingTreeFile,
};
use super::cli::log;
use std::collections::HashSet;
use std::path::Path;

pub struct LogPage {
    pub commits: Vec<WireCommit>,
    pub page: CommitPageInfo,
}

pub type ProgressFn = dyn Fn(&str, Option<u32>, bool) + Send + Sync;

#[allow(async_fn_in_trait)]
pub trait GitEngine {
    fn root(&self) -> &Path;
    async fn snapshot(&self, opts: &SnapshotOptions) -> Result<WireSnapshot, GitError>;
    async fn log_page(
        &self,
        before_sha: &str,
        limit: usize,
        all: bool,
        skip: u32,
    ) -> Result<LogPage, GitError>;
    async fn diff(&self, req: &DiffFetch) -> Result<DiffResult, GitError>;
    async fn commit_files(&self, sha: &str) -> Result<Vec<WireWorkingTreeFile>, GitError>;
    async fn execute(
        &self,
        op_id: &str,
        kind: &str,
        target: Option<&str>,
        meta: &serde_json::Value,
        emit: &ProgressFn,
    ) -> ActionEnvelope;
    async fn cancel(&self);
}

pub struct CliEngine {
    info: RepoInfo,
    journal: tokio::sync::Mutex<Journal>,
    operations: tokio::sync::Mutex<Operations>,
}

impl CliEngine {
    pub async fn open(folder: &Path) -> Result<Self, GitError> {
        let root = super::lock::find_repo_root(folder).ok_or_else(|| {
            GitError::new(
                "RepositoryNotFound",
                "The folder is not inside a git repository.".to_string(),
            )
        })?;
        let info = git::validate_repo(&root).await?;
        Ok(Self {
            info,
            journal: tokio::sync::Mutex::new(Journal::default()),
            operations: tokio::sync::Mutex::new(Operations::default()),
        })
    }

    pub fn git_dir(&self) -> &Path {
        &self.info.git_dir
    }
}

impl GitEngine for CliEngine {
    fn root(&self) -> &Path {
        &self.info.path
    }

    async fn snapshot(&self, opts: &SnapshotOptions) -> Result<WireSnapshot, GitError> {
        git::build_snapshot_with_info(&self.info, opts, &HashSet::new()).await
    }

    async fn log_page(
        &self,
        before_sha: &str,
        limit: usize,
        all: bool,
        skip: u32,
    ) -> Result<LogPage, GitError> {
        let end_rev = format!("{before_sha}^");
        let (end, skip) = if all { (None, skip) } else { (Some(end_rev.as_str()), 0) };
        let bundle = log::fetch_commit_log(&self.info.path, limit, all, end, skip).await?;
        Ok(LogPage {
            commits: bundle.commits,
            page: CommitPageInfo {
                oldest_sha: bundle.oldest_sha,
                has_more: bundle.has_more,
                total: None,
            },
        })
    }

    async fn diff(&self, req: &DiffFetch) -> Result<DiffResult, GitError> {
        diff::fetch_diff(&self.info.path, req).await
    }

    async fn commit_files(&self, sha: &str) -> Result<Vec<WireWorkingTreeFile>, GitError> {
        diff::fetch_commit_files(&self.info.path, sha).await
    }

    async fn execute(
        &self,
        op_id: &str,
        kind: &str,
        target: Option<&str>,
        meta: &serde_json::Value,
        emit: &ProgressFn,
    ) -> ActionEnvelope {
        let _guard = super::lock::RepoLocks::global().acquire(&self.info.path).await;
        actions::execute_action(
            op_id,
            &self.info.path,
            &self.info.git_dir,
            kind,
            target,
            meta,
            &self.journal,
            &self.operations,
            emit,
        )
        .await
    }

    async fn cancel(&self) {
        self.operations.lock().await.cancel_all();
    }
}
