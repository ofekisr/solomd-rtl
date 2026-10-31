# Wave 1 PR-9 — App.vue → five shell services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move window, file-open, shortcuts, session and updates logic out of `app/src/App.vue` into plain-TS services in `app/src/shell/`, and route App.vue's remaining Tauri calls through ports. Behavior unchanged.

**Architecture:** Extract Service with injected deps (LLD §PR-9, R9). Layer 1 writes each service + tests from the App.vue line ranges without touching App.vue (parallel, disjoint files). Layer 2 rewires App.vue to call the services and deletes the moved code.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript 5.6, ports from `app/src/platform/index.ts`, `node --test`.

**Spec:** `docs/design/wave-refactor/2026-10-30-wave1-platform-lld.md` §PR-9 (line ranges refer to App.vue at `e0c3cd23`; re-locate by content if lines moved).

## Global Constraints

- `shell/*.service.ts` import no `vue`, no `pinia`, no store module, no `@tauri-apps/*`. They import types only from stores if needed (`import type`). Ports arrive through `deps`, never imported from `platform/index.ts` inside a service (keeps tests free of the real adapters). Types for ports: `import type { XPort } from '../platform/<d>/<d>.port.ts'`.
- Shape: `export function createXService(deps: XDeps): XService`. `XService` has `start()` (registers listeners, returns `Promise<void>` if any step awaits) and `stop()` (removes exactly what App.vue's `onBeforeUnmount` removes today — listeners App.vue never removes stay unremoved), plus the handlers App.vue binds (e.g. `onEsc`, `dispatchMenuAction`).
- Same order of operations, same guards (`isAndroid()`, `isMacOS()`, `isIOS()` from `lib/platform.ts` may be imported — it is pure), same toasts, same DOM events (`window.addEventListener`/`dispatchEvent` names unchanged). Pass `window`/`document` access through deps only where a test needs to fake it; otherwise use the globals guarded by `typeof window !== 'undefined'`.
- Constants for magic numbers (zoom steps, limits) — copy values exactly.
- Each service file ≤ 400 lines, functions ≤ ~20 lines where the original allows; split `dispatchMenuAction` into a lookup table of small handlers.
- Tests: `app/src/shell/<x>.service.test.ts` with `node:test`, fakes from `app/src/shell/fake-ports.ts` (Task 1 creates it; others extend it only by adding fields in their own section).
- Workers never commit. `pnpm --dir app guard` must exit 0 (ignore foreign-file errors, list them).

---

## Layer 1 — services (parallel; App.vue read-only)

### Task 1: `window.service.ts` + `fake-ports.ts`

**Files:** Create `app/src/shell/window.service.ts`, `window.service.test.ts`, `fake-ports.ts`.
**Moves (logic copied, App.vue untouched):** wheel zoom 410-447; `applyWindowTitle` 567-585; webview zoom body of the watchEffect 625-640; stale `solomd.window.v1` cleanup 1037-1039; `onWindowBlur` 1043-1045; aux-window registry cleanup 1237-1246; `solomd://close-requested` 1281-1290; `solomd://window-destroyed` 1297-1303.
**Deps:** `windowPort`, `eventsPort`, `windowCommandsPort` (types), settings accessors (`getGlobalZoom()`, `setGlobalZoom(z)`, `isWheelZoomEnabled()`), `getActiveTabTitle()`/whatever `applyWindowTitle` reads, `autoSaveDirtyTabs()`, `persistSession()` (from session service), windows-store callbacks (`reloadWindows()`, `unregisterWindow(label)`).
**API:** `start(): Promise<void>` (registers close-requested + window-destroyed listens and aux cleanup), `stop()`, `onWheelZoom(e: WheelEvent)`, `onWindowBlur()`, `applyWindowTitle()`, `applyZoom(zoom: number)`.
**Tests:** title uses platform format and skips `setTitle` on macOS; wheel zoom steps + clamps exactly like App.vue; close-requested calls `persistSession` then `forceCloseWindow`; `stop()` runs each retained unlisten once.
`fake-ports.ts`: `fakePorts(overrides?)` returns typed fakes for every port the shell uses plus `calls: string[]` recording `"<port>.<method>"`.

### Task 2: `file-open.service.ts`

**Files:** Create `app/src/shell/file-open.service.ts`, `file-open.service.test.ts`.
**Moves:** Android picker/restart/storage 154-192 (the functions; the refs stay in App.vue and arrive as setter deps); `openExternalFile` 877-888; onMounted Android block 1053-1113; `solomd://opened-file` 1154-1160; Android DOM events 1162-1171; deep link 1173-1201; `drain_pending_opens` 1203-1210; `?path=` 1212-1221; drag-drop 1317-1345.
**Deps:** `eventsPort`, `windowPort` (webview drag-drop, deep link), `androidPort`, `windowCommandsPort`, `openerPort`; `openPath(path)`, `getActiveTab()`, `setFolder(path)`, `toggleFileTree()`, `toast(…)` loader as today (dynamic import of `stores/toasts` stays in App.vue and is passed as `showToast`), `setAndroidPickerOpen(b)`, `setAndroidRestartNeeded(b)`, `dispatchInsertImagePath(path)`.
**API:** `start(): Promise<void>` (the onMounted parts in original order), `stop()`, `openExternalFile()`, `doAndroidRestart()`, `onAndroidFolderPick(…)`, `requestAndroidStorage()`.
**Tests:** drained pending opens then `?path=` call `openPath` in order; drag-drop routes image extensions to the insert-image event and others to `openPath`; deep link cold-start URL opens once.

### Task 3: `shortcuts.service.ts`

**Files:** Create `app/src/shell/shortcuts.service.ts`, `shortcuts.service.test.ts`.
**Moves:** `onZoomShortcut` 450-487; `onEsc` 489-505; menu sync body 705-716 (`set_menu_config`, `save_language_preference`); quick-capture shortcut body 749-762; `onOpenHelpEvent`/`onOpenSearchEvent`/`onOpenCjkProofreadEvent` 835-843; `dispatchMenuAction` 890-1025; `onDomMenuAction` 1027-1030; `solomd://menu` listen 1305-1315.
**Deps:** `windowCommandsPort`, `settingsPort`, `capturePort`, `eventsPort`, `clipboardPort`, `windowPort`; a `ShortcutActions` object of callbacks for everything `dispatchMenuAction` and `onEsc` reach (files.*, exporter, tabs, settings zoom methods, overlay refs as `isOpen()/close()` pairs, `openNewWindow`, `openExternalFile`, `toggleGlobalSearch`, `showToast`).
**API:** `start(): Promise<void>` (menu listen + DOM listener), `stop()`, `onEsc(e)`, `onZoomShortcut(e)`, `dispatchMenuAction(id)`, `syncNativeMenu(keybindings, language)`, `syncQuickCaptureShortcut(enabled, shortcut): Promise<string | null>` (returns the error text App.vue stores in `quickCaptureError`), `onOpenHelpEvent()`, `onOpenSearchEvent(e)`, `onOpenCjkProofreadEvent()`.
**Tests:** each menu id maps to the right action (table-driven over every id in the original switch); Esc closes the topmost open overlay first, in the original priority order; unknown menu id is a no-op.

### Task 4: `session.service.ts` + `updates.service.ts`

**Files:** Create `app/src/shell/session.service.ts`, `session.service.test.ts`, `updates.service.ts`, `updates.service.test.ts`.
**Session moves:** watcher handler bodies 527-549 (`tabs.persist`, `tiles.persist`, `tiles.syncFromTabs`); tiles init 1275-1279. **API:** `persist()`, `persistTiles()`, `syncTilesFromTabs()`, `initTiles()`. Deps: the store callbacks.
**Updates moves:** 1347-1366. **API:** `start(): Promise<void>`. Deps: `checkForUpdateOnStartup` (from `lib/check-update.ts`, injected), `openReleaseUrl`, `showToast`, `t` (i18n). Same toast text keys.
**Tests:** `persist()` calls tabs then tiles; `initTiles()` validates, inits default when empty, syncs active tab; updates shows the toast only when a newer version is returned, and its action opens the release URL.

## Layer 2 — wire App.vue (1 task)

### Task 5: App.vue uses the services

**Files:** Modify `app/src/App.vue`; Create `app/src/shell/CLAUDE.md`; Modify `app/CLAUDE.md` (map row `src/App.vue` → "Root host; logic in `shell/`", add `src/shell/` row, remove it from "Planned folders", add read-first row); `app/arch/baseline.json` via rebaseline.

- Instantiate the five services once in `<script setup>` with deps built from stores/refs/ports (`../platform/index.ts` is imported here, in App.vue). Keep every `watch`/`watchEffect` in App.vue but make its body a single service call. `onMounted`: call `start()`s at the exact points where the moved blocks ran (order preserved: Android → listeners → opened-file → Android events → deep link → drain → `?path=` → … → close/destroy → menu → drag-drop → updates). `onBeforeUnmount`: `stop()`s.
- Replace the remaining App.vue `invoke`s in place: `capture_set_workspace` → `capturePort.captureSetWorkspace`, `rest_set_workspace` → `capturePort.restSetWorkspace`, `spellcheck_init` → `settingsPort.spellcheckInit`, `ai_has_key` → `aiPort.aiHasKey`, `readText` → `clipboardPort.readText` (if not already inside the shortcuts service).
- App.vue ends with no `@tauri-apps/` import, and is shorter than 2511 lines (target ≤ 2050).
- `shell/CLAUDE.md` (≤ 40 lines): the five services, their deps contract, the "Vue stays in App.vue" rule, test command, link LLD §PR-9.
- Run `pnpm --dir app guard`; then the controller runs the web dev server smoke (`preview_start solomd-web`, load, no console errors, open a file, Esc closes palette).

## Closing (controller)

- [ ] `pnpm --dir app arch:rebaseline` (App.vue leaves `rawIpc`; its `fileSize` entry drops)
- [ ] `pnpm --dir app verify` exit 0; commit
- [ ] Layer reviews (Sonnet) after Layers 1 and 2; final whole-PR review (Opus)
