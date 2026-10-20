use std::path::{Path, PathBuf};
use std::sync::OnceLock;

const FORWARDED_VARS: [&str; 4] = ["PATH", "SSH_AUTH_SOCK", "GNUPGHOME", "GPG_TTY"];
const XCODE_STUB_PATH: &str = "/usr/bin/git";
const FALLBACK_SHELL: &str = "/bin/zsh";

pub struct GitEnv {
    pub git_path: Option<PathBuf>,
    pub vars: Vec<(String, String)>,
}

static GIT_ENV: OnceLock<GitEnv> = OnceLock::new();

pub fn global() -> &'static GitEnv {
    GIT_ENV.get_or_init(resolve)
}

pub fn git_command() -> tokio::process::Command {
    let env = global();
    let program = env.git_path.clone().unwrap_or_else(|| PathBuf::from("git"));
    let mut cmd = tokio::process::Command::new(program);
    for (key, value) in &env.vars {
        cmd.env(key, value);
    }
    cmd
}

pub fn parse_env_output(raw: &str) -> Vec<(String, String)> {
    FORWARDED_VARS
        .iter()
        .filter_map(|wanted| {
            raw.lines().find_map(|line| {
                let (key, value) = line.split_once('=')?;
                (key == *wanted && !value.is_empty()).then(|| (key.to_string(), value.to_string()))
            })
        })
        .collect()
}

pub fn is_xcode_stub(path: &Path, xcode_select_ok: bool) -> bool {
    path == Path::new(XCODE_STUB_PATH) && !xcode_select_ok
}

pub fn find_on_path(binary: &str, path_var: &str) -> Option<PathBuf> {
    std::env::split_paths(path_var)
        .map(|dir| dir.join(binary))
        .find(|candidate| candidate.is_file())
}

fn login_shell_env() -> Vec<(String, String)> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| FALLBACK_SHELL.to_string());
    std::process::Command::new(shell)
        .args(["-lc", "env"])
        .stdin(std::process::Stdio::null())
        .output()
        .ok()
        .filter(|out| out.status.success())
        .map(|out| parse_env_output(&String::from_utf8_lossy(&out.stdout)))
        .unwrap_or_default()
}

fn xcode_select_ok() -> bool {
    std::process::Command::new("xcode-select")
        .arg("-p")
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false)
}

fn resolve() -> GitEnv {
    let vars = login_shell_env();
    let path_var = vars
        .iter()
        .find(|(key, _)| key == "PATH")
        .map(|(_, value)| value.clone())
        .or_else(|| std::env::var("PATH").ok())
        .unwrap_or_default();
    let git_path = find_on_path("git", &path_var)
        .filter(|path| !(cfg!(target_os = "macos") && is_xcode_stub(path, xcode_select_ok())));
    GitEnv { git_path, vars }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_only_forwarded_vars() {
        let raw = "PATH=/opt/homebrew/bin:/usr/bin\nSSH_AUTH_SOCK=/tmp/agent.sock\nHOME=/Users/x\nGNUPGHOME=/Users/x/.gnupg\n";
        let vars = parse_env_output(raw);
        assert_eq!(
            vars,
            vec![
                ("PATH".to_string(), "/opt/homebrew/bin:/usr/bin".to_string()),
                ("SSH_AUTH_SOCK".to_string(), "/tmp/agent.sock".to_string()),
                ("GNUPGHOME".to_string(), "/Users/x/.gnupg".to_string()),
            ]
        );
    }

    #[test]
    fn ignores_malformed_lines() {
        assert!(parse_env_output("garbage\n=novalue\n").is_empty());
    }

    #[test]
    fn usr_bin_git_is_stub_without_xcode() {
        assert!(is_xcode_stub(Path::new("/usr/bin/git"), false));
        assert!(!is_xcode_stub(Path::new("/usr/bin/git"), true));
        assert!(!is_xcode_stub(Path::new("/opt/homebrew/bin/git"), false));
    }

    #[test]
    fn finds_git_on_path() {
        let dir = tempfile::tempdir().unwrap();
        let git = dir.path().join("git");
        std::fs::write(&git, "").unwrap();
        let found = find_on_path("git", dir.path().to_str().unwrap());
        assert_eq!(found, Some(git));
    }
}
