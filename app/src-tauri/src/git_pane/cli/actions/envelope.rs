// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;
use serde::Serialize;

use super::run::RunResult;

// ---------------- execute ----------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutedGitCommand {
    pub argv: Vec<String>,
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub ok: bool,
    pub truncated: bool,
}

/// Per-stream cap for the command log sent to the renderer. The full
/// 8MiB `MAX_OUTPUT_BYTES` buffer is kept for internal use; only a small
/// prefix crosses the IPC boundary so a verbose `fetch/push` never
/// balloons renderer memory.
pub const MAX_COMMAND_LOG_CHARS: usize = 8 * 1024;


pub(super) fn format_git_command(argv: &[String]) -> String {
    let mut out = String::from("git");
    for a in argv {
        out.push(' ');
        if a.chars()
            .any(|c| c.is_whitespace() || c == '"' || c == '\'')
        {
            out.push('"');
            for c in a.chars() {
                if c == '"' {
                    out.push('\\');
                }
                out.push(c);
            }
            out.push('"');
        } else {
            out.push_str(a);
        }
    }
    out
}

pub(super) fn truncate_for_log(text: &str) -> (String, bool) {
    if text.len() <= MAX_COMMAND_LOG_CHARS {
        return (text.to_string(), false);
    }
    let mut end = MAX_COMMAND_LOG_CHARS;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    (format!("{}…", &text[..end]), true)
}

impl ExecutedGitCommand {
    pub(super) fn from_success(argv: Vec<String>, stdout: &str, stderr: &str, exit_code: Option<i32>) -> Self {
        let (stdout_t, t1) = truncate_for_log(stdout);
        let (stderr_t, t2) = truncate_for_log(stderr);
        Self {
            command: format_git_command(&argv),
            argv,
            stdout: stdout_t,
            stderr: stderr_t,
            exit_code,
            ok: true,
            truncated: t1 || t2,
        }
    }

    pub(super) fn from_failure(argv: Vec<String>, stderr_fallback: &str) -> Self {
        let (stderr_t, truncated) = truncate_for_log(stderr_fallback);
        Self {
            command: format_git_command(&argv),
            argv,
            stdout: String::new(),
            stderr: stderr_t,
            exit_code: None,
            ok: false,
            truncated,
        }
    }
}

pub(super) fn record_result(
    log: &std::sync::Mutex<Vec<ExecutedGitCommand>>,
    argv: Vec<String>,
    result: &Result<RunResult, GitError>,
) {
    let mut guard = match log.lock() {
        Ok(g) => g,
        Err(_) => return,
    };
    if guard.len() >= 50 {
        return;
    }
    match result {
        Ok(r) => guard.push(ExecutedGitCommand::from_success(
            argv,
            &r.stdout,
            &r.stderr,
            r.exit_code,
        )),
        Err(e) => guard.push(ExecutedGitCommand::from_failure(argv, &e.message)),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionEnvelope {
    pub ok: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<GitError>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflicts: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commands: Option<Vec<ExecutedGitCommand>>,
}

impl ActionEnvelope {
    pub(super) fn ok(message: String) -> Self {
        Self {
            ok: true,
            message,
            error: None,
            conflicts: None,
            commands: None,
        }
    }

    pub fn err(error: GitError) -> Self {
        let conflicts = error.files.clone().filter(|f| !f.is_empty());
        Self {
            ok: false,
            message: error.message.clone(),
            error: Some(error),
            conflicts,
            commands: None,
        }
    }

    pub(super) fn with_commands(mut self, commands: Vec<ExecutedGitCommand>) -> Self {
        if !commands.is_empty() {
            self.commands = Some(commands);
        }
        self
    }
}
