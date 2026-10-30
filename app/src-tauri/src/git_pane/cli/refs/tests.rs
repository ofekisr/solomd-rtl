use std::collections::{HashMap, HashSet};
use crate::git_pane::cli::git::{NumstatEntry, WireBranchKind, WireFileStatus, WireStash};
use super::*;

#[test]
fn parses_local_branch_with_tracking() {
    let line = "refs/heads/main\x1fabc123\x1f*\x1forigin/main\x1f[ahead 2, behind 1]\x1f2024-05-01T12:00:00+00:00";
    let branches = parse_branches(line, &HashSet::new());
    assert_eq!(branches.len(), 1);
    let b = &branches[0];
    assert_eq!(b.id, "local:main");
    assert!(matches!(b.kind, WireBranchKind::Local));
    assert_eq!(b.ahead, 2);
    assert_eq!(b.behind, 1);
    assert!(b.is_current);
    assert_eq!(b.upstream.as_deref(), Some("origin/main"));
    assert_eq!(b.last_activity, "2024-05-01T12:00:00.000Z");
}

#[test]
fn parses_remote_branch_and_skips_symbolic_head() {
    let stdout = "refs/remotes/origin/HEAD\x1fabc\x1f \x1f\x1f\x1f2024-05-01T12:00:00+00:00\nrefs/remotes/origin/feat/x\x1fdef\x1f \x1f\x1f\x1f2024-05-01T12:00:00+00:00";
    let branches = parse_branches(stdout, &HashSet::new());
    assert_eq!(branches.len(), 1);
    let b = &branches[0];
    assert!(matches!(b.kind, WireBranchKind::Remote));
    assert_eq!(b.id, "remote:origin/feat/x");
    assert_eq!(b.name, "feat/x");
    assert_eq!(b.remote.as_deref(), Some("origin"));
    assert_eq!(b.group, "feat");
}

#[test]
fn drops_gone_upstream() {
    let line = "refs/heads/old\x1fabc\x1f \x1f\x1f[gone]\x1f2024-05-01T12:00:00+00:00";
    let branches = parse_branches(line, &HashSet::new());
    assert_eq!(branches[0].upstream, None);
}

#[test]
fn marks_favorites() {
    let line = "refs/heads/main\x1fabc\x1f*\x1f\x1f\x1f2024-05-01T12:00:00+00:00";
    let favs: HashSet<String> = ["main".to_string()].into_iter().collect();
    let branches = parse_branches(line, &favs);
    assert!(branches[0].is_favorite);
}

#[test]
fn parses_annotated_and_lightweight_tags() {
    let annotated =
        "v2.0\x1ftagobj\x1fcommitsha\x1ftag\x1f2024-01-02T00:00:00+00:00\x1fRelease";
    let lightweight = "v1.0\x1fcommitsha\x1f\x1fcommit\x1f2024-01-01T00:00:00+00:00\x1f";
    let tags = parse_tags(&format!("{annotated}\n{lightweight}"));
    assert_eq!(tags.len(), 2);
    assert_eq!(tags[0].id, "tag:v2.0");
    assert_eq!(tags[0].sha, "commitsha");
    assert!(tags[0].annotated);
    assert_eq!(tags[1].sha, "commitsha");
    assert!(!tags[1].annotated);
}

#[test]
fn parses_remotes_fetch_and_push() {
    let stdout = "origin\thttps://github.com/a/b.git (fetch)\norigin\thttps://github.com/a/b.git (push)\nupstream\tgit@x:y.git (fetch)\n";
    let remotes = parse_remotes(stdout);
    assert_eq!(remotes.len(), 2);
    assert_eq!(remotes[0].fetch_url, "https://github.com/a/b.git");
    assert_eq!(remotes[0].push_url, "https://github.com/a/b.git");
    assert_eq!(remotes[1].push_url, "");
}

#[test]
fn parses_stash_list_with_branch() {
    let stdout = "stash@{0}\x1f1700000000\x1fWIP on main: abc1234 my work";
    let stashes = parse_stashes(stdout);
    assert_eq!(stashes.len(), 1);
    assert_eq!(stashes[0].id, "stash@{0}");
    assert_eq!(stashes[0].index, 0);
    assert_eq!(stashes[0].branch, "main");
    assert_eq!(stashes[0].date, "2023-11-14T22:13:20.000Z");
    assert_eq!(stashes[0].base_sha, None);
    assert_eq!(stashes[0].base_subject, None);
}

