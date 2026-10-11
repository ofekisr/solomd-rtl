# Mindmap Support Design

## Status

Approved in conversation on 11-10-26. Branch: `feat/mindmap`.

| Phase | State |
|---|---|
| 1 `.mmap` file support | ✅ Done 11-10-26 (`4.14.9`) — plan `docs/superpowers/plans/2026-10-11-mindmap-phase1-mmap.md` |
| 2 XMind | ✅ Done 11-10-26 (`4.14.10`) — plan `docs/superpowers/plans/2026-10-11-mindmap-phase2-xmind.md` |
| 3 Markdown render | ✅ Done 12-10-26 (`4.14.11`) — plan `docs/superpowers/plans/2026-10-11-mindmap-phase3-fence.md` |
| 4 Map UI | Pending |
| 5 Convert md→mindmap | Pending |

## Purpose

SoloMD becomes an "md-to-mindmap" app, in the spirit of `ebook-to-mindmap`, and replaces the XMind desktop app.
It opens mindmap files as editable maps, renders mindmaps inside markdown, and converts markdown into mindmaps.

## Guiding rule

Use the Mind Elixir core and official `@mind-elixir/*` packages first.
Write SoloMD-specific code only for glue (routing, tabs, save, preview hooks) or where no package exists.
Phase order after Phase 1 may change when a package makes a later phase cheap.

## Dependencies

| Package | Version | Use |
|---|---|---|
| `mind-elixir` | `5.15.1` (stable 5.x; `latest` tag is a 6.0 prerelease) | Core editor, `plaintextConverter` |
| `@mind-elixir/import-xmind` | `1.0.8` | Read `.xmind` (Zen JSON and legacy XML); adopted in Phase 2 |
| `jszip` | `3.10.1` | Zip-size guard for `.xmind` (Phase 2) |
| `@mind-elixir/export-mindmap` | match core 5.x | Image, HTML, JSON, Markdown export |
| `@mind-elixir/export-xmind` | `2.0.1` | Rejected in Phase 2: lossy round-trip, peer range core 2–3 (last published 2023) |

## Phases

