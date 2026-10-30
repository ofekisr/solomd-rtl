// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use std::path::Path;

use tokio::sync::watch;

use crate::git_pane::cli::git::{GitError, RepoState};

use super::envelope::{record_result, ExecutedGitCommand};
use super::run::{remote_timeout_for, run_git, run_git_streaming, RunOptions, RunResult};

#[derive(Clone, Copy)]
pub(super) struct RouteCtx<'a> {
    pub(super) cwd: &'a Path,
    pub(super) kind: &'a str,
    pub(super) target: Option<&'a str>,
    pub(super) meta: &'a serde_json::Value,
    pub(super) journal: &'a tokio::sync::Mutex<super::journal::Journal>,
    pub(super) cancel: &'a watch::Receiver<()>,
    pub(super) on_progress: &'a (dyn Fn(&str) + Send + Sync),
    pub(super) repo_state: &'a RepoState,
    pub(super) command_log: &'a std::sync::Mutex<Vec<ExecutedGitCommand>>,
}

pub(super) fn no_target() -> GitError {
    GitError::unknown("No target specified.".to_string())
}

impl<'a> RouteCtx<'a> {
    pub(super) async fn run(&self, args: Vec<String>) -> Result<RunResult, GitError> {
        self.run_with(args, RunOptions::default()).await
    }

    pub(super) async fn run_input(
        &self,
        args: Vec<String>,
        input: Option<String>,
    ) -> Result<RunResult, GitError> {
        self.run_with(args, RunOptions { input, ..RunOptions::default() }).await
    }

    pub(super) async fn run_allow(&self, args: Vec<String>) -> Result<RunResult, GitError> {
        let opts = RunOptions {
            allow_failure: true,
            ..RunOptions::default()
        };
        self.run_with(args, opts).await
    }

    pub(super) fn run_stream(
        &self,
        args: Vec<String>,
        op: &str,
    ) -> impl std::future::Future<Output = Result<RunResult, GitError>> + '_ {
        let op_owned = op.to_string();
        async move {
            let argv_copy = args.clone();
            let opts = RunOptions {
                timeout: remote_timeout_for(&op_owned).or(RunOptions::default().timeout),
                ..RunOptions::default()
            };
            let res = run_git_streaming(
                self.cwd,
                args,
                opts,
                Some(self.cancel.clone()),
                self.on_progress,
            )
            .await;
            record_result(self.command_log, argv_copy, &res);
            res
        }
    }

    async fn run_with(
        &self,
        args: Vec<String>,
        opts: RunOptions,
    ) -> Result<RunResult, GitError> {
        let argv_copy = args.clone();
        let res = run_git(self.cwd, args, opts, Some(self.cancel.clone()), None).await;
        record_result(self.command_log, argv_copy, &res);
        res
    }
}