#[tokio::test]
async fn resolves_base_for_every_stash() {
    // Regression test: `rev-parse --verify` accepts exactly one revision,
    // so resolving all stashes in a single call returned no base at all.
    let dir = std::env::temp_dir().join(format!("git-light-stash-test-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let run = |args: &[&str]| {
        let env = crate::git_pane::env::global();
        let mut cmd = std::process::Command::new(
            env.git_path.clone().unwrap_or_else(|| "git".into()),
        );
        for (k, v) in &env.vars {
            cmd.env(k, v);
        }
        cmd.args(args).current_dir(&dir).output().unwrap()
    };
    assert!(run(&["init"]).status.success());
    run(&["config", "user.name", "T"]);
    run(&["config", "user.email", "t@t"]);
    run(&["config", "commit.gpgsign", "false"]);
    std::fs::write(dir.join("f.txt"), "one\n").unwrap();
    run(&["add", "."]);
    assert!(run(&["commit", "-m", "one"]).status.success());
    std::fs::write(dir.join("f.txt"), "two\n").unwrap();
    assert!(run(&["stash", "push", "-m", "first"]).status.success());
    std::fs::write(dir.join("f.txt"), "three\n").unwrap();
    assert!(run(&["stash", "push", "-m", "second"]).status.success());
    let stashes = fetch_stashes(&dir).await;
    assert_eq!(stashes.len(), 2);
    assert!(
        stashes.iter().all(|s| s.base_sha.is_some()),
        "missing base: {:?}",
        stashes.iter().map(|s| &s.base_sha).collect::<Vec<_>>()
    );
    let _ = std::fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn attributes_each_stash_base_and_subject() {
    // Stashes created on different commits: the batched resolutions must
    // map each base back to its own stash. Subjects come from a second
    // batch that `git log --no-walk` reorders by date and dedupes, so a
    // positional pairing would swap the two subjects here.
    let dir =
        std::env::temp_dir().join(format!("git-light-stash-base-test-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let run = |args: &[&str]| {
        let env = crate::git_pane::env::global();
        let mut cmd = std::process::Command::new(
            env.git_path.clone().unwrap_or_else(|| "git".into()),
        );
        for (k, v) in &env.vars {
            cmd.env(k, v);
        }
        cmd.args(args).current_dir(&dir).output().unwrap()
    };
    let sha = |args: &[&str]| {
        String::from_utf8(run(args).stdout)
            .unwrap()
            .trim()
            .to_string()
    };
    assert!(run(&["init"]).status.success());
    run(&["config", "user.name", "T"]);
    run(&["config", "user.email", "t@t"]);
    run(&["config", "commit.gpgsign", "false"]);
    std::fs::write(dir.join("f.txt"), "one\n").unwrap();
    run(&["add", "."]);
    assert!(run(&["commit", "-m", "first"]).status.success());
    let first = sha(&["rev-parse", "HEAD"]);
    std::fs::write(dir.join("f.txt"), "dirty\n").unwrap();
    assert!(run(&["stash", "push", "-m", "on-first"]).status.success());
    std::fs::write(dir.join("f.txt"), "two\n").unwrap();
    run(&["add", "."]);
    assert!(run(&["commit", "-m", "second"]).status.success());
    let second = sha(&["rev-parse", "HEAD"]);
    std::fs::write(dir.join("f.txt"), "dirty again\n").unwrap();
    assert!(run(&["stash", "push", "-m", "on-second"]).status.success());

    let stashes = fetch_stashes(&dir).await;
    assert_eq!(stashes.len(), 2);
    assert_eq!(stashes[0].base_sha.as_deref(), Some(second.as_str()));
    assert_eq!(stashes[1].base_sha.as_deref(), Some(first.as_str()));
    assert_eq!(stashes[0].base_subject.as_deref(), Some("second"));
    assert_eq!(stashes[1].base_subject.as_deref(), Some("first"));
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn missing_stash_bases_skips_loaded_and_dedups() {
    use crate::git_pane::cli::git::{WireAuthor, WireCommit};
    let author = || WireAuthor {
        name: "A".to_string(),
        email: "a@example.com".to_string(),
        avatar_url: String::new(),
        initials: "A".to_string(),
        color: "#fff".to_string(),
    };
    let commit = |sha: &str| WireCommit {
        sha: sha.to_string(),
        short_sha: sha.chars().take(7).collect(),
        is_merge: false,
        parents: Vec::new(),
        subject: "subject".to_string(),
        body: None,
        author: author(),
        committer: author(),
        date: "2023-11-14T22:13:20.000Z".to_string(),
        refs: Vec::new(),
        is_cherry_pick: false,
        is_stash_base: false,
    };
    let stash = |base: Option<&str>| WireStash {
        id: "stash@{0}".to_string(),
        index: 0,
        message: "WIP on main: subject".to_string(),
        branch: "main".to_string(),
        date: "2023-11-14T22:13:20.000Z".to_string(),
        files_changed: 0,
        base_sha: base.map(str::to_string),
        base_subject: None,
    };
    let commits = vec![commit("aaa")];
    let stashes = vec![
        stash(Some("aaa")),
        stash(Some("bbb")),
        stash(Some("bbb")),
        stash(None),
    ];
    assert_eq!(
        missing_stash_base_shas(&commits, &stashes),
        vec!["bbb".to_string()]
    );
}

#[test]
fn parses_worktree_porcelain() {
    let stdout = "worktree /repo\nbranch refs/heads/main\n\nworktree /other\nbranch refs/heads/feat\nlocked reason\n";
    let worktrees = parse_worktrees(stdout, "/repo");
    assert_eq!(worktrees.len(), 2);
    assert_eq!(worktrees[0].id, "wt:0");
    assert!(worktrees[0].is_main);
    assert!(!worktrees[0].is_locked);
    assert_eq!(worktrees[1].branch, "feat");
    assert!(worktrees[1].is_locked);
}

#[test]
fn parses_simple_numstat() {
    let map = parse_numstat("3\t1\tsrc/a.ts\0");
    let entry = map.get("src/a.ts").expect("entry");
    assert_eq!(entry.additions, 3);
    assert_eq!(entry.deletions, 1);
}

#[test]
fn parses_status_modified_row() {
    let staged = HashMap::new();
    let mut unstaged = HashMap::new();
    unstaged.insert(
        "src/file.ts".to_string(),
        NumstatEntry {
            additions: 2,
            deletions: 1,
        },
    );
    let files = parse_status(StatusInput {
        porcelain: "1 .M N... 100644 100644 100644 abc def src/file.ts\0",
        staged: &staged,
        unstaged: &unstaged,
    });
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].path, "src/file.ts");
    assert!(matches!(files[0].status, WireFileStatus::Modified));
    assert!(!files[0].staged);
    assert_eq!(files[0].additions, 2);
    assert_eq!(files[0].id, "file:0");
}

#[test]
fn splits_staged_and_unstaged_rows() {
    let mut staged = HashMap::new();
    staged.insert(
        "src/file.ts".to_string(),
        NumstatEntry {
            additions: 1,
            deletions: 0,
        },
    );
    let mut unstaged = HashMap::new();
    unstaged.insert(
        "src/file.ts".to_string(),
        NumstatEntry {
            additions: 0,
            deletions: 2,
        },
    );
    let files = parse_status(StatusInput {
        porcelain: "1 MM N... 100644 100644 100644 a b src/file.ts\0",
        staged: &staged,
        unstaged: &unstaged,
    });
    assert_eq!(files.iter().filter(|f| f.staged).count(), 1);
    assert_eq!(files.iter().filter(|f| !f.staged).count(), 1);
}

#[test]
fn maps_status_codes() {
    assert!(matches!(map_code('A'), WireFileStatus::Added));
    assert!(matches!(map_code('D'), WireFileStatus::Deleted));
    assert!(matches!(map_code('R'), WireFileStatus::Renamed));
    assert!(matches!(map_code('U'), WireFileStatus::Conflicted));
    assert!(matches!(map_code('M'), WireFileStatus::Modified));
    assert!(matches!(map_code('T'), WireFileStatus::Modified));
    assert!(matches!(map_code('?'), WireFileStatus::Modified));
}

#[test]
fn detects_operation_state_from_git_dir() {
    let dir = std::env::temp_dir().join("git-light-state-test");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("HEAD"), "ref: refs/heads/main\n").unwrap();
    let clean = read_repo_state(&dir);
    assert!(!clean.merging);
    assert_eq!(clean.operation_label, None);
    std::fs::write(dir.join("MERGE_HEAD"), "abc\n").unwrap();
    let merging = read_repo_state(&dir);
    assert!(merging.merging);
    assert_eq!(merging.operation_label.as_deref(), Some("MERGING"));
    let _ = std::fs::remove_dir_all(&dir);
}
