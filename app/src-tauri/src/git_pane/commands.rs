use super::cli::diff::{DiffFetch, DiffSource};
use super::cli::git::{CommitPageInfo, DiffResult, GitError, SnapshotOptions, WireCommit, WireSnapshot, WireWorkingTreeFile};
use super::cli::actions::ActionEnvelope;
use super::engine::{CliEngine, GitEngine};
use super::watcher::{RepoWatcher, CHANGED_EVENT};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

const DEFAULT_COMMIT_LIMIT: u64 = 200;
const MAX_COMMIT_LIMIT: u64 = 5000;
const DEFAULT_PAGE_LIMIT: usize = 200;
const MAX_PAGE_LIMIT: usize = 1000;
const MAX_SKIP: u32 = 1_000_000;
const MIN_SHA_LEN: usize = 4;
const MAX_SHA_LEN: usize = 64;
const PROGRESS_EVENT: &str = "gitpane:progress";

#[derive(Default)]
pub struct GitPaneState {
    engine: tokio::sync::RwLock<Option<Arc<CliEngine>>>,
    watcher: std::sync::Mutex<Option<RepoWatcher>>,
    open_token: AtomicU64,
}

type Installed = (Arc<CliEngine>, Option<RepoWatcher>);

impl GitPaneState {
    pub(crate) fn begin_open(&self) -> u64 {
        self.open_token.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub(crate) async fn install(&self, token: u64, next: Option<Installed>) -> bool {
        let mut slot = self.engine.write().await;
        if self.open_token.load(Ordering::SeqCst) != token {
            return false;
        }
        let (engine, watcher) = next.map_or((None, None), |(engine, watcher)| (Some(engine), watcher));
        *self.watcher.lock().unwrap_or_else(|e| e.into_inner()) = watcher;
        *slot = engine;
        true
    }

    pub(crate) async fn close(&self) {
        let token = self.begin_open();
        self.install(token, None).await;
    }

    #[cfg(test)]
    pub(crate) async fn current_root(&self) -> Option<std::path::PathBuf> {
        self.engine.read().await.as_ref().map(|engine| engine.root().to_path_buf())
    }
}

fn no_repo() -> GitError {
    GitError::new("RepositoryNotFound", "No repository open.".to_string())
}

async fn current(state: &State<'_, GitPaneState>) -> Result<Arc<CliEngine>, GitError> {
    state.engine.read().await.clone().ok_or_else(no_repo)
}

fn snapshot_options(value: &Option<serde_json::Value>) -> SnapshotOptions {
    let get = |key: &str| value.as_ref().and_then(|v| v.get(key));
    let want = |scope: &str| {
        get("scopes")
            .and_then(|v| v.as_array())
            .map(|scopes| scopes.iter().any(|s| s.as_str() == Some(scope)))
            .unwrap_or(true)
    };
    SnapshotOptions {
        commit_limit: get("commitLimit").and_then(|v| v.as_u64()).unwrap_or(DEFAULT_COMMIT_LIMIT).clamp(1, MAX_COMMIT_LIMIT) as usize,
        graph_all: get("graphScope").and_then(|v| v.as_str()).unwrap_or("all") != "head",
        with_commits: want("commits"),
        with_branches: want("branches"),
        with_tags: want("tags"),
        with_stashes: want("stashes"),
        with_worktrees: want("worktrees"),
        with_status: want("status"),
    }
}

fn is_sha(value: &str) -> bool {
    (MIN_SHA_LEN..=MAX_SHA_LEN).contains(&value.len()) && value.bytes().all(|b| b.is_ascii_hexdigit())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionInfo {
    version: String,
    git_path: Option<String>,
}

#[tauri::command]
pub async fn gitpane_version() -> Result<VersionInfo, GitError> {
    super::env::warm().await;
    let output = super::env::git_command()?
        .arg("--version")
        .stdin(std::process::Stdio::null())
        .output()
        .await
        .map_err(|_| GitError::new("GitNotFound", "git is not installed.".to_string()))?;
    if !output.status.success() {
        return Err(GitError::new("GitNotFound", "git is not installed.".to_string()));
    }
    Ok(VersionInfo {
        version: String::from_utf8_lossy(&output.stdout).trim().to_string(),
        git_path: super::env::global().git_path.as_ref().map(|p| p.to_string_lossy().into_owned()),
    })
}

#[derive(serde::Serialize, Clone)]
struct ChangedPayload {
    path: String,
}

#[derive(serde::Serialize)]
pub struct OpenEnvelope {
    pub(crate) ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    snapshot: Option<WireSnapshot>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<GitError>,
}

impl OpenEnvelope {
    fn failed(error: GitError) -> Self {
        Self { ok: false, snapshot: None, error: Some(error) }
    }
}

fn superseded() -> GitError {
    GitError::new("Cancelled", "A newer repository was opened.".to_string())
}

pub(crate) async fn open_repo(
    state: &GitPaneState,
    path: &str,
    options: &Option<serde_json::Value>,
    is_trusted: bool,
    on_change: impl Fn(&str) + Send + Sync + 'static,
) -> OpenEnvelope {
    let token = state.begin_open();
    super::env::warm().await;
    let result = prepare(path, options, is_trusted, on_change).await;
    match result {
        Ok((engine, watcher, snapshot)) => {
            if state.install(token, Some((engine, watcher))).await {
                OpenEnvelope { ok: true, snapshot: Some(snapshot), error: None }
            } else {
                OpenEnvelope::failed(superseded())
            }
        }
        Err(error) => {
            state.install(token, None).await;
            OpenEnvelope::failed(error)
        }
    }
}

async fn prepare(
    path: &str,
    options: &Option<serde_json::Value>,
    is_trusted: bool,
    on_change: impl Fn(&str) + Send + Sync + 'static,
) -> Result<(Arc<CliEngine>, Option<RepoWatcher>, WireSnapshot), GitError> {
    let engine = Arc::new(CliEngine::open(std::path::Path::new(path)).await?);
    let risky = super::trust::risky_config_keys(engine.root()).await?;
    if !is_trusted && !risky.is_empty() {
        return Err(super::trust::untrusted_error(risky));
    }
    let snapshot = engine.snapshot(&snapshot_options(options)).await?;
    let root = engine.root().to_string_lossy().into_owned();
    let watcher = RepoWatcher::start(move || on_change(&root), engine.git_dir(), engine.common_dir());
    Ok((engine, watcher, snapshot))
}

#[tauri::command]
pub async fn gitpane_open(
    app: AppHandle,
    state: State<'_, GitPaneState>,
    path: String,
    options: Option<serde_json::Value>,
    trusted: Option<bool>,
) -> Result<OpenEnvelope, ()> {
    let emit = move |root: &str| {
        let _ = app.emit(CHANGED_EVENT, ChangedPayload { path: root.to_string() });
    };
    Ok(open_repo(&state, &path, &options, trusted.unwrap_or(false), emit).await)
}

#[tauri::command]
pub async fn gitpane_close(state: State<'_, GitPaneState>) -> Result<(), ()> {
    state.close().await;
    Ok(())
}

#[tauri::command]
pub async fn gitpane_snapshot(state: State<'_, GitPaneState>, options: Option<serde_json::Value>) -> Result<WireSnapshot, GitError> {
    current(&state).await?.snapshot(&snapshot_options(&options)).await
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageRequest {
    before_sha: String,
    limit: Option<usize>,
    graph_scope: Option<String>,
    skip: Option<u32>,
}

#[derive(serde::Serialize)]
pub struct PageResult {
    commits: Vec<WireCommit>,
    page: CommitPageInfo,
}

#[tauri::command]
pub async fn gitpane_commit_page(state: State<'_, GitPaneState>, request: PageRequest) -> Result<PageResult, GitError> {
    let before = request.before_sha.trim();
    if !is_sha(before) {
        return Err(GitError::unknown("Invalid revision.".to_string()));
    }
    let engine = current(&state).await?;
    let all = request.graph_scope.as_deref().unwrap_or("all") != "head";
    let page = engine
        .log_page(before, request.limit.unwrap_or(DEFAULT_PAGE_LIMIT).clamp(1, MAX_PAGE_LIMIT), all, request.skip.unwrap_or(0).min(MAX_SKIP))
        .await?;
    Ok(PageResult { commits: page.commits, page: page.page })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffRequest {
    path: String,
    source: String,
    sha: Option<String>,
    to_sha: Option<String>,
    ignore_whitespace: Option<bool>,
}

fn diff_source(source: &str) -> Result<DiffSource, GitError> {
    match source {
        "worktree" => Ok(DiffSource::Worktree),
        "index" => Ok(DiffSource::Index),
        "commit" => Ok(DiffSource::Commit),
        other => Err(GitError::unknown(format!("Unknown diff source \"{other}\"."))),
    }
}

#[tauri::command]
pub async fn gitpane_diff(state: State<'_, GitPaneState>, request: DiffRequest) -> Result<DiffResult, GitError> {
    if let Some(sha) = request.sha.as_deref().filter(|s| !is_sha(s)) {
        return Err(GitError::unknown(format!("Invalid revision \"{sha}\".")));
    }
    let engine = current(&state).await?;
    engine
        .diff(&DiffFetch {
            source: diff_source(&request.source)?,
            path: request.path,
            sha: request.sha,
            to_sha: request.to_sha,
            ignore_whitespace: request.ignore_whitespace.unwrap_or(false),
        })
        .await
}

#[derive(serde::Deserialize)]
pub struct CommitFilesRequest {
    sha: String,
}

#[tauri::command]
pub async fn gitpane_commit_files(state: State<'_, GitPaneState>, request: CommitFilesRequest) -> Result<Vec<WireWorkingTreeFile>, GitError> {
    if !is_sha(&request.sha) {
        return Err(GitError::unknown("Invalid revision.".to_string()));
    }
    current(&state).await?.commit_files(&request.sha).await
}

#[derive(serde::Deserialize)]
pub struct ActionValue {
    kind: String,
    target: Option<String>,
    meta: Option<serde_json::Value>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    operation_id: String,
    kind: String,
    phase: String,
    percent: Option<u32>,
    done: bool,
}

#[tauri::command]
pub async fn gitpane_execute(app: AppHandle, state: State<'_, GitPaneState>, action: ActionValue) -> Result<ActionEnvelope, ()> {
    if !super::kinds::is_allowed(&action.kind) {
        return Ok(ActionEnvelope::err(GitError::unknown(format!("Action \"{}\" is not available.", action.kind))));
    }
    let engine = match current(&state).await {
        Ok(engine) => engine,
        Err(error) => return Ok(ActionEnvelope::err(error)),
    };
    let operation_id = uuid::Uuid::new_v4().to_string();
    let kind = action.kind.clone();
    let op_for_emit = operation_id.clone();
    let emit = move |phase: &str, percent: Option<u32>, done: bool| {
        let _ = app.emit(PROGRESS_EVENT, ProgressPayload { operation_id: op_for_emit.clone(), kind: kind.clone(), phase: phase.to_string(), percent, done });
    };
    let meta = action.meta.unwrap_or(serde_json::Value::Null);
    Ok(engine.execute(&operation_id, &action.kind, action.target.as_deref(), &meta, &emit).await)
}

#[tauri::command]
pub async fn gitpane_cancel(state: State<'_, GitPaneState>) -> Result<(), ()> {
    if let Some(engine) = state.engine.read().await.clone() {
        engine.cancel().await;
    }
    Ok(())
}
