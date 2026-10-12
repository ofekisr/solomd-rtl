# Mindmap Support Design

## Status

Approved in conversation on 11-10-26. Branch: `feat/mindmap`.

| Phase | State |
|---|---|
| 1 `.mmap` file support | ✅ Done 11-10-26 (`4.14.9`) — plan `docs/superpowers/plans/2026-10-11-mindmap-phase1-mmap.md` |
| 2 XMind | ✅ Done 11-10-26 (`4.14.10`) — plan `docs/superpowers/plans/2026-10-11-mindmap-phase2-xmind.md` |
| 3 Markdown render | ✅ Done 12-10-26 (`4.14.11`) — plan `docs/superpowers/plans/2026-10-11-mindmap-phase3-fence.md` |
| 4 Map UI | ✅ Done 12-10-26 (`4.14.12`) — plan `docs/superpowers/plans/2026-10-11-mindmap-phase4-map-ui.md` |
| 5 Convert md→mindmap (structural) | ✅ Done 12-10-26 (`4.14.13`) — plan `docs/superpowers/plans/2026-10-12-mindmap-phase5-convert.md` |
| 6 Convert md→mindmap (AI) | Ready to start (after `4.15.0`, target next patch after `4.15.1`) — handoff `docs/superpowers/plans/2026-10-12-mindmap-phase6-handoff.md` |
| 7 Views, toolbar, node panel, XMind dedupe | ✅ Done 12-10-26 (`4.15.1`) — plan `docs/superpowers/plans/2026-10-12-mindmap-phase7-views-panel.md` |
| 8 App features outside the package | Deferred — `docs/superpowers/specs/2026-10-12-mindmap-phase8-app-features-design.md` |

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
| `@mind-elixir/export-mindmap` | `0.1.11` | PNG, HTML (escaped), JSON, Markdown; SVG via core `exportSvg` + DOMPurify |
| `@mind-elixir/export-xmind` | `2.0.1` | Rejected in Phase 2: lossy round-trip, peer range core 2–3 (last published 2023) |

## Phases

| # | Phase | Outcome |
|---|---|---|
| 1 | `.mmap` file support | Open, edit, save `.mmap` as an XMind-like map |
| 2 | XMind | Open `.xmind` as an imported map; saves go to a sibling `.mmap` (Save As), `.xmind` is never written |
| 3 | Markdown render | ```` ```mindmap ```` fences render in preview and write edits back |
| 4 | Map UI | Export, copy plaintext, map→markdown, jump to source, read-only toggle, gates, palette commands |
| 5 | Convert md→mindmap (structural) | Offline conversion of a selection, section, document, or folder to a `.mmap` or fence |
| 6 | Convert md→mindmap (AI) | AI conversion with streaming render, provenance, and Regenerate |

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

### Decisions

| Topic | Decision |
|---|---|
| Gate storage | `node.metadata.gate` (`getData()` preserves `metadata`); merged into `metadata`, never replacing `refId` |
| HTML export | Package inlines `JSON.stringify(data)` unescaped; `buildHtmlExport` re-escapes that substring (`<`, `>`, `&`, U+2028/2029) |
| SVG export | Core `exportSvg` through DOMPurify (`foreignobject` integration point): labels survive, scripts never |
| Palette | Commands reach the focused map through the `mindmap-active` registry; palette-only actions use `defaults: []` |
| Merge | Merge into gate is not undoable; undo history is cleared after it |

## Phase 5 — Convert md→mindmap (structural)

Offline, instant conversion of a selection, section, document, or folder. Headings become branches, lists become leaves.

| ebook-to-mindmap | SoloMD |
|---|---|
| Book | Folder of `.md` files |
| Chapter | `.md` file or heading section |
| TOC | Heading structure (scanner in `lib/mindmap-md-scan.ts`) |

### Structural rules

Markdown conventions follow `epub-builder` (`~/scripts/epub-builder/docs/writing-guide.md`).

| Input | Map result |
|---|---|
| Code fence (backtick or tilde, any indent; closes on a same-char marker at least as long) | Skipped; nothing inside is parsed |
| Front matter (document start only), HTML comments, `<!-- epub: … -->` directives, `:::` fenced-div marker lines, tables | Skipped (fenced-div content is parsed normally) |
| Heading `^ {0,3}#{1,6}\s+…` | Branch under the nearest open heading of lower level; trailing `{…}` attribute block stripped; attribute-only headings dropped |
| List item (`-`, `*`, `+`, `1.`, `1)`) | Node under the current heading or parent item; nesting by indent |
| Task item `[ ]` / `[x]` | Topic prefixed `☐ ` / `☑ ` |
| Paragraph, blockquote, `[text]{.subheading}`, list continuation text | Appended to the owning node's `note` (plain text, blank-line separated); indented continuation goes to the nearest shallower open item |
| Inline markup | Links, images, `**`, `__`, `~~`, backticks and footnote refs `[^n]` stripped; leading `>`, `=>`, `}…` removed so fence output stays plain nodes |
| Root | A sole top-level heading (any level, no text before it) is lifted to root; else the file stem (document, section) or `Selection` |

