# Wave 3 PR-3 — SettingsPanel → page components

> **For agentic workers:** Execute task by task. Steps use `- [ ]`. You never commit and never spawn agents.

**Goal:** `components/SettingsPanel.vue` (2612) → `features/settings/ui/SettingsPanel.vue` (≤ 500) rendering 19 multi-root page components in order, plus composables and two CSS files. Search, page visibility, deep links, breadcrumbs, keyboard (⌘F, Esc) behave exactly as today. `lib/quick-capture-status.ts` → `composables/useQuickCaptureStatus.ts`.

**Spec:** LLD S9, S10, S11, S21, §PR-3; `docs/superpowers/specs/2026-10-29-settings-ia-design.md` (nav model, acceptance). Line numbers are from `main@09d66a61`; re-check before cutting.

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

**Owns:** `components/SettingsPanel.vue` (→ `features/settings/ui/SettingsPanel.vue`), `features/settings/ui/**`, `features/settings/internal/use*.ts`, `features/settings/internal/settings-pages.ts`, `lib/settings-nav.template.test.ts`, `lib/quick-capture-status.ts`, `composables/useQuickCaptureStatus.ts`, import lines in `App.vue` and `components/shell/AppDialogs.vue`. Do not touch `stores/settings.ts` or `features/settings/internal/{slices,actions}` (PR-2).

---

### Task 1: Composables (panel still owns its template)

- [ ] Extract script chunks into `features/settings/internal/`: `useSettingsSearch.ts` (281–410: query, dicts, highlight, applySearch, MutationObserver, page-visibility `watchEffect` + head `<style>` cleanup), `useSettingsNavigation.ts` (89–96, 248–265 open/deep-link watch, 412–460 openPage, onSearchKeys, listeners), `useShortcutEditor.ts` (104–210), `useUpdateCheck.ts` (212–246: manual check + setAsDefault), `useSpellDicts.ts` (463–485), `useDirectiveStatus.ts` (486–500), `useRagToggles.ts` (501–534), `useThemeSlots.ts` (536–595, emits close via callback), `useFontPicker.ts` (597–640), `usePdfDefaultsForm.ts` (642–684).
- [ ] Keep watcher/listener registration order identical to today (call the composables in source order). Panel-level deps (`bodyEl`, `props`, `emit`) are passed as arguments, not module globals.
- [ ] Characterize pure bits you lift out (e.g. mm-range validation in `onCustomMmChange`, font select value mapping) with node tests.

### Task 2: Page components

- [ ] `features/settings/ui/pages/<Cat><Page>Page.vue` for each of the 19 keys in `ALL_PAGE_KEYS` (`lib/settings-nav.ts`): e.g. `BasicsLanguagePage.vue`, `BasicsFontsPage.vue`, …, `ThemeMainPage.vue`, `KeysMainPage.vue`, `AdvancedUpdatesPage.vue`. Each is **multi-root**: its template's top-level nodes are the `data-cat`/`data-page` blocks (and `<template v-if>` groups) of that page, in today's relative order, unchanged markup. No wrapper element. `inheritAttrs: false` not needed (no attrs passed).
- [ ] A page imports the composables/stores its blocks use. Composables shared between the panel and pages (search query for highlight? nav?) — share through `provide/inject` with an `InjectionKey` in `features/settings/internal/settings-panel-context.ts`, not module singletons.
- [ ] `features/settings/internal/settings-pages.ts`: `SETTINGS_PAGES: readonly { key: PageKey; component: Component }[]` in `ALL_PAGE_KEYS` order. Panel body: `<component :is="p.component" v-for="p in SETTINGS_PAGES" :key="p.key" />` where today's blocks were.
- [ ] DOM order changes: today blocks of different pages interleave in the body; after the split they group by page. Verify (read `applySearch`) that search ordering uses `style.order` and visibility uses `data-page`, so grouping changes nothing visible. Ledger the check.
- [ ] Blocks outside `.settings__body` (`ThemeMarketplace` 2272) stay in the panel.

### Task 3: Move + CSS + quick-capture

- [ ] `git mv app/src/components/SettingsPanel.vue app/src/features/settings/ui/SettingsPanel.vue`; fix its imports; `AppDialogs.vue` imports it from the new path. Baseline key rename: report `app/src/components/SettingsPanel.vue` → new path.
- [ ] Style: chrome rules (modal, nav, search, crumb, layout) → `ui/settings-panel.css` (`<style scoped src>` in the panel); block rules (rows, labels, inputs, hints inside sections) → `ui/settings-page.css`, loaded by `<style scoped src="../settings-page.css">` in every page. A rule used by both goes in both. Check `:deep()`/global rules keep working.
- [ ] `lib/settings-nav.template.test.ts`: read every page file under `features/settings/ui/pages/` (same `BLOCK_OPEN` regex — page files indent blocks at ≥ 2 spaces now; adjust the indent in the regex and ledger it) + assert `SETTINGS_PAGES` keys equal `ALL_PAGE_KEYS` and each page file's blocks carry only its own `data-page`.
- [ ] `git mv app/src/lib/quick-capture-status.ts app/src/composables/useQuickCaptureStatus.ts`; export `quickCaptureError` unchanged (add `useQuickCaptureStatus()` returning it only if needed); update `App.vue` + Settings importers. Report libPurity key removal.

## Acceptance

- `SettingsPanel.vue` ≤ 500; every page ≤ 500; every composable ≤ 400.
- `lib/settings-nav.*.test.ts` and your new tests pass; `vue-tsc` clean for your paths.
- Report a checklist the controller's browser check can follow (every page name + one setting to toggle on it).
