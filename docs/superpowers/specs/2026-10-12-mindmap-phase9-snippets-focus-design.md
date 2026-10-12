# Mindmap Phase 9 — Snippets, Freeze + Focus, Paste Import

## Status

Approved in conversation on 12-10-26. Starts after Phase 8 merges. Base: Phase 8 (`2026-10-12-mindmap-phase8-lens-design.md`).
Parent design: `docs/superpowers/specs/2026-10-11-mindmap-design.md`. Unscheduled work: `2026-10-12-mindmap-follow-ups.md`.

## Purpose

- A `.mmap` holds code snippets (Markdown, Mermaid, nested maps) beside the map, the way a `.md` file holds fences.
- Walking a big map keeps the root and level 2 always visible, like frozen table headers, while any deeper node acts as the canvas root.
- Cmd+V on a map imports structured text (map JSON, mindmap plaintext, Markdown, indented outlines) as nodes. Today only Mind Elixir's own copy format pastes.

## Scope

| § | Area | Outcome | Est. |
|---|---|---|---|
| 1 | Snippets | `snippets` key in the file; rendered and edited per lens × view cell | ~1.5 days |
| 2 | Freeze + focus | Frozen strip above the canvas; focus any node as root | ~1 day |
| 3 | Paste import | Cmd+V parses common formats into a subtree | ~1 day |

Out of scope: rich `text/html` or image paste, node → snippet references, snippets referencing other files by path, configurable freeze depth, saving focus in the file.

## 1. Snippets

### Format

- Optional top-level key next to `data`: `snippets: Snippet[]`. File version stays `1`; a file without snippets is byte-identical to today.
- `Snippet = { id: string, kind: 'md' | 'mermaid' | 'mmap', title: string, body: string }`.
- `id` matches `[\w-]+`, unique within the file. Duplicate or invalid ids are regenerated on parse.
- `mmap` body: inline map data in the ` ```mindmap ` fence shape; parsed and sanitized with the existing fence path.
- Parse-and-validate at the file boundary: unknown `kind` → dropped with a warning; non-string fields → dropped. Never fails the whole file.
- Snippets are map-level only. Nodes do not reference them.

### Cells

Rendering follows the Phase 8 lens matrix:

| View | Data | Map | Doc |
|---|---|---|---|
| ✏️ Edit | JSON (`snippets` editable) | Outline Markdown 🔒 incl. `## Snippets` | same |
| ◫ Split | JSON ‖ Map + snippet panel | Map + panel ‖ Outline preview incl. snippets | Outline Markdown 🔒 ‖ preview |
| 📝 Live edit | Map + panel, cards editable | Map + panel, cards editable | Outline preview incl. snippets 🔒 |
| 👁 Preview | Outline preview incl. snippets | same | same |
| 📖 Reading | Wide map + panel, read-only | same | Outline reading incl. snippets |

🔒 becomes editable with follow-ups item 1; snippets then round-trip as fences under `## Snippets`.

### Snippet panel

- Sits under the canvas (phase 1 layout); collapsible, remembers collapsed state per tab.
- One card per snippet: title, kind badge, rendered body.
- Renderers: `md` → existing Preview pipeline; `mermaid` → existing Mermaid renderer; `mmap` → small read-only `MindmapCanvas` with an expand button.
- Live edit cells only: ✏️ toggles a card between rendered and a code editor (Esc or blur renders); header actions add, rename, delete, reorder. Edits go through undo and dirty state like map edits.
- Read-only toggle on → cards render only.

### Outline Markdown

