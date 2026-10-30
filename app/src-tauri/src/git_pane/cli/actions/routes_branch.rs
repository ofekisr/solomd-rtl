// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;

use super::args::{checked_meta, checked_rev, checked_target, checkout_args, checkout_base, meta_bool, meta_str, reject_option_like, s_arg};
use super::classify::lfs_error;
use super::route_ctx::{no_target, RouteCtx};

pub(super) async fn route(ctx: &RouteCtx<'_>) -> Result<String, GitError> {
    let RouteCtx { kind, cwd, target, meta, .. } = *ctx;
    let run = |args: Vec<String>| ctx.run(args);
    let run_allow = |args: Vec<String>| ctx.run_allow(args);
    match kind {
        "checkout" => {
            let t = checked_target(target, "branch")?;
            let base = checkout_base(meta_bool(meta, "force"));
            if let Some(remote) = meta_str(meta, "remote") {
                let remote = remote.trim();
                reject_option_like(remote, "remote")?;
                let remote_ref = format!("{remote}/{t}");
                let created = run_allow(checkout_args(&base, &["-b", t, &remote_ref])).await?;
                if created.exit_code != Some(0) {
                    run(checkout_args(&base, &[t])).await?;
                }
            } else {
                run(checkout_args(&base, &[t])).await?;
            }
            Ok(format!("Checked out {t}"))
        }
        "checkout-commit" => {
            let t = target.ok_or_else(no_target)?;
            let rev = checked_rev(t, "commit")?;
            run(vec![s_arg("checkout"), s_arg("--detach"), s_arg(&rev)]).await?;
            Ok(format!(
                "Checked out {} (detached HEAD)",
                &rev[..rev.len().min(7)]
            ))
        }
        "create-branch" => {
            let name = match meta_str(meta, "name")
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                Some(name) => {
                    reject_option_like(name, "branch name")?;
                    name.to_string()
                }
                None => checked_target(target, "branch name")?.to_string(),
            };
            crate::git_pane::refname::validate_branch_name(cwd, &name).await?;
            if let Some(start) = meta_str(meta, "startPoint") {
                let start = checked_rev(start, "start point")?;
                run(vec![
                    s_arg("checkout"),
                    s_arg("-b"),
                    s_arg(&name),
                    s_arg(&start),
                ])
                .await?;
            } else {
                run(vec![s_arg("checkout"), s_arg("-b"), s_arg(&name)]).await?;
            }
            Ok(format!("Created and checked out {name}"))
        }
        "rename-branch" => {
            let new_name = meta_str(meta, "newName")
                .or(meta_str(meta, "name"))
                .map(str::trim)
                .unwrap_or("");
            if new_name.is_empty() {
                return Err(GitError::unknown("Branch names required.".to_string()));
            }
            reject_option_like(new_name, "branch name")?;
            let t = checked_target(target, "branch")?;
            run(vec![
                s_arg("branch"),
                s_arg("-m"),
                s_arg(t),
                s_arg(new_name),
            ])
            .await?;
            Ok(format!("Renamed branch to {new_name}"))
        }
        "delete-branch" => {
            let t = checked_target(target, "branch")?;
            let flag = if meta_bool(meta, "force") { "-D" } else { "-d" };
            run(vec![s_arg("branch"), s_arg(flag), s_arg(t)]).await?;
            Ok(format!("Deleted branch {t}"))
        }
        "delete-remote-branch" => {
            let t = checked_target(target, "remote branch")?;
            let explicit = meta_str(meta, "remote").map(str::trim).unwrap_or("");
            if !explicit.is_empty() {
                reject_option_like(explicit, "remote")?;
            }
            let (remote, branch) = if !explicit.is_empty() {
                (explicit.to_string(), t.to_string())
            } else if let Some(slash) = t.find('/') {
                (t[..slash].to_string(), t[slash + 1..].to_string())
            } else {
                ("origin".to_string(), t.to_string())
            };
            if branch.is_empty() {
                return Err(GitError::unknown("No remote branch specified.".to_string()));
            }
            reject_option_like(&remote, "remote")?;
            reject_option_like(&branch, "branch")?;
            run(vec![
                s_arg("push"),
                s_arg(&remote),
                s_arg("--delete"),
                s_arg(&branch),
            ])
            .await?;
            Ok(format!("Deleted remote branch {branch}"))
        }
        "set-upstream" => {
            let t = checked_target(target, "upstream")?;
            // Upstream must be `<remote>/<branch>`; validate both halves.
            let (remote, branch) = t.split_once('/').ok_or_else(|| {
                GitError::unknown("Upstream must be <remote>/<branch>.".to_string())
            })?;
            reject_option_like(remote, "remote")?;
            reject_option_like(branch, "branch")?;
            run(vec![s_arg("branch"), s_arg("-u"), s_arg(t)]).await?;
            Ok(format!("Set upstream to {t}"))
        }
        "compare-branches" => {
            let t = checked_target(target, "branch")?;
            let other = checked_meta(meta, "other", "branch")?;
            let out = run(vec![
                s_arg("log"),
                s_arg("--oneline"),
                s_arg(&format!("{t}..{other}")),
            ])
            .await?;
            let count = out.stdout.lines().filter(|l| !l.trim().is_empty()).count();
            Ok(format!("{count} commits in {other} not in {t}"))
        }

        "worktree-add" => {
            let wt_path = meta_str(meta, "path").unwrap_or("");
            if wt_path.trim().is_empty() {
                return Err(GitError::unknown("Worktree path required.".to_string()));
            }
            reject_option_like(wt_path.trim(), "worktree path")?;
            let mut args = vec![s_arg("worktree"), s_arg("add"), s_arg(wt_path)];
            if let Some(branch) = meta_str(meta, "branch") {
                let branch = branch.trim();
                if !branch.is_empty() {
                    reject_option_like(branch, "branch")?;
                    args.push(s_arg(branch));
                }
            }
            run(args).await?;
            Ok(format!("Added worktree at {wt_path}"))
        }
        "worktree-remove" => {
            let t = checked_target(target, "worktree path")?;
            run(vec![s_arg("worktree"), s_arg("remove"), s_arg(t)]).await?;
            Ok(format!("Removed worktree at {t}"))
        }

        "lfs-track" => {
            let t = checked_target(target, "tracking pattern")?;
            run(vec![s_arg("lfs"), s_arg("track"), s_arg(t)])
                .await
                .map_err(lfs_error)?;
            Ok(format!("Tracking {t} with Git LFS"))
        }
        "lfs-untrack" => {
            let t = checked_target(target, "tracking pattern")?;
            run(vec![s_arg("lfs"), s_arg("untrack"), s_arg(t)])
                .await
                .map_err(lfs_error)?;
            Ok(format!("Stopped tracking {t} with Git LFS"))
        }
        "lfs-prune" => {
            run(vec![s_arg("lfs"), s_arg("prune")])
                .await
                .map_err(lfs_error)?;
            Ok("Pruned local Git LFS objects".to_string())
        }
        _ => Err(GitError::unknown(format!("Unsupported action: {kind}"))),
    }
}
