// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;

use super::args::{checked_rev, checked_target, meta_bool, meta_str, reject_option_like, s_arg};
use super::route_ctx::RouteCtx;

pub(super) async fn route(ctx: &RouteCtx<'_>) -> Result<String, GitError> {
    let RouteCtx { kind, target, meta, .. } = *ctx;
    let run = |args: Vec<String>| ctx.run(args);
    match kind {
        "create-tag" | "tag" => {
            let name = match meta_str(meta, "name")
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                Some(name) => {
                    reject_option_like(name, "tag name")?;
                    name.to_string()
                }
                None => checked_target(target, "tag name")?.to_string(),
            };
            let mut args = if meta_bool(meta, "annotated") {
                vec![
                    s_arg("tag"),
                    s_arg("-a"),
                    s_arg(&name),
                    s_arg("-m"),
                    s_arg(meta_str(meta, "message").unwrap_or(&name)),
                ]
            } else {
                vec![s_arg("tag"), s_arg(&name)]
            };
            if let Some(sha) = meta_str(meta, "sha") {
                let sha = sha.trim();
                if !sha.is_empty() {
                    args.push(s_arg(&checked_rev(sha, "revision")?));
                }
            }
            run(args).await?;
            Ok(format!("Created tag {name}"))
        }
        "delete-tag" => {
            let t = checked_target(target, "tag")?;
            run(vec![s_arg("tag"), s_arg("-d"), s_arg(t)]).await?;
            Ok(format!("Deleted tag {t}"))
        }
        "checkout-tag" => {
            let t = checked_target(target, "tag")?;
            run(vec![s_arg("checkout"), s_arg("--detach"), s_arg(t)]).await?;
            Ok(format!("Checked out tag {t}"))
        }
        _ => Err(GitError::unknown(format!("Unsupported action: {kind}"))),
    }
}
