# features/spellcheck/

Spellcheck for the CodeMirror engine.
Consumed by: `shell/editor-registry.service.ts` (`EDITOR_FEATURE_FACTORIES`), provided to `editor/ui/Editor.vue` by `App.vue` through `EDITOR_REGISTRY_FACTORY`.

| Item | Value |
|---|---|
| Slot `spellcheck-attr` | reconfigurable; `contentAttributes.spellcheck` from `props.spellCheck` |
| Slot `md-spellcheck` | static; markdown tabs only: `spellcheckExtension` + `spellcheckTheme` |
| Settings | `spellcheckEnabled` |

## Files

- `contracts/spellcheck.feature.ts` — `createSpellcheckFeature()`
- `internal/cm-spellcheck.ts`, `internal/cm-spellcheck-theme.ts` — extension and theme (moved from `lib/`)

## Tests

`contracts/spellcheck.feature.test.ts` — manifest, attr true/false, deps, `md-spellcheck` empty for `ts`, populated for `markdown`.
