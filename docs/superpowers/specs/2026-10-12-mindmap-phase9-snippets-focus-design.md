# Mindmap Phase 9 — Snippets, Freeze + Focus

## Status

Approved in conversation on 12-10-26. Starts after Phase 8 merges. Base: Phase 8 (`2026-10-12-mindmap-phase8-lens-design.md`).
Parent design: `docs/superpowers/specs/2026-10-11-mindmap-design.md`. Unscheduled work: `2026-10-12-mindmap-follow-ups.md`.

## Purpose

- A `.mmap` holds code snippets (Markdown, Mermaid, nested maps) beside the map, the way a `.md` file holds fences.
- Walking a big map keeps the root and level 2 always visible, like frozen table headers, while any deeper node acts as the canvas root.

## Scope

| § | Area | Outcome | Est. |
|---|---|---|---|
| 1 | Snippets | `snippets` key in the file; rendered and edited per lens × view cell | ~1.5 days |
| 2 | Freeze + focus | Frozen strip above the canvas; focus any node as root | ~1 day |

Out of scope: node → snippet references, snippets referencing other files by path, configurable freeze depth, saving focus in the file.

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

## Testing

| Area | Tests |
|---|---|
| Format | Unit: round-trip with and without snippets; file without snippets unchanged; invalid kind/ids/fields dropped or regenerated; `mmap` body sanitized |
| Outline | Unit: `## Snippets` section, fence per kind, titles |
| Panel | Browser: cards per kind; inline edit in Live edit only; add/rename/delete/reorder; undo; read-only |
| Focus | Unit: strip model (rows from map + focusId, deleted focus). Browser: chip focus, root cancel, breadcrumb, lens switch keeps focus, RTL |

Desktop (Tauri) check before merge.
