use super::*;

// ---------------------------------------------------------------------------
// Public state shared between the Tauri command layer and the running server.
// ---------------------------------------------------------------------------

/// Frontend-facing snapshot of the capture endpoint's current state.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CaptureState {
    pub enabled: bool,
    pub running: bool,
    pub port: u16,
    pub token: String,
    pub inbox_folder: String,
}

#[derive(Debug, Clone)]
pub(super) struct InnerState {
    pub(super) enabled: bool,
    pub(super) running: bool,
    pub(super) port: u16,
    pub(super) token: String,
    /// Workspace folder. Pushed in by the frontend whenever the user opens
    /// or switches a folder. None → endpoint returns 503.
    pub(super) workspace: Option<PathBuf>,
    /// Sub-folder inside the workspace where new notes land. Default `inbox`.
    pub(super) inbox_folder: String,
    /// Set when the active server should stop accepting new connections.
    pub(super) shutdown_gen: u64,
}

pub(super) static STATE: Lazy<Mutex<InnerState>> = Lazy::new(|| {
    Mutex::new(InnerState {
        enabled: false,
        running: false,
        port: 7777,
        token: String::new(),
        workspace: None,
        inbox_folder: "inbox".to_string(),
        shutdown_gen: 0,
    })
});

pub(super) static SERVER_RUNNING: AtomicBool = AtomicBool::new(false);

// ---------------------------------------------------------------------------
// Token generation. Same construction as dev_bridge — 32 hex chars derived
// from system time + pid + LCG mixer. Loopback-only, paired with an opt-in
// toggle, so we don't need true crypto secrecy.
// ---------------------------------------------------------------------------

pub(super) fn random_token() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id() as u128;
    let mix = nanos.wrapping_mul(0x9E37_79B9_7F4A_7C15).wrapping_add(pid);
    let mut s = String::with_capacity(32);
    let mut x = mix;
    for _ in 0..16 {
        s.push_str(&format!("{:02x}", (x & 0xff) as u8));
        x = x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    }
    s
}
