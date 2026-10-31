# Wave 3 PR-5 — Toolbar → components/shell/toolbar

> **For agentic workers:** Execute task by task. Steps use `- [ ]`. You never commit and never spawn agents.

**Goal:** `components/Toolbar.vue` (1610) → `components/shell/toolbar/Toolbar.vue` ≤ 500 + children + composables; same emits (`open-palette`, `open-settings`, `open-help`, `open-search`), same DOM classes, same behavior on macOS, Windows (custom title bar, menubar, caption buttons), web, phone sheet.

**Spec:** LLD S11, §PR-5. Line numbers are from `main@09d66a61`.

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

**Owns:** `components/Toolbar.vue` → `components/shell/toolbar/**`; Toolbar import line in `components/shell/AppLayout.vue`; comment lines in `styles/main.css` that name the file path.

---

### Task 1: Composables + actions

- [ ] `toolbar/toolbar-actions.ts` (no Vue): CJK proofread, clean AI, AI rewrite, open external, dispatchFormat/Insert, pick/insert image, image URL dialog, shortPath (195–434). Functions take their deps (stores, ports, toasts, t) as arguments. Characterize `shortPath` and any pure branch.
- [ ] `useToolbarDropdowns.ts`: refs for the five dropdowns + `menubarOpen`, `menuPos`, `floatStyle`, `positionMenuFromButton`, `closeAllDropdowns`, `toggleDropdown`, outside-click/scroll/resize handlers + their mount/unmount (346–381, 436–445, 634–671). Provided to children via `TOOLBAR_DROPDOWNS` `InjectionKey`.
- [ ] `useToolbarOverflow.ts` (77–105, 542–559: `barOverflows`, `measureOverflow`, ResizeObserver, `onUpdated`), `useTitleBar.ts` (143–193), `useWindowsCaption.ts` (561–633), `usePhoneSheet.ts` (56–75), `useWindowsMenubar.ts` (447–540 data + handlers).
- [ ] Hook registration order today: 546 mount (overflow), 552 unmount, 559 updated, 604 mount (win), 625 unmount, 672 mount (doc listeners), 677 unmount. Call composables in that order.

### Task 2: Children + move

- [ ] `ToolbarFileGroup.vue` (740–874), `ToolbarInsertMenu.vue` (908–1004), `ToolbarAiGroup.vue` (1006–1028), `ToolbarViewModes.vue` (1032–1099), `ToolbarTools.vue` (1103–1172), `WindowsMenubar.vue` (706–732), `WindowsCaption.vue` (1190–1214). Teleports stay where they are in the markup.
- [ ] `git mv components/Toolbar.vue components/shell/toolbar/Toolbar.vue`; report baseline key rename. `AppLayout.vue` import.
- [ ] Style 1218–1610 → `toolbar.css` for the root; children load the rules they render via `<style scoped src>` (the same file may be loaded by several components). `main.css:306` comment refers to the scoped attribute — keep selectors working; read it.

## Acceptance

- Root ≤ 500, children ≤ 500, `.ts` ≤ 400; `vue-tsc` clean for your paths; new tests pass.
- Report a browser checklist (each dropdown, exclusivity, outside click, view-mode buttons, overflow at narrow width).
