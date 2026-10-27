//! Web Inspector access for release builds. Tauri only exposes
//! `open_devtools` under `debug_assertions` or the `devtools` feature; the
//! feature is on by default and the MAS build turns it off, because on macOS
//! it relies on private WebKit API that App Review rejects.

#[tauri::command]
pub fn open_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(any(debug_assertions, feature = "devtools"))]
    {
        window.open_devtools();
        Ok(())
    }
    #[cfg(not(any(debug_assertions, feature = "devtools")))]
    {
        let _ = window;
        Err("The Web Inspector is not available in this build.".to_string())
    }
}
