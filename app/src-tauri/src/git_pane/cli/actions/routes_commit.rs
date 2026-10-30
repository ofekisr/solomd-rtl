// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;

use super::args::{meta_bool, meta_str, s_arg};
use super::route_action;
use super::route_ctx::RouteCtx;

pub(super) async fn route(ctx: &RouteCtx<'_>) -> Result<String, GitError> {
    let RouteCtx { kind, cwd, target, meta, journal, cancel, on_progress, repo_state, command_log, .. } = *ctx;
    let run_input = |args: Vec<String>, input: Option<String>| ctx.run_input(args, input);
    match kind {
        "commit" => {
            let title = meta_str(meta, "message").map(str::trim).unwrap_or("");
            if title.is_empty() {
                return Err(GitError::new(
                    "NothingToCommit",
                    "Commit message is required.".to_string(),
                ));
            }
            let full_message = match meta_str(meta, "body").map(str::trim).filter(|s| !s.is_empty()) {
                Some(body) => format!("{title}\n\n{body}"),
                None => meta_str(meta, "message").unwrap_or("").trim_end().to_string(),
            };
            let mut args = vec![s_arg("commit"), s_arg("--cleanup=verbatim"), s_arg("-F"), s_arg("-")];
            if meta_bool(meta, "signOff") {
                args.push(s_arg("--signoff"));
            }
            if meta_bool(meta, "sign") {
                args.push(s_arg("-S"));
            }
            run_input(args, Some(full_message)).await?;
            Ok("Created commit".to_string())
        }
        "amend" => {
            let title = meta_str(meta, "message").map(str::trim).unwrap_or("");
            let mut args = vec![s_arg("commit"), s_arg("--amend")];
            let mut input = None;
            if title.is_empty() {
                args.push(s_arg("--no-edit"));
            } else {
                let full_message = match meta_str(meta, "body").map(str::trim).filter(|s| !s.is_empty()) {
                    Some(body) => format!("{title}\n\n{body}"),
                    None => title.to_string(),
                };
                args.extend([s_arg("--cleanup=verbatim"), s_arg("-F"), s_arg("-")]);
                input = Some(full_message);
            }
            if meta_bool(meta, "signOff") {
                args.push(s_arg("--signoff"));
            }
            if meta_bool(meta, "sign") {
                args.push(s_arg("-S"));
            }
            run_input(args, input).await?;
            Ok("Amended commit".to_string())
        }
        "commit-and-push" | "commit-and-force-push" => {
            let commit_kind = if meta_bool(meta, "amend") {
                "amend"
            } else {
                "commit"
            };
            Box::pin(route_action(
                cwd,
                commit_kind,
                target,
                meta,
                journal,
                cancel,
                on_progress,
                repo_state,
                command_log,
            ))
            .await?;
            let push_kind = if kind == "commit-and-force-push" {
                "force-push"
            } else {
                "push"
            };
            Box::pin(route_action(
                cwd,
                push_kind,
                None,
                meta,
                journal,
                cancel,
                on_progress,
                repo_state,
                command_log,
            ))
            .await?;
            Ok(if meta_bool(meta, "amend") {
                if kind == "commit-and-force-push" {
                    "Amended and force-pushed".to_string()
                } else {
                    "Amended and pushed".to_string()
                }
            } else if kind == "commit-and-force-push" {
                "Committed and force-pushed".to_string()
            } else {
                "Committed and pushed".to_string()
            })
        }
        _ => Err(GitError::unknown(format!("Unsupported action: {kind}"))),
    }
}
