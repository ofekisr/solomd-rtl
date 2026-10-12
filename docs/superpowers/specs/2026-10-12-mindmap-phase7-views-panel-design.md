# Mindmap Phase 7 — Views, Toolbar, Node Panel

## Status

Approved in conversation on 12-10-26. Parent design: `docs/superpowers/specs/2026-10-11-mindmap-design.md`.
Follow-up spec (deferred work): `docs/superpowers/specs/2026-10-12-mindmap-phase8-app-features-design.md`.

## Purpose

Phases 1–5 built mindmap features that are reachable only through the command palette, and left `mind-elixir` 5.15.1 APIs unwired.
Phase 7 exposes both through visible UI, adds per-tab view modes for `.mmap` files, and stops XMind imports from duplicating an existing `.mmap`.

"Package" below means the published `mind-elixir` npm package (installed in `node_modules`).
A package feature that is "not wired" exists in that package; SoloMD has no UI that calls it.

## Scope

| § | Area | Outcome |
|---|---|---|
| 1 | View modes | Each `.mmap` tab switches between Map, Source and Outline |
| 2 | XMind open fix | Opening `foo.xmind` never creates a second `foo.mmap` tab or a colliding unsaved import |
| 3 | Map toolbar + menus | Every existing mindmap action is reachable without the palette |
| 4 | Side panel | Node formatting and map settings through package APIs |
| 5 | Multi-select | Package box/Shift selection with batch delete, copy, move |

Out of scope (Phase 8): in-map search, editable outline tree, image tab, minimap, re-import of a changed `.xmind`, Map + Source split view.

## 1. View modes

### State

- New tab field `Tab.mindmapMode: 'map' | 'source' | 'outline'`, default `'map'`.
- Per tab; independent of the global Markdown `settings.viewMode`.
- Persisted with the session like other tab fields; an unknown stored value falls back to `'map'`.

### Rendering

`MindmapView.vue` becomes a shell that picks one renderer:

| Mode | Renderer | Editable |
|---|---|---|
| `map` | `MindmapCanvas` (unchanged behavior) | Yes |
| `source` | Existing code editor, JSON highlighting, content = file text | Yes |
| `outline` | `Preview` over the Markdown from the existing headings converter (`mindmap-headings.ts`) | No |

- Outline inherits Preview's RTL handling; it renders the current tab content, not the saved file.
- Outline is regenerated on entering the mode; it does not live-update from another pane.

### Transitions

| From → To | Rule |
|---|---|
| `map` → any | Flush the pending canvas sync first, so the target shows current content |
| `source` → `map` / `outline` | Run the existing `parse` + `sanitize` on the text. On failure stay in `source`, show an inline error with the parser message; never rewrite the file |
| any → `source` | Always allowed |

- The parse-error screen's "Open as text" button switches to `source` instead of setting `tab.language = 'plaintext'`.
- Sanitizing on `source` → `map` may drop unsafe fields; the canvas sync then writes the sanitized JSON back, as it does for any load today.

### Commands

| ID | Label | Default key |
|---|---|---|
| `mindmap.viewMap` | Mindmap: Map View | none |
| `mindmap.viewSource` | Mindmap: Source View | none |
| `mindmap.viewOutline` | Mindmap: Outline View | none |
| `mindmap.cycleView` | Mindmap: Cycle View | none |

All four are tab-scoped to mindmap tabs and work in every mode (including `source`, where the canvas keymap is inactive).

## 2. XMind open fix

### Problem

`openXmind` (`app/src/composables/useFiles.ts`) dedupes only on `tab.importedFrom === path`.

| Case | Today | After |
|---|---|---|
| Tab with `importedFrom === foo.xmind` open | Activates it | Unchanged |
| Tab for `foo.mmap` open (opened directly) | New import tab | Activate the `foo.mmap` tab |
| `foo.mmap` on disk, no tab | New unsaved import tab; Save collides with the real file | Open `foo.mmap` through the normal path; toast "Opened existing foo.mmap (imported earlier)" |

### Lookup order

1. Tab whose `importedFrom` equals the `.xmind` path.
2. Tab whose `filePath` equals `mmapPathFor(path)`.
3. `mmapPathFor(path)` exists on disk → `openPath` on it.
4. Otherwise import as today.

### Disk check

- Add Tauri command `fs_file_exists(path) -> bool`, mirroring `fs_dir_exists` (`commands.rs`), registered in `lib.rs` and `runner.rs`.
- Path comparison uses the same normalization `openPath` uses for its own tab dedupe.

### Not included

Re-import when the `.xmind` is newer than the `.mmap`: deferred to Phase 8.
Workaround: rename or delete the `.mmap`, then reopen the `.xmind`.

## 3. Map toolbar and menus

### Toolbar

A thin toolbar at the top of every mindmap tab, in all three modes:

