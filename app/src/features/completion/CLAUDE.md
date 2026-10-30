# features/completion/

Markdown autocompletion, slash commands, citation loading. Contract: `editor/contracts/editor-feature.port.ts`.

| Path | Holds |
|---|---|
| `contracts/completion.feature.ts` | `createCompletionFeature()`: `md-completion` extension + reconfigurable `slash` slot |
| `contracts/citations.ts` | Second public entry: `useCitations` (Vue). Keeps `index.ts` Vue-free |
| `internal/slash.ts` | `slashOptions(ctx)`, `slashExt(ctx)` |
| `internal/useCitations.ts` | Loads bibliography once, reloads on `workspaceBibliography` change. Host wires `ctx.citations` to it (PR-8) |

## Rules

- Only `useCitations.ts` imports `vue`/`pinia`.
- `useCitations` has no unit test (Vue + Pinia + IPC); PR-8 covers it in the browser check.
- Tests run under the global loader (`app/scripts/node-test-loader.mjs`: `.ts` fallback, `.vue`/`.css` stubs, transform-types).
