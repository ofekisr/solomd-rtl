# Wave 1 PR-8 — window, opener and clipboard callers use ports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every `invoke()` and `@tauri-apps/*` use in this PR's files with `platform/` ports; behavior unchanged.

**Architecture:** Strangler fig per file (LLD §PR-2…PR-8 Mechanics). Each task owns a disjoint file set (R6), so all tasks run in parallel in one layer; a closing layer shrinks the arch baseline.

**Tech Stack:** Vue 3, TypeScript 5.6, Zod 4 ports from PR-1, `node --test`.

**Spec:** `docs/design/wave-refactor/2026-10-30-wave1-platform-lld.md` (§PR-2…PR-8, R6, R8, R10–R12) · ADR `docs/design/adr/0003-platform-ports.md`

## Global Constraints

- Behavior unchanged. Same calls, same order, same args, same error handling. Keep every `try/catch`, `isTauri()`, `hasGitBackend()` guard as is.
- Ports come only from `platform/index.ts` (relative path with `.ts`, e.g. `../platform/index.ts` from `components/`, `../../platform/index.ts` from `components/git/`). Exports: `fsPort androidPort cloudPort convertPort gitSyncPort gitHistoryPort aiPort aiToolsPort ragPort settingsPort capturePort windowCommandsPort eventsPort dialogPort openerPort clipboardPort pathPort windowPort` and types `UnlistenFn`, `PlatformEvent`, `PlatformUnsupportedError`. Read `app/src/platform/CLAUDE.md` and the port file you need before editing.
- Migration per call: `invoke<T>('snake_cmd', args)` → `<port>.snakeCmd(args)` (camelCase of the command; find which port owns it with `grep -rn "snake_cmd:" app/src/platform`). Drop `<T>` when the port's result type is assignable; if a type error shows the catalog schema is wrong, fix the schema in `app/src/platform/<d>/<d>.port.ts` to match Rust (`grep -rn "fn snake_cmd" app/src-tauri/src`) and add/adjust its fixture in `<d>.port.test.ts` — never cast at the call site. Plugin calls: `listen` → `eventsPort.listen`, `openUrl/openPath/revealItemInDir` → `openerPort.*`, `writeText/readText/…` → `clipboardPort.*`, `open/save` dialogs → `dialogPort.*`, `getCurrentWindow()` → `windowPort.currentWindow()`, `getCurrentWebview()` → `windowPort.currentWebview()`, `getVersion` → `windowPort.getVersion`, `api/path` + `plugin-fs` → `pathPort.*`. Lazy `await import('@tauri-apps/…')` sites become direct port calls (the adapter keeps the lazy load).
- After the task, the file contains no `@tauri-apps/` string (except in comments — remove those references too, they confuse the arch scanner's readers).
- Line budget: a file listed in `app/arch/baseline.json` `fileSize` must not end above its recorded value; other files stay ≤ 400 (`.ts`) / ≤ 500 (`.vue`). Check with `wc -l`.
- No `any`. Imports use `.ts` extensions where the file already does; match each file's existing import style.
- Workers never commit, never run git write commands. Other workers edit other files at the same time: vue-tsc errors outside your files are not yours — report them, don't fix them.
- Done = `pnpm --dir app guard` exit 0 (or only foreign-file errors, listed in your report) and `grep -c "@tauri-apps/" <your files>` all 0.

---

## Layer 1 — migrate (parallel)

### Task 1: window chrome

**Files:**
- Modify: `app/src/components/Toolbar.vue`
- Modify: `app/src/components/Slideshow.vue`
- Modify: `app/src/components/ReadingView.vue`
- Modify: `app/src/composables/useShortcuts.ts`
- Possibly modify: the `app/src/platform/<d>/<d>.port.ts` + `<d>.port.test.ts` of a schema found wrong

**Interfaces:** Consumes the ports listed in Global Constraints. Produces nothing new.

- [ ] **Step 1:** For each file, list its Tauri uses: `grep -nE "invoke|@tauri-apps|listen\(|openUrl|openPath|revealItemInDir|writeText|readText|getCurrentWindow|getCurrentWebview" <file>`.
- [ ] **Step 2:** Swap imports and calls per the recipe. Keep logic, order, guards and error handling identical.
- [ ] **Step 3:** If any file has co-located tests, run them: `cd app && node --test <file>.test.ts`. Run any port test you changed.
- [ ] **Step 4:** `pnpm --dir app guard`; `grep -c "@tauri-apps/" <files>` → 0; `wc -l <files>` within budget.
- [ ] **Step 5:** Hand back. Controller commits `refactor(window): window chrome call platform ports`.

### Task 2: app info + new window

**Files:**
- Modify: `app/src/components/AboutDialog.vue`
- Modify: `app/src/lib/check-update.ts`
- Modify: `app/src/lib/telemetry.ts`
- Modify: `app/src/lib/devtools.ts`
- Modify: `app/src/lib/new-window.ts`
- Possibly modify: the `app/src/platform/<d>/<d>.port.ts` + `<d>.port.test.ts` of a schema found wrong

**Interfaces:** Consumes the ports listed in Global Constraints. Produces nothing new.

- [ ] **Step 1:** For each file, list its Tauri uses: `grep -nE "invoke|@tauri-apps|listen\(|openUrl|openPath|revealItemInDir|writeText|readText|getCurrentWindow|getCurrentWebview" <file>`.
- [ ] **Step 2:** Swap imports and calls per the recipe. Keep logic, order, guards and error handling identical.
- [ ] **Step 3:** If any file has co-located tests, run them: `cd app && node --test <file>.test.ts`. Run any port test you changed.
- [ ] **Step 4:** `pnpm --dir app guard`; `grep -c "@tauri-apps/" <files>` → 0; `wc -l <files>` within budget.
- [ ] **Step 5:** Hand back. Controller commits `refactor(window): app info + new window call platform ports`.

### Task 3: clipboard + opener

**Files:**
- Modify: `app/src/components/Editor.vue`
- Modify: `app/src/lib/code-copy.ts`
- Modify: `app/src/components/MindmapDetailsPane.vue`
- Modify: `app/src/components/properties/value-cells/UrlCell.vue`
- Modify: `app/src/lib/reveal-in-file-manager.ts`
- Modify: `app/src/lib/open-google-translate.ts`
- Possibly modify: the `app/src/platform/<d>/<d>.port.ts` + `<d>.port.test.ts` of a schema found wrong

**Interfaces:** Consumes the ports listed in Global Constraints. Produces nothing new.

- [ ] **Step 1:** For each file, list its Tauri uses: `grep -nE "invoke|@tauri-apps|listen\(|openUrl|openPath|revealItemInDir|writeText|readText|getCurrentWindow|getCurrentWebview" <file>`.
- [ ] **Step 2:** Swap imports and calls per the recipe. Keep logic, order, guards and error handling identical.
- [ ] **Step 3:** If any file has co-located tests, run them: `cd app && node --test <file>.test.ts`. Run any port test you changed.
- [ ] **Step 4:** `pnpm --dir app guard`; `grep -c "@tauri-apps/" <files>` → 0; `wc -l <files>` within budget.
- [ ] **Step 5:** Hand back. Controller commits `refactor(window): clipboard + opener call platform ports`.

## Layer 2 — close (controller)

- [ ] `pnpm --dir app arch:rebaseline` — this PR's files leave `rawIpc` (and `libPurity` when a `lib/` file no longer imports `vue`/`pinia`/`@tauri-apps`).
- [ ] Update the nearest `CLAUDE.md` if a statement became wrong.
- [ ] `pnpm --dir app verify` exit 0; commit `chore(arch): shrink baseline after <PR>`.
- [ ] Layer review (Sonnet) after Layer 1; final whole-PR review (Opus).
