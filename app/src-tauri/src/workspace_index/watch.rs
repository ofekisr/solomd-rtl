use super::*;

// ---------------------------------------------------------------------------
// Watcher
// ---------------------------------------------------------------------------

pub(super) fn make_watcher(app: AppHandle, root: PathBuf) -> Result<RecommendedWatcher, String> {
    let app_for_handler = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        if let Ok(ev) = res {
            handle_event(&app_for_handler, ev);
        }
    })
    .map_err(|e| e.to_string())?;
    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    Ok(watcher)
}

pub(super) fn handle_event(app: &AppHandle, event: Event) {
    let interesting = matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
    );
    if !interesting {
        return;
    }
    let now = SystemTime::now();
    let mut to_rescan: Vec<PathBuf> = Vec::new();
    {
        let mut pending = match PENDING.lock() {
            Ok(p) => p,
            Err(_) => return,
        };
        for path in event.paths {
            let lower = path
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s.to_lowercase())
                .unwrap_or_default();
            if lower != "md" && lower != "markdown" && lower != "mdown" {
                continue;
            }
            pending.insert(path.clone(), now);
            to_rescan.push(path);
        }
    }
    if to_rescan.is_empty() {
        return;
    }
    // Debounce: run rescan in a separate thread after 200ms of quiet.
    let app_for_thread = app.clone();
    let paths = to_rescan.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(200));
        let now2 = SystemTime::now();
        let still_pending: Vec<PathBuf> = {
            let pending = match PENDING.lock() {
                Ok(p) => p,
                Err(_) => return,
            };
            paths
                .into_iter()
                .filter(|p| {
                    pending
                        .get(p)
                        .map(|t| now2.duration_since(*t).map(|d| d.as_millis() >= 180).unwrap_or(true))
                        .unwrap_or(false)
                })
                .collect()
        };
        if still_pending.is_empty() {
            return;
        }
        let mut changed = false;
        for path in &still_pending {
            if path.is_file() {
                if let Ok(idx) = scan_file(path) {
                    if let Ok(mut s) = STATE.write() {
                        s.entries.insert(path.clone(), idx);
                        changed = true;
                    }
                }
            } else {
                // Removed
                if let Ok(mut s) = STATE.write() {
                    if s.entries.remove(path).is_some() {
                        changed = true;
                    }
                }
            }
        }
        if let Ok(mut pending) = PENDING.lock() {
            for p in &still_pending {
                pending.remove(p);
            }
        }
        if changed {
            // Persist + notify. IMPORTANT: don't hold STATE.read() across
            // save_cache(), which itself acquires STATE.read() — recursive
            // reads on std::sync::RwLock can deadlock on macOS when a
            // writer is queued in between. Clone `root` out, drop the
            // guard, then call save_cache.
            let root = STATE.read().ok().and_then(|s| s.root.clone());
            if let Some(root) = root {
                let _ = save_cache(&app_for_thread, &root);
            }
            let _ = app_for_thread.emit("solomd://index-updated", &"watch");
        }
    });
}
