# features/find/

In-editor find (CodeMirror branch). Copied from `Editor.vue`; Editor keeps its copy until PR-8.

| Item | Value |
|---|---|
| Slot | `search` (static): `search({ top, createPanel: createFindPanel(filePath) })` + `incrementalFindScroll` |
| Command | `openFind` (focus view, open search panel) |
| Settings / i18n | none |

## Files

- `contracts/find.feature.ts` — `createFindFeature()`
- `internal/incremental-find.ts` — `firstMatch`, `incrementalFindScroll` (scroll to first match while typing)

## Tests

`node --test 'src/features/find/**/*.test.ts'` — `firstMatch` (nearest, wrap, none); manifest; `search` slot builds; `openFind` without a view is a no-op.

The plain engine has its own find bar: `features/editor/internal/plain/usePlainFind.ts`.