- Every node gets `metadata.source = { path?, line }`; `path` is workspace-relative and omitted when no workspace is open or the file is unsaved.
- Node ids match `[\w-]+`: `n<k>` per conversion; folder merge prefixes `f<NN>-` per file, groups get `g<NN>`, and arrow `from`/`to`, summary `parent`, `metadata.refId` and `metadata.gate.target` are rewritten (generic, reused by Phase 6).

### Folder conversion

- Files: `.md` / `.markdown` under the chosen folder (default: workspace root), recursive, ordered lexically by relative path; dot-folders and `node_modules` skipped; first 500 files.
- Dialog: per-file checkbox (chapter picker); whole-word, case-insensitive skip keywords matched against file stem and title; files with `<!-- epub: skip=true -->` start unchecked; "Group by subfolder" puts each subfolder's files under one unit node.
- Per-file node and dialog title: the same lift rule as a document. Root: the folder name.
- Limits: files over 2 MiB (bytes) are skipped with a note; over 5000 nodes the dialog asks for an inline confirm.

### Output and commands

| Action | Default | Output |
|---|---|---|
| `mindmap.convertDocument` | Mod+Alt+Shift+M (Mod+Shift+M is `fmt.code`, Mod+Alt+M is `editor.formulaEditor`) | New unsaved `.mmap` tab, `fileName` from `mmapPathFor` |
| `mindmap.convertSection`, `mindmap.convertSelection` | none | New unsaved `.mmap` tab |
| `mindmap.insertFenceFromSection`, `mindmap.insertFenceFromSelection` | none | ```` ```mindmap ```` fence inserted after the section / selection (moved past an open code fence) |
| `mindmap.convertFolder` | none | Folder dialog, then a new unsaved `.mmap` tab |

- Actions use `category: 'tools'`, global scope: they act on markdown tabs, and `category: 'mindmap'` would route them through the active-map registry.
- The editor flushes its pending content before a conversion reads it.
- Fence output carries no `metadata.source` or notes; jump uses the existing fence line mapping.
- Every converted map passes through `sanitizeMindmapData` before it reaches a tab or fence.

### Carry-overs from Phase 4

- `readNodeSource` rejects absolute paths, drive letters, schemes, backslashes, and `.`/`..` segments; `jumpTo` resolves the path against the workspace root, opens only `.md`/`.markdown`, does not reveal in the file tree, and dispatches goto only when the opened tab matches.
- A pathless source in `MindmapView` shows a toast instead of targeting a hidden editor.
- Orphaned-gate fallback and gate refs validated against `[\w-]+`.
- Tests: gate controller (with a `MindElixirInstance` fake), capture-phase key dispatch (`lib/mindmap-key-dispatch.ts`).

## Phase 6 — Convert md→mindmap (AI)

| ebook-to-mindmap | SoloMD |
|---|---|
| AI provider | Existing `ai-providers.ts`, keychain keys, streaming `ai_rewrite` |

- AI conversion: reuse the ebook-to-mindmap plaintext prompt (summaries `}:N`, arrows, quotes node); stream with a 500 ms partial render.
- Same scopes, folder merge, and outputs as Phase 5; reuses its scanner, merge (`prefixMindmapIds`, `mergeMindmaps`), folder dialog, and commands pattern.
- Provenance: the `.mmap` stores a source hash plus model, prompt, and language; a mismatch offers Regenerate.
- Commands registered in `useCommands.ts` with i18n keys under `cmd.*`.
- Open decisions are listed in the Phase 6 handoff.

### Not adopted from ebook-to-mindmap

Hosted paid model, login and wallet, fiction character graphs, "open in Mind Elixir desktop", cache-manager page.

## Testing

- `node:test` units per phase: format round-trip and validation, xmind import fixture, fence find/replace, plaintext gate wrapper, subtree hashing, structural conversion.
- `vue-tsc` and `vite build` must pass.
- Browser check per phase in the Vite dev server; desktop check in the Tauri build at phase end.
