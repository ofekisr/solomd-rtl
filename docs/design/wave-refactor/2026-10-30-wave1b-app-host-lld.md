## LLD: Wave 1b — App.vue thin host

**Status**: Done | **Version**: v1.1 | **Date**: 30-10-26 | **HLD**: `2026-10-30-wave-refactor-hld.md` v3.2 | **Follows**: [Wave 1 LLD](2026-10-30-wave1-platform-lld.md)

Wave 1 moved IPC and five services out of `App.vue` (2511 → 2005). No later wave owned the rest. Wave 1b brings `App.vue` under the final `.vue` budget (≤ 500) by moving Vue state into composables and the template into components. Behavior does not change.

### Baseline (measured 30-10-26)

| Fact | Value |
|---|---|
| `App.vue` | 2005 lines: script 1346, template 331, style 323 |
| Right-sidebar markup | Duplicated: one `<aside>` per side (`outlineSide`) |
| Unit tests | 1355 + arch |

### Rulings

| # | Question | Ruling | Why |
|---|---|---|---|
| B1 | Where reactive logic goes | `app/src/composables/use*.ts`, not `shell/` | `shell/` services must not import `vue` (file roles); this logic is refs, computeds and watchers |
| B2 | Sharing state between `App.vue` and child components | `createX()` builds state once in `App.vue` and `provide`s it; children call `useX()` (`inject`, throws when missing) | One instance, no module singletons that survive HMR; typed `InjectionKey` |
| B3 | Watchers | May live in a host composable called from `App.vue` setup. `shell/` services still hold none | Same rule as Wave 1 for services; composables are the Vue side of the shell |
| B4 | Right-sidebar duplication | One `RightSidebar.vue` with a `side` prop, rendered in the left or right slot | Removes ~75 duplicated template lines; markup and classes unchanged |
| B5 | Pure logic | Pane ordering and pane flex style move to `lib/right-sidebar.ts` with unit tests | `lib/` stays pure (Invariant 4); testable without Vue |
| B6 | Listener registration timing | Window listeners stay registered at setup time from composables called in `App.vue`; nothing moves into a component that mounts only outside reading mode | Reading mode must keep receiving open-bases / type-lens / wiki-open events |

### What moves

| Target | Contents |
|---|---|
| `composables/useRightSidebar.ts` | Pane visibility computeds, master visibility + `setRightSidebarShell`, narrow drawer, search pane state, `ctxToggle`, context-menu state, width + resize, relayout watcher |
| `composables/useRsPaneReorder.ts` | Pointer-driven pane reorder (#131) |
| `composables/useAppDialogs.ts` | Modal open flags, Settings deep-link, unsaved / file-changed promise dialogs, image-URL dialog, Android picker flags, `aiHasKey` |
| `composables/useCenterView.ts` | Bases / inbox / type-lens / saved-view content swap + its window events |
| `composables/useEditorCursor.ts` | Cursor, selection, preview top line, outline line |
| `composables/useAppTypography.ts` | UI / code / content font CSS vars, markdown-it flags |
| `composables/useWorkspaceSync.ts` | Workspace index, properties, capture/REST folder, RAG, spellcheck, git-pane binding watchers |
| `composables/useWikiOpen.ts` | `solomd:wiki-open` resolution |
| `lib/right-sidebar.ts` | `orderVisiblePanes`, `paneFlexStyle` |
| `components/shell/RightSidebar.vue` | One sidebar strip + its styles |
| `components/shell/SidebarContextMenu.vue` | Right-click pane toggles |
| `components/shell/AppLayout.vue` | Toolbar, workspace columns, content swap, status bar, table/formula editors |
| `components/shell/AppDialogs.vue` | Every modal and overlay, Android restart prompt |

`App.vue` keeps: store setup, the five service constructions, session/title watchers, `onMounted` order, `onBeforeUnmount`, the root `.app` element.

### Integrate gate

- `App.vue` ≤ 500 lines; new files within budget (`.ts` ≤ 400, `.vue` ≤ 500); baseline shrinks only.
- `pnpm --dir app verify` green; Playwright e2e green on macOS.
- `shell/CLAUDE.md`, `app/CLAUDE.md` updated.

### As shipped

| Item | Planned | Shipped |
|---|---|---|
| `App.vue` | ≤ 500 lines | 2005 → 475; `fileSize` baseline entry dropped (71 → 70) |
| New files | within budget | Largest: `useRightSidebar.ts` 265, `RightSidebar.vue` 203 |
| Unit tests | never drop | 1355 → 1364 (+ `lib/right-sidebar.test.ts`) |
| Gate | `verify` + e2e | `verify` green; Playwright 14/14; web build checked by hand: sidebar, context menu, splitter, dialogs, unsaved promise, narrow drawer, reading mode |
| `app/test-results/` | — | Added to `.gitignore` |
