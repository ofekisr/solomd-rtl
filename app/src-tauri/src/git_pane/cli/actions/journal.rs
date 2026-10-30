// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;
use crate::git_pane::cli::git::RepoState;
use serde::Serialize;
use std::path::Path;

use super::run::{RunOptions, probe, run_git};

// ---------------- journal ----------------

#[derive(Debug, Clone, PartialEq)]
pub enum JournalCapture {
    Head,
    Index,
}

#[derive(Debug, Clone)]
pub struct Checkpoint {
    pub head_sha: String,
    pub branch: String,
    pub index_tree_sha: Option<String>,
    pub reset_mode: Option<String>,
}

#[derive(Debug, Clone)]
pub struct JournalEntry {
    pub checkpoint: Checkpoint,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalState {
    pub can_undo: bool,
    pub can_redo: bool,
    pub undo_label: Option<String>,
    pub redo_label: Option<String>,
}

#[derive(Debug, Default)]
pub struct Journal {
    undo_stack: Vec<JournalEntry>,
    redo_stack: Vec<JournalEntry>,
}

impl Journal {
    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }

    pub fn state(&self, repo_state: &RepoState) -> JournalState {
        let safe = is_undo_redo_safe(repo_state);
        JournalState {
            can_undo: safe && !self.undo_stack.is_empty(),
            can_redo: safe && !self.redo_stack.is_empty(),
            undo_label: safe
                .then(|| self.undo_stack.last().map(|e| e.label.clone()))
                .flatten(),
            redo_label: safe
                .then(|| self.redo_stack.last().map(|e| e.label.clone()))
                .flatten(),
        }
    }

    pub fn push_undo(&mut self, checkpoint: Checkpoint, label: String) {
        self.undo_stack.push(JournalEntry { checkpoint, label });
        self.redo_stack.clear();
    }

    pub async fn capture(
        &self,
        cwd: &Path,
        capture: &JournalCapture,
    ) -> Result<Checkpoint, GitError> {
        let (head_ok, head_out) = probe(cwd, &["rev-parse", "HEAD"]).await;
        let (_, branch_out) = probe(cwd, &["rev-parse", "--abbrev-ref", "HEAD"]).await;
        let head_sha = head_out.trim().to_string();
        if !head_ok || head_sha.is_empty() {
            return Err(GitError::unknown("Could not read HEAD.".to_string()));
        }
        let mut index_tree_sha = None;
        if *capture == JournalCapture::Index {
            let (_, tree_out) = probe(cwd, &["write-tree"]).await;
            let tree = tree_out.trim().to_string();
            if !tree.is_empty() {
                index_tree_sha = Some(tree);
            }
        }
        Ok(Checkpoint {
            head_sha,
            branch: {
                let b = branch_out.trim().to_string();
                if b.is_empty() {
                    "HEAD".to_string()
                } else {
                    b
                }
            },
            index_tree_sha,
            reset_mode: None,
        })
    }

    pub async fn undo(&mut self, cwd: &Path) -> Result<String, GitError> {
        let entry = self
            .undo_stack
            .pop()
            .ok_or_else(|| GitError::unknown("Nothing to undo.".to_string()))?;
        let current = self
            .capture(
                cwd,
                &if entry.checkpoint.index_tree_sha.is_some() {
                    JournalCapture::Index
                } else {
                    JournalCapture::Head
                },
            )
            .await?;
        self.redo_stack.push(JournalEntry {
            checkpoint: current,
            label: entry.label.clone(),
        });
        restore(cwd, &entry.checkpoint).await?;
        Ok(format!("Undid {}", entry.label))
    }

    pub async fn redo(&mut self, cwd: &Path) -> Result<String, GitError> {
        let entry = self
            .redo_stack
            .pop()
            .ok_or_else(|| GitError::unknown("Nothing to redo.".to_string()))?;
        let current = self
            .capture(
                cwd,
                &if entry.checkpoint.index_tree_sha.is_some() {
                    JournalCapture::Index
                } else {
                    JournalCapture::Head
                },
            )
            .await?;
        self.undo_stack.push(JournalEntry {
            checkpoint: current,
            label: entry.label.clone(),
        });
        restore(cwd, &entry.checkpoint).await?;
        Ok(format!("Redid {}", entry.label))
    }
}

pub(super) async fn current_head(cwd: &Path) -> Result<String, GitError> {
    let (ok, stdout) = probe(cwd, &["rev-parse", "HEAD"]).await;
    if !ok {
        return Err(GitError::unknown("Could not read HEAD.".to_string()));
    }
    Ok(stdout.trim().to_string())
}