| # | Phase | Outcome |
|---|---|---|
| 1 | `.mmap` file support | Open, edit, save `.mmap` as an XMind-like map |
| 2 | XMind | Open `.xmind` as an imported map; saves go to a sibling `.mmap` (Save As), `.xmind` is never written |
| 3 | Markdown render | ```` ```mindmap ```` fences render in preview and write edits back |
| 4 | Map UI | Export, copy plaintext, map→markdown, jump to source, read-only toggle, gates, palette commands |
| 5 | Convert md→mindmap | Structural and AI conversion of a selection, section, document, or folder |

## Phase 1 — `.mmap` file support

### File format

- `.mmap` is UTF-8 JSON: `{ "format": "solomd-mindmap", "version": 1, "data": MindElixirData }`.
- `lib/mindmap-format.ts` owns `MINDMAP_EXTENSIONS`, `MMAP_EXTENSION`, `parseMindmap`, `serializeMindmap`, and `createEmptyMindmap`.
- `parseMindmap` validates the envelope and the root node at the boundary and returns a typed error, never throws into the view.
- An empty or zero-byte `.mmap` opens as a new map with a root named after the file.

### Routing

- `Language` gains `'mindmap'`; `inferFileLanguage` maps `MINDMAP_EXTENSIONS` to it.
- Extension lists updated from the constant: save filters, Tauri `fileAssociations` (role Editor), the Rust open-argument filter (`main.rs`), and the FileTree icon.

### View

- `PaneContent.vue` renders `MindmapView.vue` instead of Editor and Preview when `tab.language === 'mindmap'`.
- `MindmapView.vue` mounts Mind Elixir with `editable`, `contextMenu`, `keypress`, and `toolBar`; layout direction follows [Hebrew / RTL](#hebrew--rtl).
- Theme follows `settings.theme`; files store document fields only (`nodeData`, `arrows`, `summaries`, `direction`), never theme.
- Mind Elixir `operation` events debounce into `tab.content = serializeMindmap(getData())`.
- The tab stays a string tab, so dirty state, `saveTab`, AutoGit, and recent files work unchanged.
- External content changes (reload, revert) call `refresh()`; changes originating from the view do not.
- A parse failure shows an error panel with "Open as text" instead of the map.

### Hebrew / RTL

- Every topic renders with `unicode-bidi: plaintext; text-align: start`, so Hebrew, Arabic, and mixed Hebrew-English topics read correctly per node; the topic edit box behaves the same.
- Map direction reuses `documentDirection()` (`lib/doc-direction.ts`) over all topic texts.
- Layout: a map's stored `direction` always wins. A map without one (new or empty file) opens `LEFT` (branches grow leftward) when RTL-dominant, `SIDE` otherwise; a Hebrew file name makes a new map RTL.
- Arrow keys stay spatial (Left moves left on screen), matching XMind.
- Phase 3 fences and Phase 5 conversion reuse the same view, so they inherit this behavior.

### Keyboard shortcuts

Mind Elixir's built-in keymap is kept as-is (`keypress: true`). The table mirrors `MINDMAP_BUILTIN_KEYS` in `lib/mindmap-keymap.ts`:

| Key | Action |
|---|---|
| Tab | Add child |
| Enter / Shift+Enter | Add sibling after / before |
| Mod+Enter | Insert parent |
| F2 or double-click | Edit topic |
| Delete / Backspace | Remove node |
| Arrow keys | Select previous / next / left / right |
| Alt+ArrowUp / Alt+ArrowDown, PageUp / PageDown | Move node up / down among siblings |
| Mod+ArrowLeft / Mod+ArrowRight / Mod+ArrowUp | Layout: all left / all right / both sides |
| F1 | Center map |
| Mod+= / Mod+- / Mod+0 | Zoom in / out / reset |
| Mod+K, then 0 / = / 1–9 | Collapse all / expand all / expand to level |
| Mod+Z / Mod+Shift+Z / Mod+Y | Undo / redo / redo |
| Mod+C / Mod+X / Mod+V | Copy / cut / paste subtree |

Expand all / collapse all are covered by the Mod+K chord, so no separate SoloMD actions exist for them.

SoloMD adds its own actions to `lib/keybindings.ts` (category `mindmap`), so they are rebindable and listed in Settings. Command-palette entries for them arrive in Phase 4 (Map UI).
They fire only while a `MindmapView` has focus; while it does, they shadow global chords on the same keys (no effect elsewhere). Settings rejects mindmap rebinds onto built-in keys above.

| Action id | Default | Phase |
|---|---|---|
| `mindmap.toggleNode` | Space | 1 |
| `mindmap.fit` | Mod+Alt+0 | 1 |
| `mindmap.focusRoot` | Home | 1 |
| `mindmap.shortcutHelp` | Shift+Slash (`?`) | 1 |
| `mindmap.toggleReadOnly` | Mod+Shift+R | 4 |
| `mindmap.copyPlaintext` | Mod+Shift+C | 4 |
| `mindmap.export` | Mod+Shift+E | 4 |
| `mindmap.createGate` / `mindmap.followGate` / `mindmap.back` | Mod+G / Alt+Enter / Alt+← | 4 |
| `mindmap.convertDocument` | Mod+Shift+M (in markdown tabs) | 5 |

Defaults that clash with existing SoloMD bindings are reassigned during implementation and recorded here.
`?` opens a cheat-sheet overlay listing both tables with the user's current bindings.

### Out of scope for Phase 1

Export, gates, conversion, fences, `.xmind`.

## Phase 2 — XMind

- `.xmind` is read with `read_binary_file` and `@mind-elixir/import-xmind`.
- `@mind-elixir/export-xmind` was rejected (lossy round-trip, peer range core 2–3). Saving an imported `.xmind` tab opens Save As at the sibling `.mmap`; `.xmind` write targets are refused.
- Only the first sheet is imported (warning toast names the rest); markers and floating topics are dropped.
- Inputs are capped (50 MB file, 20 MB declared content) and node `style` is allowlisted.
- The tab tracks its source format so save chooses the right writer.

## Phase 3 — Markdown render

**Completed 12-10-26 (v4.14.11). All 79 targeted lib tests pass.**

### Infrastructure (Task 1)

- `lib/fence-scan.ts`: CommonMark-compliant scanner returning every fenced block with start/end offsets, info string, and dedented body.
- `lib/mindmap-fence.ts`: codec wrapping `plaintextConverter`, `findMindmapFences()`, and guarded `replaceMindmapFence()` (source line + body guard).
- `lib/mindmap-format.ts`: extended with `MindmapCodec` interface and `mmapCodec(fileName)`.

### Language Registration (Task 2)

- `SPECIAL_FENCES` in `lib/fence-languages.ts` includes `mindmap`; `markdown.ts` fence skip list updated so the fence body is not wrapped in a code block.

### Preview Read-Only Map (Task 3)

- `lib/mindmap-readonly.ts`: mounts a read-only Mind Elixir instance on a DOM element; supports live theme switching and `destroy()`.
- `Preview.vue`: `processMindmaps()` at its three call sites; theme watch; teardown on unmount. Each fence block has an "Open fullscreen" button.

### MindmapCanvas Extraction (Task 4)

- `MindmapCanvas.vue`: codec-driven canvas extracted from `MindmapView.vue`; driven by `content` + `codec` props; emits `update:content` on edit (debounced 300 ms).
- `MindmapView.vue` is now a thin tab wrapper around `MindmapCanvas`.

### Fullscreen Fence Editor (Task 5)

- `MindmapFenceOverlay.vue`: fullscreen editor for one fence; guarded debounced writeback via `replaceMindmapFence` with a toast on abort.
- Mounted in `App.vue`; opened via `solomd:mindmap-open` event carrying the fence index and body.
- Ids meaning `[^ref]` anchors: node ids are regenerated on every parse; only `[^ref]` refs survive `plaintextConverter` round-trips, keeping cross-references stable across edits.

### Live CodeMirror Widget (Task 6)

- `cm-live-blocks.ts`: `MindmapWidget` renders an interactive preview inline in the editor; cursor entering the fence shows source, cursor leaving collapses to the map.

### Decisions

| Topic | Decision |
|---|---|
| Plugin fit | Neither `remark-mindmap` 0.2.0 nor `rehype-mind-elixir` 1.0.0-beta.1 adopted (wrong pipeline, wrong core version) |
| Core used | `mind-elixir/plaintextConverter` 5.15.1 |
| Fence to editor match | Opening-fence source line plus body guard: same line and body first, then unique-body fallback, then abort. Preview, live widget and writeback share one scanner (`findMindmapFences`); fences it does not find (blockquotes, 4+ space indent) render view-only |
| Write timing | Debounced 300 ms (`SYNC_DEBOUNCE_MS`) |
| Ids meaning | `[^ref]` anchors stable across plaintext round-trips; node ids are transient |
| Preview open | "Open fullscreen" button, not a whole-map click (drag pans, a plain click would open on pan) |

## Phase 4 — Map UI

- Export: PNG, SVG, HTML, JSON, Markdown via `@mind-elixir/export-mindmap`; files written through Tauri, not browser downloads.
- Copy as plaintext; map→markdown headings document.
- Jump to source: nodes created from markdown keep the source path and line; clicking opens it.
- Read-only toggle.
- Command palette lists every `mindmap.*` action.
- Gates (same map only):
  - A gate is a leaf that stores a target node id; its label reads the target's topic live.
  - `before.addChild` and drag/paste guards keep gates childless. A gate cannot target another gate.
  - Activating a gate focuses its target; Alt+← returns. A deleted target marks the gate broken with Repair/Remove.
  - Storage: a custom `gate` field if `getData()` preserves it, else `hyperLink: "mmap:node/<id>"`.
  - Fence syntax: `- => <id>`, converted by a wrapper around `plaintextConverter`.
  - Duplicate finder hashes subtrees; "Merge into gate" unions children into the kept copy and replaces the duplicate with a gate.
  - Graph view draws gate arrows; export as Mermaid `graph LR` and JSON adjacency.

## Phase 5 — Convert md→mindmap

| ebook-to-mindmap | SoloMD |
|---|---|
| Book | Folder of `.md` files |
| Chapter | `.md` file or heading section |
| TOC | `extractOutline()` |
| AI provider | Existing `ai-providers.ts`, keychain keys, streaming `ai_rewrite` |

- Structural conversion: headings become branches, lists become leaves; offline and instant.
- AI conversion: reuse the ebook-to-mindmap plaintext prompt (summaries `}:N`, arrows, quotes node); stream with a 500 ms partial render.
- Scope: selection, section, document, folder. Folder maps merge per-file maps under one root, prefixing ids per file and keeping arrows.
- Folder options: chapter picker, whole-word skip keywords, grouping files into one unit.
- Output: a new `.mmap` or an inserted fence. The `.mmap` stores a source hash plus model, prompt, and language; a mismatch offers Regenerate.
- Commands registered in `useCommands.ts` with i18n keys under `cmd.*`.

### Not adopted from ebook-to-mindmap

Hosted paid model, login and wallet, fiction character graphs, "open in Mind Elixir desktop", cache-manager page.

## Testing

- `node:test` units per phase: format round-trip and validation, xmind import fixture, fence find/replace, plaintext gate wrapper, subtree hashing, structural conversion.
- `vue-tsc` and `vite build` must pass.
- Browser check per phase in the Vite dev server; desktop check in the Tauri build at phase end.
