use super::*;

// ---------------------------------------------------------------------------
// v3.0 — global proxy URL for users in regions where direct GitHub is
// blocked (China). We can't rely on launchctl-set env vars because Tauri
// apps started from Finder/Dock don't inherit the user's shell env.
// Storage: ~/.solomd/proxy (single-line URL like
// `http://127.0.0.1:7897` or `socks5://127.0.0.1:1080`). Empty file = no
// proxy = direct connect. Read on every push/pull (dirt-cheap).
// ---------------------------------------------------------------------------

pub(super) fn proxy_path() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
        .map(|h| h.join(".solomd").join("proxy"))
}

pub(super) fn read_proxy_url() -> Option<String> {
    let p = proxy_path()?;
    let raw = fs::read_to_string(&p).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[tauri::command]
pub fn proxy_get() -> Result<String, String> {
    Ok(read_proxy_url().unwrap_or_default())
}

#[tauri::command]
pub fn proxy_set(url: String) -> Result<(), String> {
    let p = proxy_path().ok_or("no HOME directory")?;
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let trimmed = url.trim();
    if trimmed.is_empty() {
        // Empty input = remove the file = direct connect.
        let _ = fs::remove_file(&p);
        return Ok(());
    }
    fs::write(&p, trimmed).map_err(|e| e.to_string())
}

/// Build a `ProxyOptions` for libgit2 fetch/push. When the user has set
/// a proxy URL, return `specified(url)`. Otherwise fall back to `auto()`
/// which lets libgit2 try standard env vars / system config — usually a
/// no-op in our GUI context but harmless. Returns a fresh options
/// struct each call (ProxyOptions has no Clone).
///
/// libgit2's `ProxyOptions::url` takes `&'a str`. We hand it a `&'static
/// str` from a process-local cache so we don't allocate-and-leak a new
/// `Box<str>` on every push/pull (which would happen thousands of times
/// per session for users with auto-push on). The cache leaks at most
/// once per distinct proxy URL and reuses the leaked &'static str on
/// subsequent calls — bounded by the count of times the user changes
/// the proxy setting in a single session, which is essentially zero.
pub(super) static PROXY_URL_CACHE: Lazy<Mutex<Option<&'static str>>> = Lazy::new(|| Mutex::new(None));

pub(super) fn make_proxy_options() -> git2::ProxyOptions<'static> {
    let mut po = git2::ProxyOptions::new();
    let current = read_proxy_url();
    let mut guard = PROXY_URL_CACHE.lock().expect("proxy cache poisoned");
    let cached_matches = matches!(
        (&current, &*guard),
        (Some(c), Some(g)) if c.as_str() == *g
    );
    if !cached_matches {
        *guard = current.map(|s| Box::leak(s.into_boxed_str()) as &'static str);
    }
    if let Some(s) = *guard {
        po.url(s);
    } else {
        po.auto();
    }
    po
}
