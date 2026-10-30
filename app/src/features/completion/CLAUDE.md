# features/completion/

Markdown autocompletion, slash commands, citation loading. Contract: `editor/contracts/editor-feature.port.ts`.
Consumed by: `shell/editor-registry.service.ts` (`EDITOR_FEATURE_FACTORIES`), which `editor/ui/Editor.vue` composes.

| Path | Holds |
|---|---|
| `contracts/completion.feature.ts` | `createCompletionFeature()`: `md-completion` extension + reconfigurable `slash` slot |
| `contracts/citations.ts` | Second public entry: `useCitations` (Vue). Keeps `index.ts` Vue-free |
| `internal/slash.ts` | `slashOptions(ctx)`, `slashExt(ctx)` |
| `internal/useCitations.ts` | Loads bibliography once, reloads on `workspaceBibliography` change. `Editor.vue` wires `ctx.citations` to it |

## Rules

- Only `useCitations.ts` imports `vue`/`pinia`.
- `useCitations` has no unit test (Vue + Pinia + IPC); covered by the browser check.
- Tests run under the global loader (`app/scripts/node-test-loader.mjs`: `.ts` fallback, `.vue`/`.css` stubs, transform-types).
