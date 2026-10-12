# Mindmap Phase 8 — App Features Outside the Package

## Status

Deferred. Scoped in conversation on 12-10-26; not yet designed in detail.
Starts after Phase 7 (`docs/superpowers/specs/2026-10-12-mindmap-phase7-views-panel-design.md`).
Each item below needs its own brainstorming pass before a plan.

## Purpose

The Mind Elixir desktop app ships features that are not in the `mind-elixir` npm package.
SoloMD must build these itself. Phase 8 collects them so Phase 7 stays small.

## Candidates

| # | Feature | Notes | Est. |
|---|---|---|---|
| 1 | In-map search | Walk `getData()`, then `selectNode` + `scrollIntoView`; next/previous; RTL-aware matching | ~3 h |
| 2 | Outline tree view (§3.2) | Replaces Phase 7's read-only Markdown outline with a Vue tree over `nodeData`; collapsible, click selects the node in Map | ~1 day |
| 3 | Editable outline | Edits in the outline write back to the map; must preserve styles, gates, arrows, summaries | ~2–3 days |
| 4 | Image tab | Package renders `image`; needs a file picker and asset storage next to the `.mmap`; sanitizer already allows only safe URLs | ~1 day |
| 5 | Minimap | Not in the package | ~1–2 days |
| 6 | XMind re-import | When `foo.xmind` is newer than `foo.mmap`, offer re-import (replace or merge) | ~½ day |
| 7 | Map + Source split view | Side-by-side canvas and JSON | ~½ day |

AI Create is Phase 6 (`docs/superpowers/plans/2026-10-12-mindmap-phase6-handoff.md`), not Phase 8.

## Open questions

- Outline tree (2) vs editable outline (3): ship 2 first, or go straight to 3?
- Image storage: sibling `assets/` folder, or embed as data URIs inside the `.mmap`?
- Minimap: keep it, or drop it given the package's fit and center controls?
