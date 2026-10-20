use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Duration;

use crate::git_pane::cli::git::GitError;

const FORWARDED_VARS: [&str; 4] = ["PATH", "SSH_AUTH_SOCK", "GNUPGHOME", "GPG_TTY"];
const XCODE_STUB_PATH: &str = "/usr/bin/git";
const LOGIN_SHELL_TIMEOUT: Duration = Duration::from_secs(3);
#[cfg(unix)]
const EXECUTABLE_BITS: u32 = 0o111;
const FALLBACK_SHELL: &str = "/bin/zsh";

pub struct GitEnv {
    pub git_path: Option<PathBuf>,
    pub vars: Vec<(String, String)>,
}

static GIT_ENV: OnceLock<GitEnv> = OnceLock::new();

pub fn global() -> &'static GitEnv {
    GIT_ENV.get_or_init(resolve)
}

/// Repo-local config is untrusted: it must not be able to spawn programs.
const HARDENING_ARGS: [&str; 4] = ["-c", "core.fsmonitor=false", "-c", "protocol.ext.allow=never"];

pub fn git_command() -> Result<tokio::process::Command, GitError> {
    command_for(global())
}

fn command_for(env: &GitEnv) -> Result<tokio::process::Command, GitError> {
    let program = env
        .git_path
        .as_ref()
        .ok_or_else(|| GitError::new("GitNotFound", "git is not installed.".to_string()))?;
    let mut cmd = tokio::process::Command::new(program);
    cmd.args(HARDENING_ARGS);
    for (key, value) in &env.vars {
        cmd.env(key, value);
    }
    Ok(cmd)
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

fn is_executable_file(path: &Path) -> bool {
    let Ok(meta) = std::fs::metadata(path) else {
        return false;
    };
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        meta.is_file() && meta.permissions().mode() & EXECUTABLE_BITS != 0
    }
    #[cfg(not(unix))]
    {
        meta.is_file()
    }
}

pub fn find_executable(
    binary: &str,
    path_var: &str,
    is_rejected: impl Fn(&Path) -> bool,
) -> Option<PathBuf> {
    std::env::split_paths(path_var)
        .filter(|dir| dir.is_absolute())
        .map(|dir| dir.join(binary))
        .filter(|candidate| is_executable_file(candidate))
        .filter_map(|candidate| candidate.canonicalize().ok())
        .find(|resolved| !is_rejected(resolved))
}

fn run_with_timeout(mut child: std::process::Child) -> Option<Vec<u8>> {
    let mut stdout = child.stdout.take()?;
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut buf = Vec::new();
        let read = std::io::Read::read_to_end(&mut stdout, &mut buf);
        let _ = tx.send(read.map(|_| buf));
    });
    match rx.recv_timeout(LOGIN_SHELL_TIMEOUT) {
        Ok(Ok(buf)) => child.wait().ok().filter(|s| s.success()).map(|_| buf),
        _ => {
            let _ = child.kill();
            let _ = child.wait();
            None
        }
    }
}

fn login_shell_env() -> Vec<(String, String)> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| FALLBACK_SHELL.to_string());
    std::process::Command::new(shell)
        .args(["-lc", "env"])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok()
        .and_then(run_with_timeout)
        .map(|out| parse_env_output(&String::from_utf8_lossy(&out)))
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
    let xcode_ok = !cfg!(target_os = "macos") || xcode_select_ok();
    let git_path = find_executable("git", &path_var, |path| is_xcode_stub(path, xcode_ok));
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

    fn write_git(dir: &Path, mode: u32) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let git = dir.join("git");
        std::fs::write(&git, "").unwrap();
        std::fs::set_permissions(&git, std::fs::Permissions::from_mode(mode)).unwrap();
        git.canonicalize().unwrap()
    }

    fn path_of(dirs: &[&Path]) -> String {
        std::env::join_paths(dirs).unwrap().into_string().unwrap()
    }

    #[test]
    fn finds_git_on_path() {
        let dir = tempfile::tempdir().unwrap();
        let git = write_git(dir.path(), 0o755);
        assert_eq!(find_executable("git", &path_of(&[dir.path()]), |_| false), Some(git));
    }

    #[test]
    fn skips_relative_path_entries() {
        let dir = tempfile::tempdir().unwrap();
        write_git(dir.path(), 0o755);
        let relative = Path::new("relative-dir-that-does-not-matter");
        assert_eq!(find_executable("git", &path_of(&[relative]), |_| false), None);
    }

    #[test]
    fn skips_non_executable_git() {
        let dir = tempfile::tempdir().unwrap();
        write_git(dir.path(), 0o644);
        assert_eq!(find_executable("git", &path_of(&[dir.path()]), |_| false), None);
    }

    #[test]
    fn continues_past_rejected_candidate() {
        let first = tempfile::tempdir().unwrap();
        let second = tempfile::tempdir().unwrap();
        let rejected = write_git(first.path(), 0o755);
        let expected = write_git(second.path(), 0o755);
        let path_var = path_of(&[first.path(), second.path()]);
        let found = find_executable("git", &path_var, |p| p == rejected);
        assert_eq!(found, Some(expected));
    }

    #[test]
    fn command_applies_program_and_vars() {
        let env = GitEnv {
            git_path: Some(PathBuf::from("/opt/homebrew/bin/git")),
            vars: vec![("SSH_AUTH_SOCK".to_string(), "/tmp/a.sock".to_string())],
        };
        let cmd = command_for(&env).unwrap();
        let std_cmd = cmd.as_std();
        assert_eq!(std_cmd.get_program(), "/opt/homebrew/bin/git");
        let has_sock = std_cmd
            .get_envs()
            .any(|(k, v)| k == "SSH_AUTH_SOCK" && v == Some("/tmp/a.sock".as_ref()));
        assert!(has_sock);
    }

    #[test]
    fn command_fails_without_git_path() {
        let env = GitEnv { git_path: None, vars: vec![] };
        let err = command_for(&env).unwrap_err();
        assert_eq!(err.code, "GitNotFound");
    }
}
