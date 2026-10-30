use std::sync::atomic::{AtomicBool, Ordering};

/// Set to true by `force_close_window` command after the frontend confirms close.
pub(super) static FORCE_CLOSE: AtomicBool = AtomicBool::new(false);

/// Frontend calls this after user confirms "Discard & Close".
#[tauri::command]
pub(super) fn force_close_window(window: tauri::Window) {
    FORCE_CLOSE.store(true, Ordering::Relaxed);
    window.close().ok();
}

/// Cross-platform wrapper so the frontend can report the maximize-button
/// rect unconditionally; only Windows does anything with it.
#[tauri::command]
pub(super) fn set_max_button_rect(x: f64, y: f64, w: f64, h: f64, scale: f64) {
    #[cfg(target_os = "windows")]
    super::win_chrome::set_max_button_rect(x, y, w, h, scale);
    #[cfg(not(target_os = "windows"))]
    let _ = (x, y, w, h, scale);
}

/// One-shot guard so the size/position fit-up only runs once per launch.
/// After the plugin's restore (or the Ready-event fallback) triggers it,
/// further user moves/resizes are left alone.
static MAIN_FIT_DONE: AtomicBool = AtomicBool::new(false);

/// Apply the size + position clamp + show + focus exactly once. Subsequent
/// calls are cheap no-ops via the `MAIN_FIT_DONE` flag.
pub(super) fn fit_main_window_once(win: &tauri::WebviewWindow) {
    if MAIN_FIT_DONE
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }
    clamp_window_to_monitor(win);
    let _ = win.show();
    let _ = win.unminimize();
    let _ = win.set_focus();
}

/// Re-fit the main window into its current monitor's work area before show.
///
/// Two failure modes from `tauri-plugin-window-state` we have to defend
/// against on every launch:
/// 1. **Oversize restore** — a saved 2880×1740 from a 5K display, restored
///    on a 1440p laptop, leaves the bottom edge off-screen.
/// 2. **Out-of-bounds position** — saved coordinates from a now-disconnected
///    secondary monitor, or a saved Y that tucks the title bar behind the
///    macOS menu bar.
///
/// Behavior:
/// - If size or position is still valid for the current monitor, the user's
///   chosen layout is preserved (we don't fight intentional positioning).
/// - If anything was out of bounds, the window is clamped to a sensible
///   size and **recentered on the current monitor**. Centering > pinning to
///   an edge: a left-edge-pinned window after a display change reads as
///   "broken layout," whereas centered reads as "fresh start, sane state."
///
/// 40px is reserved at the top of the work area for the macOS menu bar.
fn clamp_window_to_monitor(win: &tauri::WebviewWindow) {
    // A maximized or fullscreen window is already sized to the monitor by the
    // OS — clamping it would call set_size(), which un-maximizes and shrinks
    // it. That's the Windows "restores maximized, then shrinks" bug (#56): the
    // window-state plugin restored the maximized state, then this clamp fired
    // on the restore's Resized event and undid it. Leave such windows alone.
    if win.is_maximized().unwrap_or(false) || win.is_fullscreen().unwrap_or(false) {
        return;
    }

    // The macOS global menu bar overlays the top of the screen, so reserve a
    // strip for it. Windows / Linux have no such bar — reserving there made a
    // legitimately near-full-height restored window get shrunk by 40px.
    #[cfg(target_os = "macos")]
    const MENU_BAR_RESERVE: i32 = 40;
    #[cfg(not(target_os = "macos"))]
    const MENU_BAR_RESERVE: i32 = 0;
    const MIN_W: i32 = 480;
    const MIN_H: i32 = 360;

    let Ok(Some(monitor)) = win.current_monitor() else { return; };
    let scale = monitor.scale_factor();
    let mon_w = (monitor.size().width as f64 / scale).round() as i32;
    let mon_h = (monitor.size().height as f64 / scale).round() as i32;
    let mon_x = (monitor.position().x as f64 / scale).round() as i32;
    let mon_y = (monitor.position().y as f64 / scale).round() as i32;

    let Ok(outer) = win.outer_size() else { return; };
    let cur_w = (outer.width as f64 / scale).round() as i32;
    let cur_h = (outer.height as f64 / scale).round() as i32;

    let max_w = mon_w;
    let max_h = mon_h - MENU_BAR_RESERVE;
    let new_w = cur_w.clamp(MIN_W, max_w);
    let new_h = cur_h.clamp(MIN_H, max_h);
    let size_clamped = new_w != cur_w || new_h != cur_h;

    let Ok(outer_pos) = win.outer_position() else { return; };
    let cur_x = (outer_pos.x as f64 / scale).round() as i32;
    let cur_y = (outer_pos.y as f64 / scale).round() as i32;

    // Position is "off-monitor" if any edge of the window falls outside the
    // current monitor's work area (top edge above the menu bar reserve, or
    // any other edge past the monitor bounds for the post-clamp size).
    let position_invalid = cur_x < mon_x
        || cur_x + new_w > mon_x + mon_w
        || cur_y < mon_y + MENU_BAR_RESERVE
        || cur_y + new_h > mon_y + mon_h;

    if size_clamped {
        let _ = win.set_size(tauri::LogicalSize::new(new_w as u32, new_h as u32));
    }

    if size_clamped || position_invalid {
        let new_x = mon_x + (mon_w - new_w) / 2;
        let centered_y = mon_y + (mon_h - new_h) / 2;
        let new_y = centered_y.max(mon_y + MENU_BAR_RESERVE);
        let _ = win.set_position(tauri::LogicalPosition::new(new_x, new_y));
    }
}
