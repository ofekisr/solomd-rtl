use super::*;

pub(super) fn signature(repo: &Repository) -> Result<Signature<'static>, String> {
    if let Ok(sig) = repo.signature() {
        return Ok(sig.to_owned());
    }
    Signature::now("SoloMD", "solomd@local").map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_resolve_conflict(
    folder: String,
    file: String,
    choice: String, // "local" | "remote" | "both"
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let path = PathBuf::from(&folder);
        let repo = Repository::open(&path).map_err(|e| e.to_string())?;
        let mut index = repo.index().map_err(|e| e.to_string())?;
        if !index.has_conflicts() {
            return Ok(());
        }
        let abs = path.join(&file);

        // Find the conflict entry for this path.
        let conflicts = index.conflicts().map_err(|e| e.to_string())?;
        let mut found_ours: Option<git2::IndexEntry> = None;
        let mut found_theirs: Option<git2::IndexEntry> = None;
        for c in conflicts {
            let c = c.map_err(|e| e.to_string())?;
            let p = c
                .our
                .as_ref()
                .or(c.their.as_ref())
                .or(c.ancestor.as_ref())
                .map(|e| String::from_utf8_lossy(&e.path).to_string())
                .unwrap_or_default();
            if p == file {
                found_ours = c.our;
                found_theirs = c.their;
                break;
            }
        }

        match choice.as_str() {
            "local" => {
                if let Some(ours) = found_ours {
                    let blob = repo.find_blob(ours.id).map_err(|e| e.to_string())?;
                    fs::write(&abs, blob.content()).map_err(|e| e.to_string())?;
                }
            }
            "remote" => {
                if let Some(theirs) = found_theirs {
                    let blob = repo.find_blob(theirs.id).map_err(|e| e.to_string())?;
                    fs::write(&abs, blob.content()).map_err(|e| e.to_string())?;
                }
            }
            "both" => {
                // Keep local AS-IS, write remote alongside as `<name>.remote-<date>.md`.
                if let Some(theirs) = found_theirs {
                    let blob = repo.find_blob(theirs.id).map_err(|e| e.to_string())?;
                    let stem = abs.file_stem().and_then(|s| s.to_str()).unwrap_or("note");
                    let ext = abs
                        .extension()
                        .and_then(|s| s.to_str())
                        .map(|s| format!(".{}", s))
                        .unwrap_or_default();
                    let now = chrono_like_date();
                    let neighbor = abs.with_file_name(format!("{}.remote-{}{}", stem, now, ext));
                    fs::write(&neighbor, blob.content()).map_err(|e| e.to_string())?;
                }
            }
            _ => return Err(format!("unknown choice: {}", choice)),
        }

        // Mark resolved + stage the chosen content.
        index.remove_path(Path::new(&file)).ok();
        index
            .add_path(Path::new(&file))
            .map_err(|e| e.to_string())?;
        index.write().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
