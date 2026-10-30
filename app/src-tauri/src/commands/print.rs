/// Trigger the OS native print dialog for the given webview window. The
/// frontend should first mount a print-friendly overlay so only the rendered
/// markdown (not the editor UI) is included in the print.
///
/// Why here instead of `window.print()` in JS? WKWebView on macOS silently
/// no-ops `window.print()`, so the native call is the only way.
///
/// iOS / Android: `WebviewWindow::print()` doesn't exist on mobile in Tauri 2
/// (no system print dialog), so we expose a no-op there to keep `tauri::generate_handler!`
/// happy. The JS side never invokes this on mobile anyway — Print is gated behind
/// the macOS / Windows / Linux toolbar entry.
#[cfg(desktop)]
#[tauri::command]
pub fn print_webview(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| format!("print failed: {e}"))
}

#[cfg(mobile)]
#[tauri::command]
pub fn print_webview(_window: tauri::WebviewWindow) -> Result<(), String> {
    Err("print is not available on mobile".to_string())
}
