// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;

use super::args::{checked_rev, meta_bool, meta_str, s_arg};
use super::route_ctx::RouteCtx;

pub(super) async fn route(ctx: &RouteCtx<'_>) -> Result<String, GitError> {
    let RouteCtx { kind, target, meta, .. } = *ctx;
    let run = |args: Vec<String>| ctx.run(args);
    match kind {
        "stash" => {
            let msg = meta_str(meta, "message").unwrap_or("WIP");
            let mut args = vec![s_arg("stash"), s_arg("push"), s_arg("-m"), s_arg(msg)];
            if meta_bool(meta, "includeUntracked") {
                args.push(s_arg("-u"));
            }
            if meta_bool(meta, "keepIndex") {
                args.push(s_arg("-k"));
            }
            run(args).await?;
            Ok("Saved working tree to stash".to_string())
        }
        "pop-stash" => {
            let stash_ref = checked_rev(target.unwrap_or("stash@{0}"), "stash")?;
            run(vec![s_arg("stash"), s_arg("pop"), s_arg(&stash_ref)]).await?;
            Ok("Popped stash".to_string())
        }
        "apply-stash" => {
            let stash_ref = checked_rev(target.unwrap_or("stash@{0}"), "stash")?;
            run(vec![s_arg("stash"), s_arg("apply"), s_arg(&stash_ref)]).await?;
            Ok("Applied stash".to_string())
        }
        "drop-stash" => {
            let stash_ref = checked_rev(target.unwrap_or("stash@{0}"), "stash")?;
            run(vec![s_arg("stash"), s_arg("drop"), s_arg(&stash_ref)]).await?;
            Ok("Dropped stash".to_string())
        }
        "rename-stash" => {
            let stash_ref = &checked_rev(target.unwrap_or("stash@{0}"), "stash")?;
            let message = meta_str(meta, "message").map(str::trim).unwrap_or("");
            if message.is_empty() {
                return Err(GitError::unknown("Stash message is required.".to_string()));
            }
            let rev = run(vec![s_arg("rev-parse"), s_arg(stash_ref)]).await?;
            let sha = rev.stdout.trim().to_string();
            if sha.is_empty() {
                return Err(GitError::unknown(
                    "Could not resolve stash ref.".to_string(),
                ));
            }
            // `stash store` with the same sha while the ref exists is a no-op,
            // so drop first (sha stays in the object db) then re-store.
            run(vec![s_arg("stash"), s_arg("drop"), s_arg(stash_ref)]).await?;
            run(vec![
                s_arg("stash"),
                s_arg("store"),
                s_arg("-m"),
                s_arg(message),
                s_arg(&sha),
            ])
            .await
            .map_err(|_| {
                GitError::unknown(format!(
                    "Renamed stash was dropped but re-storing failed (recover with {sha})."
                ))
            })?;
            Ok("Renamed stash".to_string())
        }
        _ => Err(GitError::unknown(format!("Unsupported action: {kind}"))),
    }
}
