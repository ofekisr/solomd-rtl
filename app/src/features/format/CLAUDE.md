# features/format

Case transform, markdown format, table/formula editors, insert snippet. Characterization copy of Editor.vue's CM branches (Wave 2 PR-7).

| File | Role |
|---|---|
| `contracts/format.feature.ts` | `createFormatFeature()`: window listeners `solomd:transform-case`, `solomd:format-markdown`; commands `openTableAtCursor`, `openFormulaAtCursor`, `insertMarkdown` |
| `internal/doc-commands.ts` | Engine-neutral over `DocAccess`: `tableRangeAt`, `formatMath`, `openTableWith`, `openFormulaWith` (PR-8 points the plain engine here) |
| `internal/cm-format.ts` | CM branches: `transformCaseInView`, `formatMarkdownInView`, `cmDocAccess` |
| `internal/insert-markdown.ts` | `insertMarkdownInView`, `$|$` cursor marker |

Rules: no `vue`/`pinia` in this feature's own code; behavior is pinned by the co-located tests.
