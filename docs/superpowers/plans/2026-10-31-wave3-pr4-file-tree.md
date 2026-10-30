# Wave 3 PR-4 — FileTree → features/file-tree

> **For agentic workers:** Execute task by task. Steps use `- [ ]`. You never commit and never spawn agents.

**Goal:** `components/FileTree.vue` (2941) → `features/file-tree/` with `ui/FileTree.vue` ≤ 500 composing composables and child components; behavior identical (expand, load, sort, filter, refresh, rename/new/delete, move, drag reorder/move, reveal, follow-active, workspace switcher, context menu, resize).

**Spec:** LLD S11, S12, §PR-4. Line numbers are from `main@09d66a61`; re-check before cutting.

## Global constraints (all Wave 3 plans)

- No behavior change. Root `CLAUDE.md` invariants hold; `docs/conventions/file-roles.md` names (incl. `.slice.ts`, `.actions.ts`).
- Every file you create or touch ends ≤ 400 lines `.ts`, ≤ 500 `.vue`, ≤ 600 `.rs`. No `any`. Local TS imports end in `.ts`.
- Move with `git mv` (allowed: it is a rename, not a commit) so history follows. No other git writes: never commit, add, stash, checkout, reset.
- Tests: `cd app && node --experimental-transform-types --import ./scripts/node-test-loader.mjs --test <files>`. Arch: `cd app && node --test arch/`. Types: `cd app && pnpm exec vue-tsc --noEmit 2>&1 | grep -E '<your paths>'`. Rust: `cd app/src-tauri && cargo check` / `cargo test <filter>`. Other workers edit other files at the same time: errors outside your owned files are not yours — report them, never touch them.
- Own only the files the LLD §File ownership table gives your PR. Never edit `app/arch/baseline.json`, `app/CLAUDE.md`. When you move a baselined file, tell the controller the old → new key (it renames the key).
- Watchers (Wave 2 lesson): moving logic into composables changes registration order. Call composables in the order the original code registered its watchers. A watcher reacting to an id/path change watches `[id, value]` and skips its work on id change.
- Characterize before moving: any pure helper you extract gets a test against today's behavior first.
- Ledger: append task status and every decision the plan leaves open as `Ruling: <decision> — <reason> — cost if wrong: <x>` to `.superpowers/sdd/2026-10-31-wave3-pr<N>/progress.md`.
- Final report to `.superpowers/sdd/2026-10-31-wave3-pr<N>/report.md`: files changed, moved-file key renames, tests added (count), commands run + exit codes, line counts of every file you created/touched, open issues.

**Owns:** `components/FileTree.vue` → `features/file-tree/**`; `composables/{useTreeDrag,useFileTreeReveal,useFileTreeNewFile}.ts` (move into `features/file-tree/internal/`); import lines in `components/shell/AppLayout.vue` and in every importer of the three moved composables (e.g. `composables/useCommands.ts`, `useFiles.ts` — import lines only).

**Watcher registration order today (must be preserved):** 220 `watch(selected)`, 221 `watch(activeTab.filePath)`, 476 `watch(workspace.currentFolder)`, 575 `watch([extFilter, showHidden, currentFolder])`, 584 `watch(showHidden)`, 651/664 `onMounted`/`onBeforeUnmount` (listeners), 1112 `watch([revealRequest, root.path, root.loading])`, 1132 `watch([activeTab.filePath, root.path, root.loading])` follow-active, 1150 `watch([newFileInTreeRequest, …])`, 1522/1526 window click/key listeners. The comment at 634–636 (never `watch(root)`) stays with its code.

---

### Task 1: Feature folder + pure helpers

- [ ] `features/file-tree/{contracts/index.ts, CLAUDE.md}`. Contracts re-export what outside code needs from the moved composables (`requestNewFileInTree`, reveal API, etc.); outside importers switch to `features/file-tree/contracts/index.ts`.
- [ ] `git mv` the three composables into `features/file-tree/internal/`.
- [ ] Extract pure helpers into `internal/tree-paths.ts` (`joinPath`, `rootRelative`, `segmentsUnderRoot`, `parentDir` usage, `orderKey`/`orderPath`) and `internal/tree-reorder.ts` (`reorderAt`/`destinationAt` math if separable from DOM) with characterization tests first.

### Task 2: Composables

- [ ] `internal/useTreeResize.ts` (81–111), `useTreeSort.ts` (273–360), `useTreeLoad.ts` (361–492 incl. the 476 watcher), `useTreeFilter.ts` (493–590 incl. 575/584 watchers), `useTreeRefresh.ts` (591–675 incl. 651/664 hooks), `useTreeEdit.ts` (676–833 + 1309–1397 inline edit/commit + `FTREE_EDIT` provide 757), `useTreeMove.ts` (834–988), `useTreeDragDrop.ts` (989–1019 + 1165–1308), `useTreeRevealRow.ts` (1020–1164 incl. 1112/1132/1150 watchers), `useTreeDelete.ts` (1398–1447), `useWorkspaceSwitcher.ts` (1458–1505), window click/key (1506–1529) stays in `FileTree.vue` or `useTreeWindowKeys.ts`.
- [ ] Shared state (`root`, `selected`, `ctx`, `editing`, …) lives in one `createFileTreeState()` object passed to composables (Wave 1b `createX`/`useX` precedent) — not module singletons (FileTree could mount twice in future split views; today once).
- [ ] `FileTree.vue` setup calls them so the watcher order above is unchanged. Add `ui/file-tree-order.test.ts`: reads `FileTree.vue` source and asserts the composable calls appear in that order.

### Task 3: Template + CSS + move

- [ ] `ui/FileTreeNode.ts` (1929–2169, render-function component, `FTREE_EDIT`, `FtreeEditApi`, indent consts). `ui/FileTreeHeader.vue` (header, filter + sort popovers, action buttons), `ui/FileTreeSwitcher.vue` (1657–1696), `ui/FileTreeContextMenu.vue` (1792–1880), `ui/FileTreeDeleteDialog.vue` (1901–1925). Props/emits explicit and typed; no behavior moves into children beyond rendering + emitting.
- [ ] `git mv components/FileTree.vue features/file-tree/ui/FileTree.vue`; `AppLayout.vue` import updated. Report baseline key rename.
- [ ] Style 2171–2941 → `ui/file-tree.css` (split into `file-tree.css` + `file-tree-menu.css` if > 500 lines is a concern — CSS files are not ratcheted, keep one file unless it helps); each child component that renders styled nodes loads the rules it needs via `<style scoped src>` (scoped CSS does not cross component boundaries — check every class the children render). `FileTreeNode.ts` render-function nodes: today they get FileTree's scope attribute? They do NOT (child component) — check how today's CSS reaches them (`:deep` or unscoped) and keep the same mechanism.

## Acceptance

- `FileTree.vue` ≤ 500; each composable ≤ 400; children ≤ 500.
- New tests pass; `vue-tsc` clean for your paths; `tree-sort`, `new-file-target`, `new-file-types` tests pass.
- Report a browser checklist (actions to try) for the controller.
