/// Tell macOS AppKit to use the given language for native dialogs
/// (NSSavePanel/NSOpenPanel). Reads from a small preference file so the
/// setting survives across launches without needing Tauri state.
#[cfg(target_os = "macos")]
pub(super) fn apply_macos_language(lang: &str) {
    use objc2::rc::autoreleasepool;
    use objc2_foundation::{NSArray, NSString, NSUserDefaults};

    let _ = lang;
    let apple_lang = "en";
    autoreleasepool(|_| unsafe {
        let defaults = NSUserDefaults::standardUserDefaults();
        let code = NSString::from_str(apple_lang);
        let arr = NSArray::from_vec(vec![code]);
        defaults.setObject_forKey(Some(&*arr), &*NSString::from_str("AppleLanguages"));
    });
}

#[cfg(not(target_os = "macos"))]
pub(super) fn apply_macos_language(_lang: &str) {}

pub(super) fn read_saved_language() -> String {
    // Frontend writes this file whenever the user changes Settings → Language.
    // Read at startup so system dialogs can use the right locale.
    let path = dirs_path();
    std::fs::read_to_string(&path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| s == "en")
        .unwrap_or_else(|| "en".to_string())
}

fn dirs_path() -> std::path::PathBuf {
    let mut p = dirs_home().unwrap_or_else(std::env::temp_dir);
    p.push(".solomd-language");
    p
}

fn dirs_home() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(std::path::PathBuf::from))
}

#[tauri::command]
pub(super) fn save_language_preference(lang: String) -> Result<(), String> {
    let path = dirs_path();
    std::fs::write(&path, lang.trim()).map_err(|e| e.to_string())
}
