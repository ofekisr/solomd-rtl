use std::path::Path;
use std::process::Command;

/// Build a `Command` that never flashes a console window on Windows
/// (CREATE_NO_WINDOW). markitdown detection/conversion spawns would otherwise
/// pop a black cmd window for a frame. No-op off Windows.
fn no_window_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    #[allow(unused_mut)]
    let mut c = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000);
    }
    c
}
// ====================================================================
// Fallback: markitdown CLI
// ====================================================================

pub(super) fn convert_via_markitdown(path: &str) -> Result<String, String> {
    // Check if markitdown is installed
    let which = if cfg!(target_os = "windows") {
        no_window_command("where").arg("markitdown").output()
    } else {
        no_window_command("which").arg("markitdown").output()
    };

    match which {
        Ok(out) if out.status.success() => {}
        _ => {
            let ext = Path::new(path)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("?");
            return Err(format!(
                "Converting .{ext} files requires markitdown. Install with:\n\
                 pip install 'markitdown[all]'\n\n\
                 Then try again."
            ));
        }
    }

    let output = no_window_command("markitdown")
        .arg(path)
        .output()
        .map_err(|e| format!("Failed to run markitdown: {e}"))?;

    if output.status.success() {
        String::from_utf8(output.stdout).map_err(|e| format!("Output encoding error: {e}"))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("markitdown failed: {stderr}"))
    }
}
