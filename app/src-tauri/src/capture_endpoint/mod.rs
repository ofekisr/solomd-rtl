//! HTTP capture endpoint — v2.4.
//!
//! A localhost HTTP server that accepts new-note submissions from external
//! clients (browser extension, iOS shortcuts, shell scripts, curl). Same
//! shape as `dev_bridge.rs` (hand-rolled HTTP/1.1, single bearer token,
//! 127.0.0.1 only) but **production-ready** — shipped in release builds
//! and gated by a Settings → Integrations toggle instead of `cfg(debug_assertions)`.
//!
//! Wire format:
//!
//!   POST http://127.0.0.1:7777/capture
//!     Headers: Authorization: Bearer <token>
//!              Content-Type: application/json
//!     Body:    { "title"?, "content", "url"?, "tags"?, "inbox"?,
//!                "append_path"? }
//!     -> 200   { "ok": true, "path": "/abs/path/to/inbox/..." }
//!     -> 401   missing or wrong bearer token
//!     -> 503   no workspace folder open
//!
//! Off by default. The user opts in from Settings → Integrations, copies
//! the displayed bearer token into their browser extension / shell, and
//! pings the endpoint. Toggling off shuts down the listener and clears
//! the on-disk port/token files.
//!
//! v2.4 — `append_path` mode (added for the iOS Shortcuts "append to
//! today's daily note" recipe). When the JSON body has an `append_path:
//! "<workspace-relative path>"`, the content is appended to that file
//! (creating it if missing) instead of writing a fresh note. Same
//! workspace constraint, same path-traversal rejection, same auth as the
//! create path. Useful for daily notes, running logs, dictation buffers.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

pub mod commands;
mod http;
mod note;
mod render;
mod server;
mod state;
mod test_hooks;
#[cfg(test)]
mod tests;

pub use commands::*;
pub use note::*;
pub use render::local_iso8601_now;
#[allow(unused_imports)]
pub use test_hooks::*;
use http::*;
use render::*;
use server::*;
use state::*;
