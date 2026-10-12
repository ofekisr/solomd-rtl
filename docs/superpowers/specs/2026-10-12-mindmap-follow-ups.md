# Mindmap Follow-ups

## Status

Unscheduled backlog. No phase number until an item is picked up; each item gets its own brainstorming pass before a plan.
Fed by Phase 7 (`2026-10-12-mindmap-phase7-views-panel-design.md`) and Phase 8 (`2026-10-12-mindmap-phase8-lens-design.md`).

## Purpose

Work that cannot ship right away: it needs Markdown → map round-tripping, or the Mind Elixir desktop app has it but the `mind-elixir` npm package does not.

## Lens matrix — target cells

Phase 8 ships the lens (Data · Map · Doc) with every cell working, but the cells marked 🔒 render read-only.
The target state makes them editable:

| View | Data | Map | Doc |
|---|---|---|---|
| ✏️ Edit | Raw JSON | Raw outline Markdown ✏️ | Raw outline Markdown ✏️ |
| ◫ Split | Raw JSON ‖ Map | Map ‖ Outline preview | Raw outline Markdown ✏️ ‖ Outline preview |
| 📝 Live edit | Map | Map | Markdown live edit ✏️ |
| 👁 Preview | Outline preview | Outline preview | Outline preview |
| 📖 Reading | Wide map | Wide map | Markdown reading |

✏️ = editable here, Phase 8 shows it read-only. All four depend on item 1 below.

## Candidates

| # | Feature | Notes | Est. |
|---|---|---|---|
| 1 | Editable outline | Markdown outline edits write back to the map; must preserve styles, icons, tags, notes, gates, arrows, summaries (e.g. id markers). Unlocks the ✏️ cells above | ~3–4 days |
| 2 | In-map search | Walk `getData()`, then `selectNode` + `scrollIntoView`; next/previous; RTL-aware matching | ~3 h |
| 3 | Outline tree view | Vue tree over `nodeData` as an alternative outline; collapsible, click selects the node in the map | ~1 day |
| 4 | Image tab | Package renders `image`; needs a file picker and asset storage next to the `.mmap`; sanitizer already allows only safe URLs | ~1 day |
| 5 | Minimap | Not in the package | ~1–2 days |
| 6 | XMind re-import | When `foo.xmind` is newer than `foo.mmap`, offer re-import (replace or merge) | ~½ day |
| 7 | Custom map theme | Pick branch palette, background, root and main colors beyond Phase 8's presets | ~1 day |

AI Create is Phase 6 (`docs/superpowers/plans/2026-10-12-mindmap-phase6-handoff.md`).

## Open questions

- Editable outline (1): id markers in the Markdown, or match by position and topic?
- Image storage: sibling `assets/` folder, or data URIs inside the `.mmap`?
- Minimap: keep it, or drop it given Phase 8's Fit and Root buttons?
