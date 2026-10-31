# Wave 3 PR-1 — Settings slice contract, versioned loader, golden fixtures, feature-purity rule

> **For agentic workers:** Execute task by task. Steps use `- [ ]`. You never commit and never spawn agents.

**Goal:** The settings contract (`SettingsSlice`, `SettingsMigration`, `loadSettings`) exists with tests, golden fixtures pin today's `load()` output, and a `feature-purity` arch rule guards `features/`. No caller changes: `stores/settings.ts` is untouched except where Task 1 says.

**Spec:** `docs/design/wave-refactor/2026-10-31-wave3-settings-shell-lld.md` §Rulings S1–S5, S17, §PR-1. ADR 0005. Precedents: `app/src/lib/theme/migrate.ts`, `app/src/platform/ipc/validation.service.ts`, `app/arch/lib-purity.rule.ts`.

## Global constraints (all Wave 3 plans)

- No behavior change. Root `CLAUDE.md` invariants hold; `docs/conventions/file-roles.md` names (incl. new `.slice.ts`, `.actions.ts`).
- `.ts` ≤ 400 lines, `.vue` ≤ 500, `.rs` ≤ 600 for every new or touched file you create. No `any`. Local imports end in `.ts`.
- Tests: `cd app && node --experimental-transform-types --import ./scripts/node-test-loader.mjs --test <files>`. Arch: `cd app && node --test arch/<file>`. Types: `cd app && pnpm exec vue-tsc --noEmit 2>&1 | grep <your paths>` (other workers' files may be red — ignore those, report them).
- Never edit `app/arch/baseline.json`, `app/CLAUDE.md`, or files another PR owns (LLD §File ownership).
- Write a ledger line for every decision the plan does not settle into `.superpowers/sdd/2026-10-31-wave3-pr<N>/progress.md`: `Ruling: <decision> — <reason> — cost if wrong: <x>`. Also log task status there.
- Finish with a report: files changed, tests added (count), commands run with exit codes, open issues.

---

### Task 1: Golden fixtures from today's store

**Files:** `app/src/features/settings/internal/__fixtures__/blobs/*.json` (8), `__fixtures__/expected/*.json` (8), `app/src/features/settings/internal/local-storage-stub.ts`, `settings-golden.test.ts`, `app/scripts/capture-settings-golden.ts` (one-off generator, kept for re-runs).

- [ ] Blobs (realistic, hand-written from `Settings` in `app/src/stores/settings.ts:39–500`): `empty` (`{}`), `v36-minimal` (≈10 keys an early build wrote: theme, viewMode, fontSize, fontFamily, wordWrap, showLineNumbers, language `en`), `v4-beta` (≈40 keys, no markers, `showAgentPanel:false`, `smartQuotes:true`, `showFileTree:false`), `full-current` (every key of `defaults()` with non-default values where cheap, all markers true), `tampered` (out-of-range `autoSaveDelayMs`, `pdfDefaults.customWidthMm: 9999`, bad `appearance`, `keybindings` with a number value, `explorerSortByFolder` with a bad mode, `gitTrustedRepos` mixed types), `zh` (`language:'zh'`), `legacy-keybindings` (lens keybinding ids `migrateLensKeybindings` rewrites — read `lib/mindmap-lens.ts`), `unknown-keys` (two keys not in `Settings`, e.g. `futureFlag`, `aiFutureThing`).
- [ ] `local-storage-stub.ts`: `withLocalStorage(seed)` installs `globalThis.localStorage` (Map-backed: getItem/setItem/removeItem/clear/key/length) and returns `{ restore() }`.
- [ ] Generator script: for each blob, seed the stub, `setActivePinia(createPinia())`, read `useSettingsStore().$state`, write `expected/<name>.json` (JSON, 2-space, keys sorted). Run it once now with `node --experimental-transform-types --import ./scripts/node-test-loader.mjs scripts/capture-settings-golden.ts`. Also capture `expected/<name>.hadStored.json` is not needed: store `hadStored` in the test as `name !== 'none'`.
- [ ] A ninth case `none` (no stored blob) → `expected/none.json`.
- [ ] `settings-golden.test.ts`: per case, fresh pinia + stub → `$state` (sorted keys, minus `settingsVersion`) deep-equals expected; `hadStoredSettings()` true except `none`. Module-level `hadStoredSettingsAtLoad` is sticky — if it blocks the `none` case, assert `hadStored` only via `loadSettings` in Task 2 and log a Ruling.
- [ ] If `isMobile()` or any time/platform value makes output non-deterministic in Node, pin it in the stub (document it in the ledger).

### Task 2: Contract + loader + migrations

**Files:** `app/src/features/settings/contracts/{settings-slice.port.ts,index.ts}`, `internal/{settings-load.service.ts,settings-migrations.ts,settings-load.service.test.ts,settings-migrations.test.ts}`.

- [ ] Port per LLD §PR-1 Contracts: `SETTINGS_STORAGE_KEY`, `SETTINGS_VERSION = 2`, `SettingsSlice<S>`, `SettingsMigration`, `DriftReporter`, `SettingsSliceManifestSchema` (Zod: id kebab-case).
- [ ] `settings-migrations.ts`: `SETTINGS_MIGRATIONS: readonly SettingsMigration[]` = one step `{ to: 2, up }` performing, in today's order from `load()` (`stores/settings.ts:839–917`), only the **marker/one-time** steps that read `parsed`: zh→en, `migrateLensKeybindings` (after keybindings sanitize — keep in normalize if it depends on sanitized map; decide by reading, log a Ruling), `v4AgentPanelMigrated`, `fileTreeDefaultDesktopMigrated`, `smartQuotesOptInMigrated`, `v4810PreviewFontSynced`, `v491MobileLayoutMigrated`. `env.isMobile` replaces `isMobile()`. Today these run on **every** load and are guarded by markers; keep the marker guards so re-running is a no-op (a v2 blob still runs nothing new). Ruling S4: steps run when `(raw.settingsVersion ?? 1) < 2` **and** still check markers.
  - Careful: today's marker blocks read `parsed.X` but write `merged.X` (merge happens first). Port so the observable result is identical; the golden test is the judge.
- [ ] `loadSettings(raw, slices, migrations, opts)`: as LLD. Pure: no `localStorage`, no Vue. Drift: `slice.schema.safeParse(pick(merged, keys))`; on failure call `report` once per `slice.key` message; never modify values.
- [ ] Tests: no raw → defaults + `hadStored:false`; bad JSON → same; unknown key kept; drift reported once and value kept; migration skipped at version 2; `settingsVersion` set to 2; slices' normalize called in order (spy).
- [ ] Do **not** wire the store yet (PR-2). A test with two tiny fake slices is enough here; the golden equivalence for the real slices lands in PR-2.

### Task 3: `feature-purity` arch rule

**Files:** `app/arch/feature-purity.rule.ts`, `feature-purity.rule.test.ts`, `feature-purity.arch.test.ts`; `app/arch/baseline.schema.ts`, `baseline-file.ts`, `rebaseline.ts` (add `featurePurity` key per `app/arch/CLAUDE.md` §Run "Adding a rule").

- [ ] Rule: files under `app/src/features/` (scan rules as `lib-purity.rule.ts`) importing `vue`, `vue/*`, `pinia` fail unless path matches `/ui/`, basename `use[A-Z]*.ts`, or `*.store.ts`. Message: `[arch:feature-purity] <path> imports <mod>. Only ui/, use*.ts and *.store.ts may import vue/pinia under features/. See app/arch/CLAUDE.md.`
- [ ] Unit test with `withFixtureTree` (pass and fail cases). Arch test against the repo with the baseline.
- [ ] Report the violator list you measure (expected: `features/find/internal/cm-find-panel.ts`, `features/format/internal/table-editor-bus.ts`, `features/format/internal/formula-editor-bus.ts`). The controller writes them into `baseline.json` — **do not edit `baseline.json`**; tell the controller the exact JSON to add. The arch test will fail until then; that is expected.
- [ ] Update `app/arch/CLAUDE.md` rules table with the new row.

### Task 4: Docs

- [ ] `app/src/features/settings/CLAUDE.md`: what the feature is (contract, loader, migrations, golden fixtures; store wiring in PR-2; UI in PR-3), how to add a key, how to add a migration step (bump `SETTINGS_VERSION`, add a fixture), the flat-blob rule (ADR 0005).

## Acceptance

- New tests pass; `node --test arch/` passes once the controller adds the baseline key.
- `vue-tsc` clean for `features/settings/**` and `arch/**`.
- `stores/settings.ts` unchanged (`git diff --stat` shows it absent).
