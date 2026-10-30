use super::*;
use crate::git_pane::cli::git::DiffLineType;

#[test]
fn guesses_language_by_extension() {
    assert_eq!(guess_language("src/a.ts"), "typescript");
    assert_eq!(guess_language("app.vue"), "vue");
    assert_eq!(guess_language("Makefile"), "plaintext");
    assert_eq!(guess_language("a.TS"), "typescript");
}

#[test]
fn rejects_escaping_paths() {
    assert!(assert_path_inside_repo("/repo", "src/a.ts").is_ok());
    assert!(assert_path_inside_repo("/repo", "../evil").is_err());
    assert!(assert_path_inside_repo("/repo", "a/../../evil").is_err());
    assert!(assert_path_inside_repo("/repo", "./src/a.ts").is_ok());
}

#[test]
fn parses_empty_diff() {
    let result = parse_unified_diff("a.ts", "  \n");
    assert!(result.hunks.is_empty());
    assert!(!result.binary);
    assert_eq!(result.language, "typescript");
}

#[test]
fn detects_binary_diff() {
    let result = parse_unified_diff("img.png", "Binary files a/img.png and b/img.png differ\n");
    assert!(result.binary);
    assert!(result.hunks.is_empty());
}

#[test]
fn parses_hunk_with_line_numbers() {
    let raw = "--- a/a.ts\n+++ b/a.ts\n@@ -1,3 +1,4 @@\n context\n-old\n+new\n+added\n\\ No newline at end of file\n";
    let result = parse_unified_diff("a.ts", raw);
    assert_eq!(result.hunks.len(), 1);
    let hunk = &result.hunks[0];
    assert_eq!(
        (
            hunk.old_start,
            hunk.old_lines,
            hunk.new_start,
            hunk.new_lines
        ),
        (1, 3, 1, 4)
    );
    assert_eq!(hunk.lines.len(), 5);
    assert!(matches!(hunk.lines[0].line_type, DiffLineType::Context));
    assert_eq!(
        (hunk.lines[0].old_line, hunk.lines[0].new_line),
        (Some(1), Some(1))
    );
    assert_eq!(
        (hunk.lines[1].old_line, hunk.lines[1].new_line),
        (Some(2), None)
    );
    assert_eq!(
        (hunk.lines[2].old_line, hunk.lines[2].new_line),
        (None, Some(2))
    );
    assert!(matches!(hunk.lines[4].line_type, DiffLineType::Meta));
    assert_eq!((result.additions, result.deletions), (2, 1));
    assert_eq!(result.old_path.as_deref(), Some("a.ts"));
}

#[test]
fn parses_blame_porcelain() {
    let raw = "abc1234567 1 1 1\nauthor Ada\nauthor-mail <ada@x>\nauthor-time 1700000000\nsummary fix\n\tline one\n";
    let lines = parse_blame_porcelain(raw);
    assert_eq!(lines.len(), 1);
    assert_eq!(lines[0].line_number, 1);
    assert_eq!(lines[0].short_sha, "abc1234");
    assert_eq!(lines[0].author, "Ada");
    assert_eq!(lines[0].content, "line one");
}

#[test]
fn parses_file_history() {
    let raw = "abc123\x1fsubject\x1fAda\x1f1700000000\nbadline\n\x1f";
    let entries = parse_file_history(raw);
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].date, "2023-11-14T22:13:20.000Z");
}

#[test]
fn parses_conflict_with_base() {
    let content =
        "a\n<<<<<<< HEAD\nours\n||||||| base\norig\n=======\ntheirs\n>>>>>>> branch\nb\n";
    let parsed = parse_conflict_markers(content);
    assert!(parsed.has_markers);
    assert_eq!(parsed.blocks.len(), 1);
    let block = &parsed.blocks[0];
    assert_eq!((block.start_line, block.end_line), (2, 8));
    assert_eq!(block.base.as_deref(), Some("orig"));
    assert_eq!(block.ours, "ours");
    assert_eq!(block.theirs, "theirs");
}

#[test]
fn unterminated_conflict_still_flags_markers() {
    let parsed = parse_conflict_markers("<<<<<<< HEAD\nours\n");
    assert!(parsed.has_markers);
    assert!(parsed.blocks.is_empty());
}

#[test]
fn parses_rebase_commits() {
    let raw = "abc123\x1fabc\x1fsubject\x1fAda\x1f1700000000\x1e";
    let commits = parse_rebase_commits(raw);
    assert_eq!(commits.len(), 1);
    assert_eq!(commits[0].short_sha, "abc");
    assert_eq!(commits[0].date, "2023-11-14T22:13:20.000Z");
}

#[test]
fn parses_commit_files_with_rename() {
    let name_status = "M\0src/a.ts\0R100\0old.ts\0new.ts\0";
    let numstat = "3\t1\tsrc/a.ts\0";
    let files = parse_commit_files(name_status, numstat);
    assert_eq!(files.len(), 2);
    assert_eq!(files[0].id, "commit-0");
    assert_eq!(files[0].additions, 3);
    assert_eq!(files[1].status, crate::git_pane::cli::git::WireFileStatus::Renamed);
    assert_eq!(files[1].old_path.as_deref(), Some("old.ts"));
}

fn fixture_repo() -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

#[tokio::test]
async fn blames_real_file() {
    let blame = fetch_blame(
        &fixture_repo(),
        &DiffSource::Worktree,
        "package.json",
        None,
        None,
    )
    .await
    .expect("blame must work");
    assert_eq!(blame.path, "package.json");
    assert_eq!(blame.language, "json");
    assert!(!blame.lines.is_empty());
    assert!(blame.lines.iter().all(|l| l.line_number >= 1));
}

#[tokio::test]
async fn histories_real_file() {
    let history = fetch_file_history(&fixture_repo(), "package.json", 5)
        .await
        .expect("history must work");
    assert!(!history.entries.is_empty());
    assert!(history.entries.len() <= 5);
    assert!(history.entries.iter().all(|e| e.sha.len() == 40));
}

#[tokio::test]
async fn lists_head_commit_files() {
    let (ok, stdout, _) = crate::git_pane::cli::git::git_text(&fixture_repo(), &["rev-parse", "HEAD"])
        .await
        .unwrap();
    assert!(ok);
    let sha = stdout.trim().to_string();
    let files = fetch_commit_files(&fixture_repo(), &sha)
        .await
        .expect("commit files must work");
    assert!(!files.is_empty());
    assert!(files.iter().all(|f| !f.path.is_empty()));
}

#[tokio::test]
async fn searches_by_sha_prefix() {
    let (ok, stdout, _) =
        crate::git_pane::cli::git::git_text(&fixture_repo(), &["rev-parse", "--short", "HEAD"])
            .await
            .unwrap();
    assert!(ok);
    let short = stdout.trim().to_string();
    let results = fetch_search(
        &fixture_repo(),
        &SearchFetch {
            text: short.clone(),
            regex: false,
            limit: 10,
            graph_all: true,
            author_field: false,
        },
    )
    .await
    .expect("search must work");
    assert!(results.commits.iter().any(|c| c.sha.starts_with(&short)));
}

#[tokio::test]
async fn rebase_commits_rejects_empty_base() {
    let err = fetch_rebase_commits(&fixture_repo(), "  ")
        .await
        .expect_err("must fail");
    assert_eq!(err.code, "Unknown");
}

#[tokio::test]
async fn conflict_on_missing_file_is_empty() {
    let result = fetch_conflict(&fixture_repo(), "does/not/exist.ts")
        .await
        .expect("must not throw");
    assert!(!result.has_markers);
    assert!(result.blocks.is_empty());
}
