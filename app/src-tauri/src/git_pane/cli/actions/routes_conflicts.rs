// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;

use super::args::{meta_str, s_arg};
use super::route_ctx::RouteCtx;

pub(super) async fn route(ctx: &RouteCtx<'_>) -> Result<String, GitError> {
    let RouteCtx { kind, cwd, target, meta, .. } = *ctx;
    let run = |args: Vec<String>| ctx.run(args);
    match kind {
        "resolve-conflict-ours" | "resolve-conflict-theirs" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let safe = crate::git_pane::cli::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            let side = if kind == "resolve-conflict-ours" {
                "--ours"
            } else {
                "--theirs"
            };
            run(vec![
                s_arg("checkout"),
                s_arg(side),
                s_arg("--"),
                s_arg(&safe),
            ])
            .await?;
            run(vec![s_arg("add"), s_arg("--"), s_arg(&safe)]).await?;
            let label = if kind == "resolve-conflict-ours" {
                "ours"
            } else {
                "theirs"
            };
            Ok(format!("Resolved {t} using {label}"))
        }
        "resolve-conflict-block" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let safe = crate::git_pane::cli::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            let block_index: usize = meta
                .get("blockIndex")
                .and_then(|v| v.as_u64())
                .unwrap_or(u64::MAX) as usize;
            let side = if meta_str(meta, "side") == Some("theirs") {
                "theirs"
            } else {
                "ours"
            };
            if block_index == usize::MAX {
                return Err(GitError::unknown(
                    "Invalid conflict block index.".to_string(),
                ));
            }
            let full = cwd.join(&safe);
            let content = std::fs::read_to_string(&full)
                .map_err(|e| GitError::unknown(format!("could not read conflicted file: {e}")))?;
            let updated = crate::git_pane::cli::diff::apply_conflict_resolution(&content, block_index, side)?;
            std::fs::write(&full, updated.as_bytes())
                .map_err(|e| GitError::unknown(format!("could not write conflicted file: {e}")))?;
            if !crate::git_pane::cli::diff::parse_conflict_markers(&updated).has_markers {
                run(vec![s_arg("add"), s_arg("--"), s_arg(&safe)]).await?;
            }
            Ok(format!("Resolved conflict block in {t}"))
        }
        "mark-conflict-resolved" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let safe = crate::git_pane::cli::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            run(vec![s_arg("add"), s_arg("--"), s_arg(&safe)]).await?;
            Ok(format!("Marked {t} as resolved"))
        }
        _ => Err(GitError::unknown(format!("Unsupported action: {kind}"))),
    }
}