- `mapToHeadingsMarkdown` appends `## Snippets`, then per snippet `### <title>` and a fence (`md` → ` ```markdown `, `mermaid` → ` ```mermaid `, `mmap` → ` ```mindmap `).
- Markdown and HTML exports include the section. PNG/SVG export the canvas only.

## 2. Freeze + focus

### Focus

- Uses the package's `mind.focusNode(node)` / `mind.cancelFocus()` (commands `mindmap.focusNode`, `mindmap.cancelFocus` already registered, no default keys).
- Entry points: palette, node context menu, side panel button, frozen-strip chips.

### Frozen strip

Pinned above the canvas, shown only when the map has level-2 nodes.

| Row | Content |
|---|---|
| 1 | Root topic |
| 2 | Every level-2 node as a chip; the one containing the focus is highlighted |
| 3 | Breadcrumb from level 3 down to the focused node (hidden when focus ≤ level 2) |

- Chips show topic, icons, tags and the node's colors. Children are never shown.
- Clicking a chip focuses that node; clicking the root cancels focus.
- Labels update live on topic edits; a deleted focused node cancels focus.
- `dir="auto"` per chip; breadcrumb separator flips for RTL.

### State

- View-only: map renderer cells only, never in the `.mmap`, never marks the file dirty.
- `focusId` held in the tab's in-memory state: survives lens and view switches, resets on app restart.
- Not shown in Doc or Data cells.

## 3. Paste import

### Today (baseline)

- Mind Elixir's own clipboard JSON (`magic: "MIND-ELIXIR-WAIT-COPY"`) pastes as children of the selected node.
- Anything else is ignored: the app sets no `pasteHandler`.
- Pasting into a read-only or locked map is already blocked (Phase 8 §6).

### Detection

Mind Elixir's own format is handled by the package first. Otherwise `pasteHandler` reads `text/plain` and tries, in order; first clean parse wins:

| # | Format | Detect | Parser |
|---|---|---|---|
| 1 | `.mmap` envelope | JSON with `format: "solomd-mindmap"` | `parseMindmap` |
| 2 | Map data / node / node array | JSON with `nodeData`, or `topic`, or an array of objects with `topic` | `sanitizeMindmapData` / `sanitizeNodeObj` |
| 3 | Mindmap plaintext | Non-empty lines start with `- ` (any indent) | `parseMindmapFence` + `attachGatesFromTopics` |
| 4 | Markdown | ATX headings or list items | `markdownToMindmap` |
| 5 | Indented outline (XMind copy, OPML-style) | ≥ 2 non-empty lines with consistent tab or space indent | Normalize to `- ` lines → #3 |
| 6 | Single line | One non-empty line | One child node, topic = the line |

Spike before planning: confirm what XMind puts on the clipboard (`text/plain` tab-indented assumed).

### Insert

- Target: the selected node. No selection → toast "Select a node to paste into", no change.
- Root handling: the parsed root becomes one child of the target, so the whole tree hangs as a single subtree. Synthetic roots (`MINDMAP_FENCE_ROOT_TOPIC`, `SELECTION_ROOT_TOPIC`) are dropped; their children insert directly.
- All ids are regenerated; arrows, summaries and gate targets inside the pasted block are remapped by the Phase 5 merge rewriter. Gates pointing outside the block stay as-is (broken if absent).
- Insert goes through `copyNodes`: one undo step, gate guard applies (gate target → toast, no change).
- Read-only, locked, graph view or parse error → no change.
- Input larger than `MAX_MINDMAP_FENCE_CHARS` → toast, no change.
- Nothing parses → toast "Clipboard format not recognized".
- Editing a topic (`#input-box`) keeps the native plain-text paste.

## Testing

| Area | Tests |
|---|---|
| Format | Unit: round-trip with and without snippets; file without snippets unchanged; invalid kind/ids/fields dropped or regenerated; `mmap` body sanitized |
| Outline | Unit: `## Snippets` section, fence per kind, titles |
| Panel | Browser: cards per kind; inline edit in Live edit only; add/rename/delete/reorder; undo; read-only |
| Paste | Unit: detection order per format, root handling (real vs synthetic root), id/arrow/summary/gate remap, size cap. Browser: each format pastes as one undo step; read-only/locked/gate target/no selection make no change; topic edit box pastes plain text |
| Focus | Unit: strip model (rows from map + focusId, deleted focus). Browser: chip focus, root cancel, breadcrumb, lens switch keeps focus, RTL |

Desktop (Tauri) check before merge.
