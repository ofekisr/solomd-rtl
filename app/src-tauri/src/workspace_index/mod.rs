//! Workspace index — shared backbone for v2.0 features (F1 wikilinks/
//! backlinks, F3 tags panel, F6 Bases-style properties view).
//!
//! Scans the active workspace folder for `.md`/`.markdown` files, extracts
//! YAML front matter, wikilinks (`[[X]]`), `#tags`, and headings. Holds
//! everything in-memory; persists a JSON cache per workspace at
//! `<app_data_dir>/index/<sha256(folder)>.json` so warm starts are fast.
//!
//! A file watcher (notify) keeps the index live; on debounced changes the
//! affected file is re-scanned and an `solomd://index-updated` event is
//! emitted to the frontend.

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, RwLock};
use std::time::{Duration, SystemTime};

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use regex_lite::Regex;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;

pub mod commands;
mod cache;
mod extract;
mod scan;
mod types;
mod watch;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_tasks;

use cache::*;
use extract::*;
use scan::*;
use types::*;
use watch::*;
