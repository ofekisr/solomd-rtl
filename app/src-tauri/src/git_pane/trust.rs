use super::cli::git::{git_text, GitError};
use std::path::Path;

pub const UNTRUSTED_CODE: &str = "UntrustedConfig";
const RISKY_KEYS: &str = r"^(filter\..*\.(clean|smudge|process)|core\.hookspath|core\.sshcommand|credential\..*helper|gpg\..*program|include\.path|includeif\..*\.path)$";

pub fn parse_matched_keys(raw: &str) -> Vec<String> {
    let mut keys: Vec<String> = raw
        .lines()
        .filter_map(|line| {
            let entry = line.split_once('\t').map_or(line, |(_, rest)| rest);
            entry.split_whitespace().next().map(str::to_string)
        })
        .collect();
    keys.sort();
    keys.dedup();
    keys
}

pub async fn risky_config_keys(root: &Path) -> Result<Vec<String>, GitError> {
    let (ok, stdout, stderr) =
        git_text(root, &["config", "--local", "--show-origin", "--get-regexp", RISKY_KEYS]).await?;
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
    fn parses_keys_from_show_origin_output() {
        let raw = "file:.git/config\tfilter.lfs.clean git-lfs clean -- %f\nfile:.git/config\tcore.hookspath .githooks\nfile:.git/config\tfilter.lfs.clean again\n";
        assert_eq!(parse_matched_keys(raw), vec!["core.hookspath", "filter.lfs.clean"]);
    }

    #[test]
    fn empty_output_has_no_keys() {
        assert!(parse_matched_keys("").is_empty());
    }
}
