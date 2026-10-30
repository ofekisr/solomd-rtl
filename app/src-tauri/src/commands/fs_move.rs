use std::fs;
use std::path::Path;

use super::fs_ops::sibling_assets_dir;
use super::link_rewrite::{abs_segments, relink_moved_tree};

// ---------------------------------------------------------------------------
// Moving files and folders inside the tree (#290 + #267).
//
// `fs_rename` above is already a filesystem move, but it only ever moves
// within ONE directory, so two things a real move breaks never came up:
//
//   1. **Cross-device.** A vault can span a mount point (a symlinked
//      subfolder on an external disk, a network share). `fs::rename` returns
//      EXDEV there and nothing happens. We fall back to copy-then-remove,
//      and only remove once the copy is complete, so a failure halfway
//      leaves the original intact.
//
//   2. **Relative links.** A note carries its body to the new folder, and
//      every relative `](…)` target in that body was written from the OLD
//      folder. `![](_assets/a.png)` resolves to nothing one level down —
//      "I moved a note and all its images broke" is the bug report this
//      exists to prevent. We re-express those targets from the new location.
//
// The link rewrite is deliberately **lexical**: it never hits the disk to
// resolve a target, it only adds or cancels leading `../` segments. So
// percent-encoding (`My%20file.png`), targets whose file doesn't exist,
// and case-insensitive filesystems all survive untouched — we never
// re-spell what the user typed, we only re-anchor it.
//
// Targets that point INSIDE the thing being moved are left alone: their
// relationship to the note didn't change. That set includes the per-file
// `<stem>.assets/` folder, which travels along with the note.
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn fs_move(from: String, to: String) -> Result<(), String> {
    fs_move_inner(from, to)
}

pub fn fs_move_inner(from: String, to: String) -> Result<(), String> {
    let from_p = Path::new(&from);
    let to_p = Path::new(&to);
    if !from_p.exists() {
        return Err(format!("source missing: {from}"));
    }
    let to_parent = to_p
        .parent()
        .ok_or_else(|| "destination has no parent folder".to_string())?;
    if !to_parent.is_dir() {
        return Err(format!("destination folder missing: {}", to_parent.display()));
    }
    if to_p.exists() {
        return Err(format!("target already exists: {to}"));
    }
    // Dropping a folder onto itself or onto one of its own descendants would
    // move a directory inside its own subtree. The OS refuses that with a
    // localized errno; catching it here lets the UI say something useful,
    // and lets the tree reject the drop before it ever starts.
    if from_p.is_dir() && is_self_or_descendant(from_p, to_parent) {
        return Err("a folder cannot be moved inside itself".to_string());
    }

    // Same per-file `.assets/` follow-along as `fs_rename`. On a move the
    // stem doesn't change, so the folder just travels to the new parent and
    // the `<stem>.assets/…` links inside the body keep resolving.
    let from_assets = sibling_assets_dir(from_p);
    let to_assets = sibling_assets_dir(to_p);

    move_tree(from_p, to_p)?;

    let mut moved_roots: Vec<Vec<String>> = vec![abs_segments(from_p)];
    if let (Some(fa), Some(ta)) = (from_assets, to_assets) {
        if fa.is_dir() && !ta.exists() {
            match move_tree(&fa, &ta) {
                // The assets folder moved too, so links into it must NOT be
                // rewritten — record it as part of the moved set.
                Ok(()) => moved_roots.push(abs_segments(&fa)),
                Err(e) => eprintln!("[fs_move] assets folder move failed: {e}"),
            }
        }
    }

    relink_moved_tree(to_p, from_p, &moved_roots);
    Ok(())
}

/// True when `inner` is `outer` itself or sits underneath it. `inner` is the
/// destination's *parent* (the destination itself doesn't exist yet), so it
/// canonicalises cleanly; symlinked vault subfolders compare by their real
/// location, which is what the OS will actually do.
fn is_self_or_descendant(outer: &Path, inner: &Path) -> bool {
    let c_outer = fs::canonicalize(outer).unwrap_or_else(|_| outer.to_path_buf());
    let c_inner = fs::canonicalize(inner).unwrap_or_else(|_| inner.to_path_buf());
    c_inner.starts_with(&c_outer)
}

/// `fs::rename`, falling back to copy-then-remove when source and destination
/// live on different filesystems (EXDEV = 18 on unix, ERROR_NOT_SAME_DEVICE =
/// 17 on Windows). Any other error is reported as-is rather than silently
/// retried as a copy — a permission failure should stay a permission failure.
fn move_tree(from: &Path, to: &Path) -> Result<(), String> {
    match fs::rename(from, to) {
        Ok(()) => Ok(()),
        Err(e) => {
            if !matches!(e.raw_os_error(), Some(18) | Some(17)) {
                return Err(format!("move failed: {e}"));
            }
            copy_tree(from, to).map_err(|e| format!("cross-device copy failed: {e}"))?;
            let removed = if from.is_dir() {
                fs::remove_dir_all(from)
            } else {
                fs::remove_file(from)
            };
            removed.map_err(|e| {
                format!("copied to the new location, but the original could not be removed: {e}")
            })
        }
    }
}

fn copy_tree(from: &Path, to: &Path) -> std::io::Result<()> {
    if from.is_dir() {
        fs::create_dir_all(to)?;
        for entry in fs::read_dir(from)? {
            let entry = entry?;
            copy_tree(&entry.path(), &to.join(entry.file_name()))?;
        }
    } else {
        if let Some(parent) = to.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(from, to)?;
    }
    Ok(())
}

