use super::super::*;

#[test]
fn classifies_authentication_failures() {
    let err = classify_git_error("fatal: Authentication failed for 'https://x'", Some(128));
    assert_eq!(err.code, "Authentication");
    assert!(err.message.contains("Authentication failed"));
}

#[test]
fn classifies_conflicts_with_files() {
    let err = classify_git_error(
        "CONFLICT (content): Merge conflict in src/a.ts\nAuto-merging src/b.ts",
        Some(1),
    );
    assert_eq!(err.code, "MergeConflict");
    assert_eq!(
        err.files.unwrap(),
        vec!["src/a.ts".to_string(), "src/b.ts".to_string()]
    );
}

#[test]
fn classifies_network_and_dirty_states() {
    assert_eq!(
        classify_git_error("fatal: could not resolve host github.com", Some(128)).code,
        "Network"
    );
    assert_eq!(
        classify_git_error("error: Your local changes would be overwritten", Some(1)).code,
        "DirtyWorktree"
    );
    assert_eq!(
        classify_git_error("fatal: not a git repository", Some(128)).code,
        "NotARepository"
    );
    assert_eq!(
        classify_git_error("nothing to commit, working tree clean", Some(1)).code,
        "NothingToCommit"
    );
}

#[test]
fn unknown_errors_carry_exit_code() {
    let err = classify_git_error("", Some(1));
    assert_eq!(err.code, "Unknown");
    assert_eq!(err.detail.as_deref(), Some("git exited with code 1"));
}

