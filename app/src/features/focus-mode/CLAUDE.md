# features/focus-mode/

Focus (dim other paragraphs) and typewriter (centered caret) modes.
Consumed by: `shell/editor-registry.service.ts` (`EDITOR_FEATURE_FACTORIES`), which `editor/ui/Editor.vue` composes.

| Item | Value |
|---|---|
| Slot `focus` | reconfigurable; `focusModeExtension()` when `props.focusMode` |
| Slot `typewriter` | reconfigurable; `typewriterModeExtension()` when `props.typewriterMode` |
| Settings / i18n | none |

## Files

- `contracts/focus-mode.feature.ts` — `createFocusModeFeature()`

## Tests

`contracts/focus-mode.feature.test.ts` — off builds `[]`, on builds into an `EditorState`, deps read props.
