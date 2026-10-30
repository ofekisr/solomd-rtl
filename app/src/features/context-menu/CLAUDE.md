# features/context-menu

CodeMirror right-click menu (#210). Characterization copy of Editor.vue's CM branch (Wave 2 PR-7).

| File | Role |
|---|---|
| `contracts/index.ts` | Exports `useCmContextMenu`, `readClipboard`, `writeClipboard` |
| `internal/useCmContextMenu.ts` | Vue composable: `editorCtx`, `onContextMenu`, `onMenuAction` (only Vue file here) |
| `internal/cm-menu-actions.ts` | Pure `runCmMenuAction`, `cmSelectionText` |
| `internal/clipboard.ts` | `clipboardPort` with `navigator.clipboard` fallback |

`ui/EditorContextMenu.vue` (the menu component) is exported to other features and `components/` via `contracts/context-menu-component.ts` (never `contracts/index.ts`, which Node tests load).
