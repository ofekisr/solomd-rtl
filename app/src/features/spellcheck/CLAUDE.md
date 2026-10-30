# features/spellcheck/

Spellcheck for the CodeMirror engine. Copied from `Editor.vue`.

| Item | Value |
|---|---|
| Slot `spellcheck-attr` | reconfigurable; `contentAttributes.spellcheck` from `props.spellCheck` |
| Slot `md-spellcheck` | static; markdown tabs only: `spellcheckExtension` + `spellcheckTheme` |
| Settings | `spellcheckEnabled` |

## Files

- `contracts/spellcheck.feature.ts` — `createSpellcheckFeature()`

## Tests

`contracts/spellcheck.feature.test.ts` — manifest, attr true/false, deps, `md-spellcheck` empty for `ts`, populated for `markdown`.
