# features/folds/

Heading folding for the CodeMirror engine. Code copied from `Editor.vue` (Wave 2 PR-5).

| Path | Holds |
|---|---|
| `contracts/folds.feature.ts` | `createFoldsFeature()`: `fold` slot (follows `foldingEnabled`), command `applyFold`, per-document fold memory on mount/tab switch/unmount |
| `contracts/index.ts` | Public surface: factory + `FoldAction` |
| `internal/apply-fold.ts` | `applyFold`, `foldExtensionFor` |

- Fold memory key is `filePath ?? tab id`, held in the factory closure (one instance per pane).
- The plain engine's fold path stays in `Editor.vue` until PR-8.
