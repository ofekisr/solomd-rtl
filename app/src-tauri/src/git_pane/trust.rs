use super::cli::git::{git_text, GitError};
use std::path::Path;

pub const UNTRUSTED_CODE: &str = "UntrustedConfig";
const RISKY_KEYS: &str = r"^(filter\..*\.(clean|smudge|process)|core\.hookspath|core\.sshcommand|credential\..*helper|gpg\..*program|include\.path|includeif\..*\.path)$";

const REPO_SCOPES: [&str; 2] = ["local", "worktree"];

pub fn parse_matched_keys(raw: &str) -> Vec<String> {
    let mut keys: Vec<String> = raw
        .lines()
        .filter_map(|line| {
            let mut fields = line.splitn(3, '\t');
            let scope = fields.next()?;
            let entry = fields.nth(1)?;
            if !REPO_SCOPES.contains(&scope) {
                return None;
            }
            entry.split_whitespace().next().map(str::to_string)
        })
        .collect();
    keys.sort();
    keys.dedup();
    keys
}

pub async fn risky_config_keys(root: &Path) -> Result<Vec<String>, GitError> {
    let (ok, stdout, stderr) =
        git_text(root, &["config", "--show-scope", "--show-origin", "--get-regexp", RISKY_KEYS]).await?;
    if ok {
        return Ok(parse_matched_keys(&stdout));
    }
    if stderr.trim().is_empty() {
        return Ok(Vec::new());
    }
    Err(GitError::unknown(format!("Could not read repository config: {}", stderr.trim())))
}

pub fn untrusted_error(root: &Path, keys: Vec<String>) -> GitError {
    let mut error = GitError::new(
        UNTRUSTED_CODE,
        "This repository's config can run programs. Trust it to enable the git pane.".to_string(),
    );
    error.detail = Some(root.to_string_lossy().into_owned());
    error.files = Some(keys);
    error
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_keys_from_show_scope_output() {
        let raw = "local\tfile:.git/config\tfilter.lfs.clean git-lfs clean -- %f\nworktree\tfile:.git/config.worktree\tcore.hookspath .githooks\nlocal\tfile:.git/config\tfilter.lfs.clean again\n";
        assert_eq!(parse_matched_keys(raw), vec!["core.hookspath", "filter.lfs.clean"]);
    }

    #[test]
    fn ignores_global_and_system_scopes() {
        let raw = "global\tfile:/home/u/.gitconfig\tcredential.helper osxkeychain\nsystem\tfile:/etc/gitconfig\tfilter.lfs.clean git-lfs\n";
        assert!(parse_matched_keys(raw).is_empty());
    }

    #[test]
    fn empty_output_has_no_keys() {
        assert!(parse_matched_keys("").is_empty());
    }
}