pub(super) async fn restore(cwd: &Path, entry: &Checkpoint) -> Result<(), GitError> {
    let opts = RunOptions::default();
    if entry.index_tree_sha.is_some() && entry.head_sha == current_head(cwd).await? {
        run_git(
            cwd,
            vec!["read-tree".into(), entry.index_tree_sha.clone().unwrap()],
            opts,
            None,
            None,
        )
        .await?;
        return Ok(());
    }
    let reset_flag = match entry.reset_mode.as_deref() {
        Some("soft") => "--soft",
        Some("mixed") => "--mixed",
        _ => "--hard",
    };
    if !entry.branch.is_empty() && entry.branch != "HEAD" {
        let checkout = run_git(
            cwd,
            vec!["checkout".into(), entry.branch.clone()],
            RunOptions {
                allow_failure: true,
                ..RunOptions::default()
            },
            None,
            None,
        )
        .await?;
        if checkout.exit_code == Some(0) {
            run_git(
                cwd,
                vec!["reset".into(), reset_flag.into(), entry.head_sha.clone()],
                RunOptions::default(),
                None,
                None,
            )
            .await?;
            if entry.index_tree_sha.is_some() && reset_flag == "--hard" {
                run_git(
                    cwd,
                    vec!["read-tree".into(), entry.index_tree_sha.clone().unwrap()],
                    RunOptions::default(),
                    None,
                    None,
                )
                .await?;
            }
            return Ok(());
        }
    }
    run_git(
        cwd,
        vec!["checkout".into(), "--detach".into(), entry.head_sha.clone()],
        RunOptions::default(),
        None,
        None,
    )
    .await?;
    if let Some(tree) = &entry.index_tree_sha {
        run_git(
            cwd,
            vec!["read-tree".into(), tree.clone()],
            RunOptions::default(),
            None,
            None,
        )
        .await?;
    }
    Ok(())
}

pub fn is_undo_redo_safe(state: &RepoState) -> bool {
    !state.merging
        && !state.rebasing
        && !state.cherry_picking
        && !state.reverting
        && !state.bisecting
}

/// Mirrors `journalCaptureFor` in `shared/git/undoPolicy.ts`.
pub fn journal_capture_for(kind: &str) -> Option<JournalCapture> {
    match kind {
        "commit"
        | "amend"
        | "commit-and-push"
        | "commit-and-force-push"
        | "merge"
        | "merge-continue"
        | "rebase"
        | "rebase-from-here"
        | "interactive-rebase"
        | "rebase-continue"
        | "cherry-pick"
        | "cherry-pick-continue"
        | "revert"
        | "revert-continue"
        | "reset-soft"
        | "reset-mixed"
        | "reset-hard"
        | "checkout"
        | "checkout-commit"
        | "checkout-tag"
        | "create-branch"
        | "pop-stash"
        | "apply-stash" => Some(JournalCapture::Head),
        "stash"
        | "stage"
        | "unstage"
        | "stage-all"
        | "unstage-all"
        | "stage-patch"
        | "unstage-patch"
        | "resolve-conflict-ours"
        | "resolve-conflict-theirs"
        | "resolve-conflict-block"
        | "mark-conflict-resolved" => Some(JournalCapture::Index),
        _ => None,
    }
}

pub fn is_journalable_action(kind: &str) -> bool {
    journal_capture_for(kind).is_some()
}

/// Mirrors `journalLabel` in `shared/git/undoPolicy.ts`.
pub fn journal_label(kind: &str, target: Option<&str>, meta_name: Option<&str>) -> String {
    match kind {
        "commit" => "Commit".to_string(),
        "amend" => "Amend commit".to_string(),
        "commit-and-push" => "Commit and push".to_string(),
        "commit-and-force-push" => "Commit and force push".to_string(),
        "merge" | "merge-continue" => match target {
            Some(t) if !t.is_empty() => format!("Merge {t}"),
            _ => "Merge".to_string(),
        },
        "rebase" | "rebase-continue" => match target {
            Some(t) if !t.is_empty() => format!("Rebase onto {t}"),
            _ => "Rebase".to_string(),
        },
        "rebase-from-here" => "Rebase from commit".to_string(),
        "interactive-rebase" => "Interactive rebase".to_string(),
        "cherry-pick" | "cherry-pick-continue" => match target {
            Some(t) if !t.is_empty() => format!("Cherry-pick {}", &t[..t.len().min(7)]),
            _ => "Cherry-pick".to_string(),
        },
        "revert" | "revert-continue" => match target {
            Some(t) if !t.is_empty() => format!("Revert {}", &t[..t.len().min(7)]),
            _ => "Revert".to_string(),
        },
        "reset-soft" => "Soft reset".to_string(),
        "reset-mixed" => "Mixed reset".to_string(),
        "reset-hard" => "Hard reset".to_string(),
        "checkout" => match target {
            Some(t) if !t.is_empty() => format!("Checkout {t}"),
            _ => "Checkout".to_string(),
        },
        "checkout-commit" => match target {
            Some(t) if !t.is_empty() => format!("Checkout {}", &t[..t.len().min(7)]),
            _ => "Checkout commit".to_string(),
        },
        "checkout-tag" => match target {
            Some(t) if !t.is_empty() => format!("Checkout tag {t}"),
            _ => "Checkout tag".to_string(),
        },
        "create-branch" => {
            let name = meta_name.or(target).unwrap_or("");
            if name.is_empty() {
                "Create branch".to_string()
            } else {
                format!("Create branch {name}")
            }
        }
        "stash" => "Stash changes".to_string(),
        "pop-stash" => "Pop stash".to_string(),
        "apply-stash" => "Apply stash".to_string(),
        "stage" | "stage-patch" => match target {
            Some(t) if !t.is_empty() => format!("Stage {t}"),
            _ => "Stage file".to_string(),
        },
        "unstage" | "unstage-patch" => match target {
            Some(t) if !t.is_empty() => format!("Unstage {t}"),
            _ => "Unstage file".to_string(),
        },
        "stage-all" => "Stage all".to_string(),
        "unstage-all" => "Unstage all".to_string(),
        "resolve-conflict-ours"
        | "resolve-conflict-theirs"
        | "resolve-conflict-block"
        | "mark-conflict-resolved" => match target {
            Some(t) if !t.is_empty() => format!("Resolve {t}"),
            _ => "Resolve conflict".to_string(),
        },
        _ => kind.to_string(),
    }
}
