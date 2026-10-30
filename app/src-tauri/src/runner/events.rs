use std::sync::atomic::Ordering;
use tauri::{Emitter, Manager, RunEvent};

use super::window::{fit_main_window_once, FORCE_CLOSE};
use super::PendingOpen;

pub(super) fn handle_run_event(app_handle: &tauri::AppHandle, event: RunEvent) {
    match &event {
        // ---- Post-restore window setup ----
        // `RunEvent::Ready` fires after the run loop has started, which
        // means after `tauri-plugin-window-state` has had a chance to
        // process its `run_on_main_thread`-queued restore_state call.
        // Two things we do here that we can't reliably do in `setup`:
        //
        // 1. Clamp the restored window to the current monitor (size +
        //    position). The plugin happily restores a saved 2556×1320
        //    @ x=1207 from a previous multi-monitor session onto a
        //    single 2560-wide monitor, leaving the right edge 1.2k px
        //    off-screen. Always recenter when the saved layout is
        //    invalid for the current monitor; preserve when valid.
        //
        // 2. macOS-only: re-issue show + set_focus so SoloMD becomes
        //    frontmost. `set_focus` from `setup` fires before NSApp
        //    has finished `applicationDidFinishLaunching` and gets
        //    silently dropped, leaving SoloMD launched behind the
        //    parent app (Finder / terminal) — the macOS menu bar
        //    keeps showing the previous app's menus until the user
        //    drags SoloMD's window.
        RunEvent::Ready => {
            // Fallback path: when there's no saved window state for the
            // plugin to restore (fresh install, deleted state file), no
            // Resized/Moved event ever fires from the restore — the
            // setup-time `on_window_event` hook would never trigger and
            // the window would never get shown / focused. Schedule a
            // delayed fit on a background thread; the AtomicBool guard
            // makes it a no-op if the on_window_event hook beat us.
            let app_handle_clone = app_handle.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(400));
                if let Some(win) = app_handle_clone.get_webview_window("main") {
                    fit_main_window_once(&win);
                }
            });
        }

        // ---- Window close: intercept and ask frontend ----
        // Only the main window gets the unsaved-tabs check. Auxiliary
        // windows (slideshow, "open file in new window" spawns labelled
        // `solomd-window-N` — #103) close directly: their frontend
        // (App.vue's onCloseRequested for aux labels) removes them from
        // the shared windows registry so they don't resurrect next launch.
        // Routing them through the main window's listener would instead
        // shut down the editor.
        RunEvent::WindowEvent {
            event: tauri::WindowEvent::CloseRequested { api, .. },
            label,
            ..
        } => {
            if label != "main" {
                return; // let the auxiliary window close itself
            }
            if FORCE_CLOSE.load(Ordering::Relaxed) {
                // Frontend confirmed — let the close proceed.
                return;
            }
            // Prevent the close and ask the frontend to check unsaved tabs.
            api.prevent_close();
            let _ = app_handle.emit("solomd://close-requested", ());
        }

        // ---- Auxiliary window destroyed ----
        // #103 — when an auxiliary window is fully torn down, tell any
        // window still alive so it can reconcile the shared windows
        // registry. The destroyed window's own `onCloseRequested` handler
        // already unregisters it in the normal path; this event is the
        // backstop for teardowns that bypass CloseRequested, keeping the
        // registry from resurrecting a window the user actually closed.
        RunEvent::WindowEvent {
            event: tauri::WindowEvent::Destroyed,
            label,
            ..
        } => {
            if label != "main" {
                let _ = app_handle.emit("solomd://window-destroyed", label.clone());
            }
        }

        // ---- macOS file open via double-click / Finder ----
        #[cfg(target_os = "macos")]
        RunEvent::Opened { urls } => {
            for url in urls {
                let path = if url.scheme() == "file" {
                    url.to_file_path()
                        .ok()
                        .and_then(|p| p.to_str().map(|s| s.to_string()))
                } else {
                    Some(url.to_string())
                };
                if let Some(p) = path {
                    if let Some(state) = app_handle.try_state::<PendingOpen>() {
                        state.0.lock().unwrap().push(p.clone());
                    }
                    let _ = app_handle.emit("solomd://opened-file", p);
                }
            }
        }

        _ => {}
    }
}
