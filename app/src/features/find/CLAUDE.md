# features/find/

In-editor find (CodeMirror branch).
Consumed by: `shell/editor-registry.service.ts` (`EDITOR_FEATURE_FACTORIES`), provided to `editor/ui/Editor.vue` by `App.vue` through `EDITOR_REGISTRY_FACTORY`.

| Item | Value |
|---|---|
| Slot | `search` (static): `search({ top, createPanel: createFindPanel(filePath) })` + `incrementalFindScroll` |
| Command | `openFind` (focus view, open search panel) |
| Settings / i18n | none |

## Files

- `contracts/find.feature.ts` — `createFindFeature()`
- `internal/cm-find-panel.ts` — `createFindPanel(filePath)` (moved from `lib/`; imports `vue`/`pinia` to mount `FindBar.vue`)
- `internal/incremental-find.ts` — `firstMatch`, `incrementalFindScroll` (scroll to first match while typing)

## Tests

`node --test 'src/features/find/**/*.test.ts'` — `firstMatch` (nearest, wrap, none); manifest; `search` slot builds; `openFind` without a view is a no-op.

The plain engine has its own find bar: `features/editor/internal/plain/usePlainFind.ts`.
