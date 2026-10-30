# features/folds/

Heading folding for the CodeMirror engine.
Consumed by: `shell/editor-registry.service.ts` (`EDITOR_FEATURE_FACTORIES`), provided to `editor/ui/Editor.vue` by `App.vue` through `EDITOR_REGISTRY_FACTORY`.

| Path | Holds |
|---|---|
| `contracts/folds.feature.ts` | `createFoldsFeature()`: `fold` slot (follows `foldingEnabled`), command `applyFold`, per-document fold memory on mount/tab switch/unmount |
| `contracts/index.ts` | Public surface: factory + `FoldAction` |
| `internal/apply-fold.ts` | `applyFold`, `foldExtensionFor` |

- Fold memory key is `filePath ?? tab id`, held in the factory closure (one instance per pane).
- The plain engine folds inside `editor/internal/plain/usePlainFolds.ts`, not through this feature (LLD E6).
- Tests: `folds.test.ts`.
