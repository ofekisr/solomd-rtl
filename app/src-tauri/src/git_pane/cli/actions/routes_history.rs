// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;

use super::args::{checked_rev, checked_target, meta_bool, meta_str, s_arg};
use super::envelope::record_result;
use super::rebase_bundle::create_rebase_editor_bundle;
use super::run::{RunOptions, run_git};
use super::route_ctx::RouteCtx;

pub(super) async fn route(ctx: &RouteCtx<'_>) -> Result<String, GitError> {
    let RouteCtx { kind, cwd, target, meta, cancel, command_log, .. } = *ctx;
    let run = |args: Vec<String>| ctx.run(args);
    match kind {
        "merge" => {
            let t = checked_target(target, "branch")?;
            let mut args = vec![s_arg("merge")];
            if meta_bool(meta, "ffOnly") {
                args.push(s_arg("--ff-only"));
            } else if meta_bool(meta, "noFf") {
                args.push(s_arg("--no-ff"));
            } else if meta_bool(meta, "squash") {
                args.push(s_arg("--squash"));
            }
            args.push(s_arg(t));
            run(args).await?;
            if meta_bool(meta, "squash") {
                Ok(format!("Squashed {t} — review staged changes and commit"))
            } else {
                Ok(format!("Merged {t}"))
            }
        }
        "merge-continue" => {
            run(vec![s_arg("merge"), s_arg("--continue")]).await?;
            Ok("Merge completed".to_string())
        }
        "merge-abort" => {
            run(vec![s_arg("merge"), s_arg("--abort")]).await?;
            Ok("Merge aborted".to_string())
        }

        "rebase" => {
            let t = checked_target(target, "upstream")?;
            run(vec![s_arg("rebase"), s_arg(t)]).await?;
            Ok(format!("Rebased onto {t}"))
        }
        "rebase-from-here" => {
            let t = target.ok_or_else(|| GitError::unknown("No commit specified.".to_string()))?;
            let rev = checked_rev(t, "commit")?;
            run(vec![
                s_arg("rebase"),
                s_arg("--onto"),
                s_arg(&rev),
                s_arg("HEAD~1"),
            ])
            .await?;
            Ok("Rebased from commit".to_string())
        }
        "interactive-rebase" => {
            let t = target.ok_or_else(|| GitError::unknown("No base specified.".to_string()))?;
            let base = checked_rev(t, "base")?;
            let entries = meta
                .get("entries")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            if entries.is_empty() {
                return Err(GitError::unknown("No rebase plan specified.".to_string()));
            }
            if entries.len() > 500 {
                return Err(GitError::unknown("Rebase plan is too large.".to_string()));
            }
            const REBASE_ACTIONS: &[&str] = &["pick", "reword", "edit", "squash", "fixup", "drop"];
            let mut todo_entries = Vec::new();
            for e in &entries {
                let action = e.get("action").and_then(|v| v.as_str()).unwrap_or("pick");
                if !REBASE_ACTIONS.contains(&action) {
                    return Err(GitError::unknown("Invalid rebase action.".to_string()));
                }
                let sha = e.get("sha").and_then(|v| v.as_str()).unwrap_or("");
                let sha = checked_rev(sha, "commit")?;
                let subject = e.get("subject").and_then(|v| v.as_str()).unwrap_or("");
                if subject.len() > 4096 {
                    return Err(GitError::unknown("Rebase subject is too long.".to_string()));
                }
                let message = e
                    .get("message")
                    .and_then(|v| v.as_str())
                    .map(str::to_string);
                todo_entries.push((
                    action.to_string(),
                    sha.to_string(),
                    subject.to_string(),
                    message,
                ));
            }
            let bundle = create_rebase_editor_bundle(&todo_entries)?;
            let env: Vec<(String, String)> = bundle.env.clone();
            let argv_copy = vec![s_arg("rebase"), s_arg("-i"), s_arg(&base)];
            let result = run_git(
                cwd,
                argv_copy.clone(),
                RunOptions {
                    timeout: None,
                    extra_env: env,
                    ..RunOptions::default()
                },
                Some(cancel.clone()),
                None,
            )
            .await;
            record_result(command_log, argv_copy, &result);
            drop(bundle);
            result?;
            Ok("Interactive rebase started".to_string())
        }
        "rebase-continue" => {
            run(vec![s_arg("rebase"), s_arg("--continue")]).await?;
            Ok("Rebase continued".to_string())
        }
        "rebase-abort" => {
            run(vec![s_arg("rebase"), s_arg("--abort")]).await?;
            Ok("Rebase aborted".to_string())
        }
        "rebase-skip" => {
            run(vec![s_arg("rebase"), s_arg("--skip")]).await?;
            Ok("Rebase skipped commit".to_string())
        }

        "cherry-pick" => {
            let t = target.ok_or_else(|| GitError::unknown("No commit specified.".to_string()))?;
            let rev = checked_rev(t, "commit")?;
            run(vec![s_arg("cherry-pick"), s_arg(&rev)]).await?;
            Ok(format!("Cherry-picked {}", &rev[..rev.len().min(7)]))
        }
        "cherry-pick-continue" => {
            run(vec![s_arg("cherry-pick"), s_arg("--continue")]).await?;
            Ok("Cherry-pick continued".to_string())
        }
        "cherry-pick-abort" => {
            run(vec![s_arg("cherry-pick"), s_arg("--abort")]).await?;
            Ok("Cherry-pick aborted".to_string())
        }

        "bisect-start" => {
            let bad = match meta_str(meta, "bad")
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .or(target)
            {
                Some(value) => checked_rev(value, "revision")?,
                None => "HEAD".to_string(),
            };
            let good = match meta_str(meta, "good")
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                Some(value) => Some(checked_rev(value, "revision")?),
                None => None,
            };
            run(vec![s_arg("bisect"), s_arg("start")]).await?;
            let marked = async {
                run(vec![s_arg("bisect"), s_arg("bad"), s_arg(&bad)]).await?;
                if let Some(good) = good.as_ref() {
                    run(vec![s_arg("bisect"), s_arg("good"), s_arg(good)]).await?;
                }
                Ok::<(), GitError>(())
            }
            .await;
            if let Err(error) = marked {
                run(vec![s_arg("bisect"), s_arg("reset")]).await.ok();
                return Err(error);
            }
            Ok(match good.as_ref() {
                Some(good) => format!("Bisecting {bad} against {good}"),
                None => format!("Bisect started at {bad}"),
            })
        }
        "bisect-good" => {
            if let Some(t) = target {
                let rev = checked_rev(t, "revision")?;
                run(vec![s_arg("bisect"), s_arg("good"), s_arg(&rev)]).await?;
            } else {
                run(vec![s_arg("bisect"), s_arg("good")]).await?;
            }
            Ok("Marked commit as good".to_string())
        }
        "bisect-bad" => {
            if let Some(t) = target {
                let rev = checked_rev(t, "revision")?;
                run(vec![s_arg("bisect"), s_arg("bad"), s_arg(&rev)]).await?;
            } else {
                run(vec![s_arg("bisect"), s_arg("bad")]).await?;
            }
            Ok("Marked commit as bad".to_string())
        }
        "bisect-skip" => {
            run(vec![s_arg("bisect"), s_arg("skip")]).await?;
            Ok("Skipped commit during bisect".to_string())
        }
        "bisect-reset" => {
            run(vec![s_arg("bisect"), s_arg("reset")]).await?;
            Ok("Bisect ended".to_string())
        }

        "reset-soft" => {
            let rev = checked_rev(target.unwrap_or("HEAD"), "revision")?;
            run(vec![s_arg("reset"), s_arg("--soft"), s_arg(&rev)]).await?;
            Ok("Soft reset complete".to_string())
        }
        "reset-mixed" => {
            let rev = checked_rev(target.unwrap_or("HEAD"), "revision")?;
            run(vec![s_arg("reset"), s_arg("--mixed"), s_arg(&rev)]).await?;
            Ok("Mixed reset complete".to_string())
        }
        "reset-hard" => {
            let rev = checked_rev(target.unwrap_or("HEAD"), "revision")?;
            run(vec![s_arg("reset"), s_arg("--hard"), s_arg(&rev)]).await?;
            Ok("Hard reset complete".to_string())
        }

        "revert" => {
            let t = target.ok_or_else(|| GitError::unknown("No commit specified.".to_string()))?;
            let rev = checked_rev(t, "commit")?;
            run(vec![s_arg("revert"), s_arg("--no-edit"), s_arg(&rev)]).await?;
            Ok(format!("Reverted {}", &rev[..rev.len().min(7)]))
        }
        "revert-continue" => {
            run(vec![s_arg("revert"), s_arg("--continue")]).await?;
            Ok("Revert continued".to_string())
        }
        "revert-abort" => {
            run(vec![s_arg("revert"), s_arg("--abort")]).await?;
            Ok("Revert aborted".to_string())
        }
        _ => Err(GitError::unknown(format!("Unsupported action: {kind}"))),
    }
}
