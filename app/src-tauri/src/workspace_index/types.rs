use super::*;

// ---------------------------------------------------------------------------
// Public types (match the TS interface in `app/src/lib/workspace-index.ts`).
// ---------------------------------------------------------------------------

/// One `- [ ]` / `- [x]` item, as found in a file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRef {
    /// 1-based line number **in the file**, front matter included.
    ///
    /// Deliberately not the body-relative number `WikilinkRef::line` uses: the
    /// panel both jumps to this line and rewrites the checkbox on it, so an
    /// off-by-front-matter number would tick the wrong box.
    pub line: u32,
    /// The task text, marker and leading bullet stripped. Priority and due
    /// tokens are left in — the frontend parses those (`lib/tasks.ts`) so the
    /// syntax lives in one place rather than being written twice.
    pub text: String,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexEntry {
    /// Absolute filesystem path.
    pub path: String,
    /// File name (without folder), e.g. `Welcome.md`.
    pub name: String,
    /// File name without extension — used as the canonical wikilink target.
    pub stem: String,
    /// Modification time (seconds since UNIX epoch).
    pub mtime: u64,
    /// File size in bytes.
    pub size: u64,
    /// Parsed YAML front matter (empty map if none).
    pub frontmatter: serde_json::Value,
    /// Outbound wikilinks (just the targets, not the alias / heading parts).
    pub wikilinks: Vec<WikilinkRef>,
    /// Tags found in body (`#tag`) and front matter (`tags: [...]`).
    pub tags: Vec<String>,
    /// Headings, e.g. `["Introduction", "Setup"]`.
    pub headings: Vec<String>,
    /// GFM task-list items (`- [ ]` / `- [x]`), for the workspace task panel.
    /// Defaults to empty when deserialized from an index cache written before
    /// this field existed.
    #[serde(default)]
    pub tasks: Vec<TaskRef>,
    /// First non-empty body line (front matter stripped), trimmed to 200 chars.
    pub summary: String,
    /// First H1 heading text (used for resolution by-title).
    pub title: Option<String>,
    /// F3 (v4.6) typed relationships: map `frontmatter key → list of canonical
    /// `[[ref]]`s`. Any non-reserved front-matter key whose value contains a
    /// wikilink. Mirrors `app/src/lib/relationships.ts::extractRelationships`.
    /// Defaults to empty for entries deserialized from an older index cache
    /// that predates this field.
    #[serde(default)]
    pub relationships: HashMap<String, Vec<String>>,
}

/// F3 — one inverse (referenced-by) edge resolved over the in-memory index.
#[derive(Debug, Clone, Serialize)]
pub struct ReferencedByRef {
    pub from_path: String,
    pub from_name: String,
    /// The forward-relationship front-matter key on the source note.
    pub via_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WikilinkRef {
    pub target: String,
    pub heading: Option<String>,
    pub alias: Option<String>,
    /// 1-based line number where the link appears.
    pub line: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct BacklinkRef {
    pub from_path: String,
    pub from_name: String,
    pub line: u32,
    /// Three-line snippet: prev / matching / next line for context.
    pub context: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TagCount {
    pub tag: String,
    pub count: u32,
    /// Files (paths) that contain this tag.
    pub files: Vec<String>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

pub(super) struct State {
    /// Workspace root currently watched (None until init).
    pub(super) root: Option<PathBuf>,
    /// path -> entry
    pub(super) entries: HashMap<PathBuf, IndexEntry>,
    /// notify watcher kept alive while index is active.
    pub(super) _watcher: Option<RecommendedWatcher>,
}

pub(super) static STATE: Lazy<RwLock<State>> = Lazy::new(|| {
    RwLock::new(State {
        root: None,
        entries: HashMap::new(),
        _watcher: None,
    })
});

/// Channel used to debounce raw notify events before re-scanning a file.
/// Keep one global for the whole app; a single workspace at a time is fine.
pub(super) static PENDING: Lazy<Mutex<HashMap<PathBuf, SystemTime>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
