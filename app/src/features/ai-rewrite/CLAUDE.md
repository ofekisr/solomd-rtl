# features/ai-rewrite/

AI-rewrite chord (`ai-key` slot) and AI edit lock (`ai-lock` slot). Contract: `editor/contracts/editor-feature.port.ts`.
Consumed by: `shell/editor-registry.service.ts` (`EDITOR_FEATURE_FACTORIES`), which `editor/ui/Editor.vue` composes.

| Path | Holds |
|---|---|
| `contracts/ai-rewrite.port.ts` | `AiRewritePort`: `extension(cmKey)`, `isLocked(filePath)` |
| `contracts/ai-rewrite.feature.ts` | `createAiRewriteFeature(port = legacyAiRewriteAdapter)` |
| `internal/ai-rewrite.legacy.adapter.ts` | Wave 2 shim over `lib/cm-ai-rewrite` + `lib/ai-activity`. Deleted in Wave 4 (LLD E10) |
| `internal/rewrite-key.ts` | `currentAiRewriteKey` (unbound -> `F24`), `aiLockExtension` |

## Rules

- Reach today's AI code only through the port.
- Tests run under the global loader (`app/scripts/node-test-loader.mjs`).
