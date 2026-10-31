# Wave 3 PR-11 — Integrate

> **For agentic workers:** Execute task by task. Steps use `- [ ]`. You never commit and never spawn agents.

**Goal:** Settings UI and store read slices/pages from one registry in `shell/`; editor registry injected (no feature→shell import); typed `SettingsKey`/`I18nKey` replace regex/resolve checks; `cm-probe` → `contracts/testkit.ts`; buses become composables; `tabs.ts`/`tiles.ts` read flags through the settings contract. No behavior change.

**Spec:** LLD S9, S16–S20, §PR-11; ADR 0004, 0005.

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

**Owns:** everything needed for the tasks below (batch B and C are committed; you run alone).

### Task 1: Settings registry in `shell/`

- [ ] `app/src/shell/settings-registry.service.ts`: `SETTINGS_SLICES` (moved from `features/settings/internal/settings-slices.ts`, same order) and `SETTINGS_PAGES` (moved from `features/settings/internal/settings-pages.ts`). The `.service.ts` must not import `vue`: pages carry components → if that forces a Vue import, keep `SETTINGS_PAGES` in `shell/settings-pages.ts` (no role suffix; ledger it) and slices in the service.
- [ ] Wiring without a feature→shell import (S16 rule applies here too): `features/settings/contracts` exports `SETTINGS_SLICES_KEY`/`SETTINGS_PAGES_KEY` (`InjectionKey`s) for the panel; the store (Pinia, created before `App` provides) reads slices from a setter `configureSettingsSlices(list)` called once in `main.ts` before `app.use(pinia)`… — choose the simplest wiring that keeps `stores/settings.ts` free of `shell/` imports and keeps load timing identical (state is created on first `useSettingsStore()`); ledger the choice. Golden test must stay green.
- [ ] Registry tests: partition (every `SettingsKey` in exactly one slice), `SETTINGS_PAGES` keys = `ALL_PAGE_KEYS` order, every `EditorFeature.settingsKeys` (all 13 registered features) ⊂ union of slice keys.

### Task 2: Typed keys

- [ ] `SettingsKey = keyof Settings` exported from `features/settings/contracts`; `I18nKey` = union of dot-paths of `en` (`app/src/i18n/en.ts`), defined in `app/src/i18n/keys.ts` (type-level recursion; if TS depth limits bite, generate a literal union with a script and a test that it is fresh — ledger it).
- [ ] `EditorFeature.settingsKeys: readonly SettingsKey[]`, `i18nKeys: readonly I18nKey[]` (`features/editor/contracts/editor-feature.port.ts`); the manifest Zod schema stays string arrays.
- [ ] Delete the regex/source-reading checks in 7 feature tests (`grep -rln "stores/settings.ts', import.meta.url" app/src/features`) and the `resolveKey` checks; the registry test from Task 1 replaces them. Test count may drop by the deleted assertions only — record before/after.

### Task 3: Injected editor registry (S16)

- [ ] `features/editor/contracts`: `EDITOR_REGISTRY_FACTORY: InjectionKey<() => EditorFeatureRegistry>`. `App.vue` (or the shell host that mounts editors) `provide`s `createEditorRegistry`. `features/editor/ui/Editor.vue` `inject`s it (throw a clear error if missing). Delete the `../../../shell/editor-registry.service.ts` import. Update `features/editor/CLAUDE.md`, `shell/CLAUDE.md`.
- [ ] Any test mounting Editor logic outside App gets the factory from `shell/` directly.

### Task 4: Testkit + buses (S17, S18)

- [ ] `git mv features/editor/internal/cm-probe.ts features/editor/contracts/testkit.ts`; export from `contracts/index.ts`? No — tests import `contracts/testkit.ts` directly (keeps prod bundle clean); update all importers (~23).
- [ ] `git mv features/format/internal/table-editor-bus.ts features/format/internal/useTableEditorBus.ts`, same for formula; update importers (through `features/format/contracts/index.ts` re-exports). Report `featurePurity` keys removed.

### Task 5: Blob readers

- [ ] `features/settings/contracts`: `readStoredSetting<K extends SettingsKey>(key: K): Settings[K] | undefined` (reads `SETTINGS_STORAGE_KEY`, JSON-parses, returns the raw value or undefined; never throws). `stores/tabs.ts` and `stores/tiles.ts` use it; their `typeof === 'boolean'` guards and `true` fallbacks stay. Tests for the helper (missing, bad JSON, wrong type).

### Task 6: Docs

- [ ] `features/settings/CLAUDE.md` (registry, how to add a page), `app/CLAUDE.md` map rows (`features/` list incl. `settings`, `file-tree`; `stores/` row; `lib/` purity row; `components/` count), `shell/CLAUDE.md` (settings registry, editor factory provide). Report everything else the controller must update.

## Acceptance

- Full unit suite + arch green; `vue-tsc` clean; golden test green; no import from `features/**` into `shell/**` (`grep -rn "shell/" app/src/features --include=*.ts --include=*.vue` returns only comments).
