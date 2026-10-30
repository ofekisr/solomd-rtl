// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;

use super::args::{meta_str, reject_option_like, s_arg};
use super::route_ctx::RouteCtx;

pub(super) async fn route(ctx: &RouteCtx<'_>) -> Result<String, GitError> {
    let RouteCtx { kind, meta, .. } = *ctx;
    let run = |args: Vec<String>| ctx.run(args);
    let run_stream = |args: Vec<String>, op: &str| ctx.run_stream(args, op);
    match kind {
        "fetch" => {
            run_stream(vec![s_arg("fetch"), s_arg("--all")], "fetch").await?;
            Ok("Fetched from all remotes".to_string())
        }
        "fetch-all" => {
            run_stream(
                vec![s_arg("fetch"), s_arg("--all"), s_arg("--prune")],
                "fetch-all",
            )
            .await?;
            Ok("Fetched and pruned remotes".to_string())
        }
        "pull" => {
            run_stream(vec![s_arg("pull"), s_arg("--ff-only")], "pull").await?;
            Ok("Pulled latest changes".to_string())
        }
        "push" => {
            run_stream(vec![s_arg("push")], "push").await?;
            Ok("Pushed to remote".to_string())
        }
        "force-push" => {
            run_stream(
                vec![s_arg("push"), s_arg("--force-with-lease")],
                "force-push",
            )
            .await?;
            Ok("Force-pushed to remote".to_string())
        }
        "push-tags" => {
            run_stream(vec![s_arg("push"), s_arg("--tags")], "push-tags").await?;
            Ok("Pushed tags".to_string())
        }
        "prune" => {
            let remote = meta_str(meta, "remote")
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or("origin");
            reject_option_like(remote, "remote")?;
            run(vec![s_arg("remote"), s_arg("prune"), s_arg(remote)]).await?;
            Ok(format!("Pruned stale remote branches ({remote})"))
        }
        "sync" => {
            run_stream(vec![s_arg("fetch"), s_arg("--all")], "fetch").await?;
            run_stream(vec![s_arg("pull"), s_arg("--ff-only")], "pull").await?;
            Ok("Synced with remote".to_string())
        }
        _ => Err(GitError::unknown(format!("Unsupported action: {kind}"))),
    }
}