| Control | Modes | Action |
|---|---|---|
| View switcher (Map / Source / Outline) | all | §1 |
| Undo / Redo | map | Package `undo` / `redo` (already wrapped for sync) |
| Panel toggle | map | §4 |
| `⋯` overflow menu | all (items disabled where meaningless) | See below |

Overflow menu:

- Export ▸ PNG, SVG, HTML, JSON, Markdown, Mermaid, adjacency JSON (existing actions)
- Copy plaintext
- Open as Markdown headings
- Graph view (checkbox)
- Read-only (checkbox)
- Find duplicates
- Keyboard shortcuts

The toolbar uses `inset-inline-*` positioning so it mirrors in RTL.
The package's bottom-right toolbar (fullscreen, center, zoom) and left layout toolbar stay as they are.

### Context menu

Extend the existing `contextMenu.extend` list (gates today) with:

- Jump to source
- Focus / Unfocus (package `focusNode` / `cancelFocus`)

New commands `mindmap.focusNode` and `mindmap.cancelFocus`, no default keys.

### Keys

No new default keys in Phase 7. Every new action is bindable through the existing keybinding registry.

## 4. Side panel

### Layout

- Docked on the inline-end side of the map; toggled by the toolbar button and `mindmap.togglePanel` (no default key).
- Open/closed state is a global setting (`mindmapPanelOpen`), remembered across sessions.
- Hidden in `source` and `outline` modes; disabled (read-only display) in read-only and graph view.

### Node tab (a single node selected)

| Field | Package field | Input |
|---|---|---|
| Text color | `style.color` | Color picker + clear |
| Background | `style.background` | Color picker + clear |
| Font size | `style.fontSize` | Slider, 12–40 px |
| Bold | `style.fontWeight` | Toggle |
| Branch color | `branchColor` | Color picker + clear |
| Tags | `tags` | Comma-separated text |
| Icons | `icons` | Fixed emoji grid (toggle) |
| URL | `hyperLink` | Text; rejected unless it matches `SAFE_LINK_PATTERN` |
| Note | `note` | Multiline text |

- Every write, including `note`, goes through `reshapeNode(tpc, patch)` (`patch: Partial<NodeObj>`), so undo/redo and canvas sync apply unchanged.
- Values are validated before the write with the same rules `mindmap-format.ts` uses on load; nothing unsafe reaches the live DOM.
- The note uses the package field `note`. The `@mind-elixir/node-menu` plugin writes `memo` instead, which is one reason it is not adopted.

### Map tab (no node selected)

| Setting | Package API | Values |
|---|---|---|
| Compact | `changeCompact()` | on / off |
| Branch style | `generateMainBranch` / `generateSubBranch` | curve (package default) / straight |
| Text color | `changeTheme({ cssVar })` | color |
| Font | `changeTheme({ cssVar })` | system / serif / mono |

Each control offers "Use global default".

### Settings storage

- Global defaults: new `settings.mindmapDefaults: { compact, branchStyle, textColor, font }`, edited in this tab and in Settings → Mindmap.
- Per-file override: optional top-level `solomd` block in the `.mmap` JSON:

  ```json
  { "nodeData": {}, "solomd": { "compact": true, "branchStyle": "straight" } }
  ```

- Effective value = file override ?? global default.
- `mindmap-format.ts` allow-lists `solomd` with typed values (Zod); unknown keys and invalid values are dropped on load.
- App light/dark theme still comes from SoloMD; per-file text color is applied on top of it.

### Rejected: `@mind-elixir/node-menu` 5.0.1

- Writes the note to `memo`, not `note`.
- Calls `reshapeNode({ hyperLink })` with unvalidated input.
- Plain DOM built from `innerHTML` templates plus an injected iconfont; no RTL, no SoloMD theming or i18n.

Used as a field reference only.

## 5. Multi-select

- Enable the package selection plugin: drag a box on empty canvas, Shift+click to add.
- Batch actions use existing package operations: delete, copy/cut/paste, move up/down.
- Copy keeps the existing `sanitizeCopiedNodes` wrapper.
- The side panel and gate actions act on a single node; with several nodes selected the Node tab shows "Select one node".

## Testing

| Area | Tests |
|---|---|
| View modes | Unit: mode default, persistence fallback, transition guard (invalid JSON stays in `source`). Browser: switch all three modes on a sample `.mmap`, Hebrew outline renders RTL |
| XMind fix | Unit: four lookup cases in order. Rust: `fs_file_exists` true/false |
| Toolbar | Browser: every overflow item runs its action; RTL mirroring |
| Side panel | Unit: field validators (URL, colors, font size bounds, tags, icons); `solomd` block sanitizer. Browser: edit each field, undo restores it, reload preserves it |
| Map settings | Unit: override ?? default resolution. Browser: compact and branch style visibly change |
| Multi-select | Browser: box select, batch delete, undo |

Desktop (Tauri) check before merge, as in Phase 4.
