// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;

use super::args::{checked_rev, escape_glob, meta_bool, meta_str, s_arg};
use super::envelope::record_result;
use super::run::{RunOptions, run_git};
use super::route_ctx::RouteCtx;

pub(super) async fn route(ctx: &RouteCtx<'_>) -> Result<String, GitError> {
    let RouteCtx { kind, cwd, target, meta, cancel, command_log, .. } = *ctx;
    let run = |args: Vec<String>| ctx.run(args);
    let run_allow = |args: Vec<String>| ctx.run_allow(args);
    match kind {
        "stage" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let safe = crate::git_pane::cli::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            run(vec![s_arg("add"), s_arg("--"), s_arg(&safe)]).await?;
            Ok(format!("Staged {t}"))
        }
        "unstage" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let safe = crate::git_pane::cli::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            run(vec![
                s_arg("restore"),
                s_arg("--staged"),
                s_arg("--"),
                s_arg(&safe),
            ])
            .await?;
            Ok(format!("Unstaged {t}"))
        }
        "stage-all" => {
            run(vec![s_arg("add"), s_arg("-A")]).await?;
            Ok("Staged all changes".to_string())
        }
        "unstage-all" => {
            run(vec![
                s_arg("restore"),
                s_arg("--staged"),
                s_arg("--"),
                s_arg("."),
            ])
            .await?;
            Ok("Unstaged all changes".to_string())
        }
        "discard-file" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let safe = crate::git_pane::cli::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            let attempt = run(vec![
                s_arg("restore"),
                s_arg("--source=HEAD"),
                s_arg("--staged"),
                s_arg("--worktree"),
                s_arg("--"),
                s_arg(&safe),
            ])
            .await;
            if let Err(error) = attempt {
                let msg = error.message.to_lowercase();
                if msg.contains("did not match any file") && msg.contains("known to git") {
                    return Err(GitError::unknown(format!(
                        "{t} is untracked; delete it from the file tree instead."
                    )));
                }
                return Err(error);
            }
            Ok(format!("Discarded changes in {t}"))
        }
        "discard-all" => {
            run(vec![
                s_arg("restore"),
                s_arg("--source=HEAD"),
                s_arg("--staged"),
                s_arg("--worktree"),
                s_arg("--"),
                s_arg("."),
            ])
            .await?;
            Ok("Discarded all changes".to_string())
        }
        "restore-file" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let sha = checked_rev(meta_str(meta, "sha").unwrap_or("HEAD"), "revision")?;
            let safe = crate::git_pane::cli::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            run(vec![
                s_arg("restore"),
                s_arg("--source"),
                s_arg(&sha),
                s_arg("--"),
                s_arg(&safe),
            ])
            .await?;
            Ok(format!("Restored {t} from {}", &sha[..sha.len().min(7)]))
        }

        "stage-patch" | "unstage-patch" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let patch = meta_str(meta, "patch").unwrap_or("");
            if patch.trim().is_empty() {
                return Err(GitError::unknown("No patch specified.".to_string()));
            }
            let safe = crate::git_pane::cli::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            if meta_bool(meta, "intentToAdd") {
                run_allow(vec![s_arg("add"), s_arg("-N"), s_arg("--"), s_arg(&safe)]).await?;
            }
            if !patch.starts_with("diff --git") {
                return Err(GitError::unknown("Invalid patch.".to_string()));
            }
            let mut apply_args = vec![
                s_arg("apply"),
                s_arg("--cached"),
                s_arg(&format!("--include={}", escape_glob(&safe))),
            ];
            if kind == "unstage-patch" {
                apply_args.push(s_arg("-R"));
            }
            {
                let argv_copy = apply_args.clone();
                let res = run_git(
                    cwd,
                    apply_args,
                    RunOptions {
                        input: Some(patch.to_string()),
                        ..RunOptions::default()
                    },
                    Some(cancel.clone()),
                    None,
                )
                .await;
                record_result(command_log, argv_copy, &res);
                res?;
            }
            Ok(if kind == "unstage-patch" {
                format!("Unstaged hunk in {t}")
            } else {
                format!("Staged hunk in {t}")
            })
        }
        "discard-patch" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let patch = meta_str(meta, "patch").unwrap_or("");
            if patch.trim().is_empty() {
                return Err(GitError::unknown("No patch specified.".to_string()));
            }
            let safe = crate::git_pane::cli::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            if meta_bool(meta, "intentToAdd") {
                run_allow(vec![s_arg("add"), s_arg("-N"), s_arg("--"), s_arg(&safe)]).await?;
            }
            if !patch.starts_with("diff --git") {
                return Err(GitError::unknown("Invalid patch.".to_string()));
            }
            {
                let argv_copy = vec![
                    s_arg("apply"),
                    s_arg("-R"),
                    s_arg(&format!("--include={}", escape_glob(&safe))),
                ];
                let res = run_git(
                    cwd,
                    argv_copy.clone(),
                    RunOptions {
                        input: Some(patch.to_string()),
                        ..RunOptions::default()
                    },
                    Some(cancel.clone()),
                    None,
                )
                .await;
                record_result(command_log, argv_copy, &res);
                res?;
            }
            Ok(format!("Discarded hunk in {t}"))
        }
        _ => Err(GitError::unknown(format!("Unsupported action: {kind}"))),
    }
}
