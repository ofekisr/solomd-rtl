# features/format

Case transform, markdown format, table/formula editors, insert snippet.
Consumed by: `shell/editor-registry.service.ts` (`EDITOR_FEATURE_FACTORIES`), which `editor/ui/Editor.vue` composes.

| File | Role |
|---|---|
| `contracts/format.feature.ts` | `createFormatFeature()`: window listeners `solomd:transform-case`, `solomd:format-markdown`; commands `openTableAtCursor`, `openFormulaAtCursor`, `insertMarkdown` |
| `internal/doc-commands.ts` | Engine-neutral over `DocAccess`: `tableRangeAt`, `formatMath`, `openTableWith`, `openFormulaWith` (the plain engine uses it through `contracts/index.ts`) |
| `internal/cm-format.ts` | CM branches: `transformCaseInView`, `formatMarkdownInView`, `cmDocAccess` |
| `internal/insert-markdown.ts` | `insertMarkdownInView`, `$|$` cursor marker |
| `internal/table-editor-bus.ts`, `internal/formula-editor-bus.ts` | `tableEditor` / `formulaEditor` refs (moved from `lib/`); re-exported by `contracts/index.ts` for `AppLayout` |

Rules: no `vue`/`pinia` in this feature's own code except the two editor buses (`reactive` refs shared with `AppLayout`); behavior is pinned by the co-located tests.
