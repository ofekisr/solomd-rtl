# Mindmap Workbench, Merge & Map Paste — Design

Date: 2026-10-21 · Status: approved

## Goal

| # | Capability |
|---|---|
| G1 | Merge 2+ mind maps into a **new saved file**: new root, one child per source map |
| G2 | Bind another map (file or clipboard) into the current map at the selected node; default target = root |
| G3 | A **workbench**: a persistent collection of maps/subtrees to select and run actions on |

## Non-goals

- Live links between maps (entries are copies, not references)
- Multiple roots per `.mmap` (format has a single `nodeData` root)
- Merging source themes/snippets (merged file uses defaults)

## Existing building blocks

| Piece | File | Role |
|---|---|---|
| `mergeMindmaps`, `prefixMindmapIds` | `app/src/lib/mindmap-merge.ts` | N maps → one root, `fNN-` id prefixes, arrows/summaries/gates kept |
| `parsePaste`, `payloadOf` | `app/src/lib/mindmap-paste.ts` | Clipboard text → `PastePayload` (mmap/json/markdown/plaintext) |
| `buildIdMap`, `remap*` | `app/src/lib/mindmap-paste-remap.ts` | Rewire gates/arrows/summaries after insert |
| `insertPayload`, `pasteTarget` | `app/src/components/MindmapCanvas.vue:629-664` | Graft payload under a node |
| `serializeMindmap` | `app/src/lib/mindmap-format.ts:84` | Map → `.mmap` envelope text |
| Folder → Map dialog | `app/src/components/MindmapConvertFolder.vue` | Dialog + save pattern to follow |

## Design

### 1. Shared insert path — `lib/mindmap-insert.ts` (new)

- Extract `insertPayload` + target resolution out of `MindmapCanvas.vue`.
- `resolveInsertTarget(mind, mode)`: `mode = 'selected' | 'root'`.
  - `selected` with no selection → root.
  - Gate node → refuse with existing `mindmap.gateCannotHoldChildren` toast.
- Used by ⌘V, *Paste map*, *Insert map from file*.
- **Undo:** one insert = one undo step (nodes + arrows + summaries). Today `copyNodes`, each `createArrowFrom` and each `createSummaryFrom` may record separate operations → verify, and batch via `mindmap-batch.ts` if so.

### 2. Map payloads — `lib/mindmap-payload.ts` (new)

| Function | Input → Output |
|---|---|
| `fileMapPayload(text)` | `.mmap` text → `PastePayload` (whole map, root included) |
| `subtreePayload(data, nodeIds)` | Selected subtrees + arrows/summaries fully inside them → `MindElixirData` (single selection = its root; multi = synthetic root) |
| `copyMapText(data)` | `MindElixirData` → `serializeMindmap` envelope text for clipboard |

### 3. Workbench store — `stores/mindmapWorkbench.ts` (new, Pinia)

```ts
type WorkbenchEntry =
  | { id: string; kind: 'file'; path: string; label: string; selected: boolean }
  | { id: string; kind: 'nodes'; sourcePath: string; nodeIds: string[]; label: string;
      snapshot: MindElixirData; capturedAt: string; selected: boolean };
```

- Persisted to localStorage, validated with type guards on load (drop invalid entries); app has no zod.
- New entry → `selected: true`; afterwards each entry's selection is preserved.
- Identity: file = `path`; nodes = `sourcePath + sorted nodeIds`.
- **Re-add of an existing identity → update in place** (refresh snapshot, keep selection), toast "Workbench entry updated".
- Not part of undo/redo.

**Content resolution at action time** (`resolveEntry(entry)`):

| Kind | Source |
|---|---|
| `file` | Open tab buffer if the file is open (includes unsaved edits), else disk |
| `nodes` | `snapshot` |

**Staleness for `nodes` entries:**
- On workbench open, re-extract the subtree from source (tab buffer or disk) and compare to `snapshot`.
- States: `fresh` · `stale` (source changed) · `missing` (file or nodes gone).
- **Refresh selected** button re-captures stale entries; missing ones stay with a badge.

### 4. Workbench form — `components/MindmapWorkbench.vue` (new, modal form)

- Rows: checkbox, label, kind icon, status badge (`stale` / `missing`).
- Header: select all / none, count `3 of 5 selected`.
- Buttons:

| Button | Action |
|---|---|
| Add map… | File picker (`.mmap`, multi) → add file entries |
| Remove selected | Remove checked entries |
| Refresh selected | Re-capture snapshots of checked `nodes` entries |
| Merge selected… | Needs ≥2 resolvable entries; root topic input (default `A + B` / `N maps`) → `mergeMindmaps` → save dialog → write file → open tab |

- Missing entries are skipped by Merge with a toast listing them.
- Opened via command palette / menu → **adds nothing**.

### 5. Context menus

Surfaces: file explorer (`.mmap` only), canvas background (whole map), selected node(s).

| Item | Behaviour |
|---|---|
| Add to workbench / Remove from workbench | Toggles by identity (label flips) |
| Open workbench | Opens form; auto-adds the clicked item if absent |
| Copy map | Whole map (file/background) or selected subtrees → clipboard envelope |
| Paste map | Same flow as ⌘V (§6); disabled on file explorer |

Unsaved map (no path): file-kind add disabled; node entries use `sourcePath = tab id` and become `missing` once the tab closes.

### 6. ⌘V with a whole map on the clipboard

- Trigger: `parsePaste` result `format === 'mmap'` (envelope text, as produced by Copy map). Other formats keep current behaviour, no dialog.
- Nothing selected → root, no dialog.
- Otherwise dialog: **Into selected node** · **Into root** · ☐ Remember my choice.
- Setting `mindmapPasteMapTarget: 'ask' | 'selected' | 'root'` (default `ask`) in Settings → Mindmap, with **Reset to ask**.

### 7. MCP tools — last phase (`mcp-mindmap/src/tools/write.ts`)

| Tool | Args | Result |
|---|---|---|
| `mmap_merge` | `files[]`, `out`, `rootTopic?` | New file written; refuses to overwrite existing `out` |
| `mmap_graft` | `target`, `source`, `nodeId?` (default root) | Source map inserted under node; ids remapped |

Both reuse `app/src/lib` functions.

## Error handling

| Case | Behaviour |
|---|---|
| File unreadable / invalid `.mmap` | Toast with file name; entry badge `missing` |
| Merge with <2 resolvable entries | Button disabled; tooltip explains |
| Save dialog cancelled | No-op |
| Paste into gate node | Existing gate toast |
| Corrupt localStorage | Type guards drop bad entries; workbench starts empty if root invalid |

## Testing

| Layer | Cases |
|---|---|
| Unit (`vitest`) | target resolution (selected / none → root / gate); `subtreePayload` keeps internal arrows only; store add / re-add-updates / remove / selection persistence / Zod load; staleness states; merge of N maps with colliding ids |
| Undo | One insert → one `mind.undo()` restores prior data |
| MCP | `mmap_merge` / `mmap_graft` round-trip, overwrite refusal |
| Browser (:1420) | Add 2 maps via context menu → merge → saved file opens; ⌘V dialog + remember + reset |

## Phases

| # | Phase | Est. |
|---|---|---|
| 1 | Shared insert path, root fallback, single undo step | 2h |
| 2 | Payload helpers + workbench store (+ staleness) | 3h |
| 3 | Workbench form + merge → save | 3h |
| 4 | Context menus on 3 surfaces | 3h |
| 5 | ⌘V dialog + setting | 2h |
| 6 | MCP tools | 2h |
| 7 | Browser verification | 1h |
