// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

use crate::git_pane::cli::git::GitError;
use std::path::Path;
use std::path::PathBuf;

use super::args::todo_line;

// ---------------- rebase editor bundle ----------------

pub struct RebaseEditorBundle {
    pub env: Vec<(String, String)>,
    pub(super) dir: PathBuf,
}

impl Drop for RebaseEditorBundle {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

/// Pre-built todo list + optional reword messages without an external editor.
/// Shell scripts on unix, batch files on Windows (node is not guaranteed
/// on user machines).
pub fn create_rebase_editor_bundle(
    entries: &[(String, String, String, Option<String>)],
) -> Result<RebaseEditorBundle, GitError> {
    let dir = std::env::temp_dir().join(format!("git-light-rebase-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir)
        .map_err(|e| GitError::unknown(format!("could not create rebase bundle dir: {e}")))?;
    let todo_path = dir.join("todo");
    let todo: String = entries
        .iter()
        .map(|(action, sha, subject, _)| todo_line(action, sha, subject))
        .collect();
    std::fs::write(&todo_path, &todo)
        .map_err(|e| GitError::unknown(format!("could not write rebase todo: {e}")))?;

    let rewords: Vec<String> = entries
        .iter()
        .filter_map(|(_, _, _, m)| m.clone())
        .collect();
    // Windows: drive the editors with PowerShell (`-File` + single-quoted
    // literal paths). This avoids cmd.exe command-line parsing entirely —
    // quoted `cmd /C` invocations get mangled for TEMP paths under
    // `C:\Users\...` (`'unneradmin' is not recognized as an internal or
    // external command`, even with forward slashes). Forward slashes need
    // no escaping in PowerShell; an embedded `'` is doubled. `-LiteralPath`
    // avoids wildcard parsing, and `$ErrorActionPreference = 'Stop'`
    // promotes cmdlet failures to terminating errors so git sees exit 1.
    let slash = |p: &Path| p.display().to_string().replace('\\', "/");
    let pslit = |p: &Path| slash(p).replace('\'', "''");
    let (seq_editor, msg_editor) = if cfg!(target_os = "windows") {
        let seq = dir.join("seq-editor.ps1");
        std::fs::write(
            &seq,
            format!(
                "$ErrorActionPreference = 'Stop'\nCopy-Item -LiteralPath '{}' -Destination $args[0] -Force\n",
                pslit(&todo_path)
            ),
        )
        .map_err(|e| GitError::unknown(e.to_string()))?;
        let msg_dir = dir.join("msgs");
        std::fs::create_dir_all(&msg_dir).map_err(|e| GitError::unknown(e.to_string()))?;
        for (i, msg) in rewords.iter().enumerate() {
            let mut text = msg.clone();
            if !text.ends_with('\n') {
                text.push('\n');
            }
            std::fs::write(msg_dir.join(format!("msg-{i}")), text)
                .map_err(|e| GitError::unknown(e.to_string()))?;
        }
        std::fs::write(dir.join("reword-index"), "0")
            .map_err(|e| GitError::unknown(e.to_string()))?;
        let msg = dir.join("msg-editor.ps1");
        std::fs::write(
            &msg,
            format!(
                "$ErrorActionPreference = 'Stop'\n$idx = [int](Get-Content -LiteralPath '{}' -Raw)\nCopy-Item -LiteralPath ('{}/msg-' + $idx) -Destination $args[0] -Force\nSet-Content -LiteralPath '{}' -Value ($idx + 1) -NoNewline\n",
                pslit(&dir.join("reword-index")),
                pslit(&msg_dir),
                pslit(&dir.join("reword-index"))
            ),
        )
        .map_err(|e| GitError::unknown(e.to_string()))?;
        (
            format!(
                "powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{}\"",
                slash(&seq)
            ),
            format!(
                "powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{}\"",
                slash(&msg)
            ),
        )
    } else {
        let seq = dir.join("seq-editor.sh");
        std::fs::write(
            &seq,
            format!("#!/bin/sh\ncp \"{}\" \"$1\"\n", todo_path.display()),
        )
        .map_err(|e| GitError::unknown(e.to_string()))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&seq, std::fs::Permissions::from_mode(0o755));
        }
        let msg_dir = dir.join("msgs");
        std::fs::create_dir_all(&msg_dir).map_err(|e| GitError::unknown(e.to_string()))?;
        for (i, msg) in rewords.iter().enumerate() {
            let mut text = msg.clone();
            if !text.ends_with('\n') {
                text.push('\n');
            }
            std::fs::write(msg_dir.join(format!("msg-{i}")), text)
                .map_err(|e| GitError::unknown(e.to_string()))?;
        }
        std::fs::write(dir.join("reword-index"), "0")
            .map_err(|e| GitError::unknown(e.to_string()))?;
        let msg = dir.join("msg-editor.sh");
        std::fs::write(
            &msg,
            format!(
                "#!/bin/sh\nIDX=$(cat \"{}\")\nIDX=${{IDX:-0}}\ncp \"{}/msg-$IDX\" \"$1\"\necho $((IDX + 1)) > \"{}\"\n",
                dir.join("reword-index").display(),
                msg_dir.display(),
                dir.join("reword-index").display()
            ),
        )
        .map_err(|e| GitError::unknown(e.to_string()))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&msg, std::fs::Permissions::from_mode(0o755));
        }
        (
            format!("sh \"{}\"", seq.display()),
            format!("sh \"{}\"", msg.display()),
        )
    };
    Ok(RebaseEditorBundle {
        env: vec![
            ("GIT_SEQUENCE_EDITOR".to_string(), seq_editor),
            ("GIT_EDITOR".to_string(), msg_editor),
        ],
        dir,
    })
}
