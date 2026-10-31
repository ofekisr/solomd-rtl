# Wave 3 PR-2 — Settings store → slices + actions

> **For agentic workers:** Execute task by task. Steps use `- [ ]`. You never commit and never spawn agents.

**Goal:** `app/src/stores/settings.ts` (1793) becomes a ≤ 400-line Pinia store that composes 14 slices and 14 action mixins, loads through `loadSettings` (PR-1), and reproduces the golden fixtures exactly. Store id, state keys, action names and every export stay the same (83 importers untouched).

**Spec:** LLD `docs/design/wave-refactor/2026-10-31-wave3-settings-shell-lld.md` S1–S8, §PR-2; ADR 0005. Contract: `app/src/features/settings/contracts/settings-slice.port.ts`, `internal/settings-load.service.ts`, `internal/settings-migrations.ts` (PR-1). Golden test: `app/src/features/settings/internal/settings-golden.test.ts`.

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

**Owns:** `app/src/stores/settings.ts`, `app/src/features/settings/internal/{slices,actions}/**`, `app/src/features/settings/internal/settings-slices.ts` (ordered list until PR-11 moves it to `shell/`), `settings-migrations.ts` (only if normalize/migrate split needs a change — ledger it).

---

### Task 1: Slices

**Files:** `features/settings/internal/slices/<area>.slice.ts` × 14 (`general`, `layout`, `explorer`, `preview`, `appearance`, `writing`, `attachments`, `inbox`, `mindmap`, `git`, `integrations`, `ai`, `export`, `app`), `slices/slices.test.ts`, `internal/settings-slices.ts` (`SETTINGS_SLICES` in the order that reproduces today's `load()` normalize order).

- [ ] Partition every key of `Settings` (`stores/settings.ts:39–500`) into one slice per LLD §PR-2 table. Ambiguous key → the slice whose Settings page shows it (`lib/settings-nav.ts` + LLD SettingsPanel map); hidden UI state → `layout` or `app`. Ledger each non-obvious placement in one Ruling line listing the keys.
- [ ] Each slice: `export interface <Area>Settings` (keep today's field comments — they are the "why"), `schema` (Zod object, types matching the interface; use `z.custom<T>()` for complex imported types), `defaults()` (values copied from `defaults()` 575–786, same expressions — `isMobile()`/`isIOS()` calls stay), `normalize` (the lines of `load()` 834–873 for its keys, same order). Types that other files import (`PdfDefaults`, `Appearance`, …) stay exported from `stores/settings.ts` (re-export).
- [ ] `export type Settings = GeneralSettings & LayoutSettings & …` lives in `features/settings/internal/settings-types.ts` (or the store) and is identical in keys to today's interface (test: `Object.keys(defaults())` sorted equals union of slice defaults sorted; each key in exactly one slice).
- [ ] Normalize order: today's `load()` applies clamps in source order across areas (pdf, language, mindmap, autosave, ai delays, …). If slice-by-slice order changes an observable result, keep cross-slice steps in the migration/`app` slice and ledger it. The golden test decides.

### Task 2: Store loads through the loader

- [ ] `state: () => load()` where `load()` = `loadSettings(localStorage.getItem(SETTINGS_STORAGE_KEY), SETTINGS_SLICES, SETTINGS_MIGRATIONS, { report: dev ? console.warn : undefined, isMobile: isMobile() })`; keep `hadStoredSettings()` semantics; `persist()` unchanged (drops `_rsPanesBeforeHide`, writes everything else incl. `settingsVersion`).
- [ ] Golden test: remove the `settingsVersion` exclusion; expected JSON gains `"settingsVersion": 2` — regenerate ONLY that field (do not regenerate expected files from the new code; edit them to add the field) and ledger it.
- [ ] `defaults()` export = merge of slice defaults (same key order is irrelevant; values identical).

### Task 3: Actions

**Files:** `features/settings/internal/actions/<area>.actions.ts` (one per area that has actions), `actions/settings-this.ts` (`SettingsThis` type).

- [ ] Move the 170 actions (`stores/settings.ts:927–1793`) verbatim into area objects. Each method declares `this: SettingsThis` where `SettingsThis = Settings & { persist(): void } & <actions it calls>`. Avoid circular type references (e.g. type cross-called actions with an explicit minimal interface). Keep comments.
- [ ] Store: `actions: { persist() {…}, ...viewActions, ...layoutActions, … }`. `vue-tsc` must accept every existing call site (`settings.toggleX()` in 83 files) without edits.
- [ ] `stores/settings.ts` ≤ 400 lines.

## Acceptance

- Golden test + partition test + all existing tests that import `stores/settings.ts` pass (run `cd app && pnpm test` once at the end — the full unit suite).
- `vue-tsc` clean for the whole project except files other PRs own that are mid-edit (list them).
- Report the new line count of `stores/settings.ts` and every new file.
