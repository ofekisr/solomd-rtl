# features/file-tree/

Sidebar file tree: expand/load, sort, extension filter, refresh, inline new/rename, delete with undo, move and drag, reveal and follow-active, workspace switcher, context menu, width resize. Wave 3 PR-4 split of the old `components/FileTree.vue`. LLD: [S11/S12/PR-4](../../../../docs/design/wave-refactor/2026-10-31-wave3-settings-shell-lld.md).

| Path | Holds |
|---|---|
| `contracts/index.ts` | `requestNewFileInTree`, `requestRevealInTree` (parked requests, Vue-free surface) |
| `contracts/file-tree-component.ts` | `FileTree` (Vue; separate entry, used by `components/shell/AppLayout.vue`) |
| `ui/FileTree.vue` | Composition root; template shell; calls composables in watcher order |
| `ui/FileTreeNode.ts` | Recursive render-function row component |
| `ui/FileTreeHeader.vue`, `FileTreeSwitcher.vue`, `FileTreeContextMenu.vue`, `FileTreeDeleteDialog.vue` | Render + emit only |
| `ui/file-tree*.css` | One scoped sheet per component (`<style scoped src>`); node rows reach the root sheet through `:deep` |
| `internal/useFileTreeState.ts` | `createFileTreeState()`: shared refs (`root`, `selected`, `ctx`, `editing`, `manualOrder`, ...) + `findNode` |
| `internal/useTree{Selection,Sort,Load,Filter,Refresh,Edit,Move,DragDrop,RevealRow,Delete,ContextActions,Resize,WindowKeys}.ts`, `useWorkspaceSwitcher.ts` | One concern each; take the state object |
| `internal/useTreeDrag.ts`, `useFileTreeReveal.ts`, `useFileTreeNewFile.ts` | Module-level drag / reveal / new-file request state (pointer-event drag, see header comment) |
| `internal/tree-paths.ts`, `tree-reorder.ts`, `tree-repoint.ts`, `tree-types.ts` | Pure helpers and types (tested) |
| `internal/useTreeRender.ts` | `FTREE_EDIT` key, `indentGuides`, indent constants |

## Rules

- Watcher order is load-bearing (S12): `FileTree.vue` calls `useTreeSelection`, `useTreeSort`, `useTreeLoad`, `useTreeFilter`, `useTreeRefresh`, `useTreeRevealRow`, `useTreeWindowKeys` in that order. `ui/file-tree-order.test.ts` guards it.
- A watcher reacting to an id/path change watches `[id, value]` and skips work on id change.
- Never `watch(root)`: refresh mutates the root node in place (comment in `useTreeRefresh.ts`).
- Cross-composable cycles (sort and filter need refresh) go through lazy callbacks, not module state.
- Files importing `vue` are `ui/*`, `use*.ts`; pure helpers stay Vue-free.
- Outside code imports only `contracts/`.
