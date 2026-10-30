# features/context-menu

CodeMirror right-click menu (#210). Used by the CM branch of `editor/ui/Editor.vue` and by `PlainEditor.vue`.
Consumed by: `shell/editor-registry.service.ts` (`EDITOR_FEATURE_FACTORIES`), which `editor/ui/Editor.vue` composes. This feature has no registry entry; the host calls it directly.

| File | Role |
|---|---|
| `contracts/index.ts` | Exports `useCmContextMenu`, `readClipboard`, `writeClipboard` |
| `contracts/context-menu-component.ts` | Exports `EditorContextMenu` + `EditorMenuAction` (Vue; separate entry) |
| `ui/EditorContextMenu.vue` | The menu component |
| `internal/useCmContextMenu.ts` | Vue composable: `editorCtx`, `onContextMenu`, `onMenuAction` (only Vue file here) |
| `internal/cm-menu-actions.ts` | Pure `runCmMenuAction`, `cmSelectionText` |
| `internal/clipboard.ts` | `clipboardPort` with `navigator.clipboard` fallback |
| `internal/stubs.testkit.ts` | Test stubs |

Import the component only via `contracts/context-menu-component.ts`, never `contracts/index.ts` (Node tests load it).
