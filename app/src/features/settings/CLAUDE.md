# features/settings

Settings contract: typed slices over one flat blob, a versioned loader, golden fixtures. Decision: [ADR 0005](../../../../docs/design/adr/0005-settings-slices.md). Design: [Wave 3 LLD](../../../../docs/design/wave-refactor/2026-10-31-wave3-settings-shell-lld.md).

## Status

Shipped (Wave 3): contract, loader, migrations, golden fixtures; `stores/settings.ts` calls `loadSettings` and spreads slice actions; panel pages rendered from the registry; typed `SettingsKey`; `readStoredSetting`.

The golden test pins `load()` for every fixture blob.

## Registry

| What | Where |
|---|---|
| `SETTINGS_SLICES` (ordered) | `internal/settings-slices.ts`; exported by `contracts/settings-store.contract.ts`; the store reads it from there (state is created on first `useSettingsStore()`; no setter, so tests and the app load identically) |
| Shell registry | `shell/settings-registry.service.ts` re-exports the list; its test is the one key-ownership check (every `SettingsKey` in exactly one slice, page order = `ALL_PAGE_KEYS`, every editor feature's keys exist) |
| `SETTINGS_PAGES` (ordered) | `shell/settings-pages.ts`; `App.vue` provides it under `SETTINGS_PAGES_KEY` (`contracts/settings-pages.key.ts`); `SettingsPanel.vue` injects it and throws if missing |
| `SettingsKey` = `keyof Settings` | `contracts`; `EditorFeature.settingsKeys` uses it |
| `readStoredSetting(key)` | `contracts`; raw stored value or `undefined`, never throws. For stores that need a flag before hydration (`tabs-persist.ts`, `tiles.ts`); `restoreSessionEnabled()` sits beside it and both stores share it; callers keep their own type guard and fallback |

## Layout

| Path | Role |
|---|---|
| `contracts/settings-slice.port.ts` | `SETTINGS_STORAGE_KEY`, `SETTINGS_VERSION`, `SettingsSlice`, `SettingsMigration`, `DriftReporter`, `SettingsSliceManifestSchema` |
| `internal/settings-load.service.ts` | `loadSettings(raw, slices, migrations, opts)`; pure, no `localStorage`, no Vue |
| `internal/settings-migrations.ts` | `SETTINGS_MIGRATIONS`; step `to: 2` holds today's one-time steps |
| `internal/local-storage-stub.ts` | `withLocalStorage(seed)`: Map-backed `localStorage` + pinned `navigator` |
| `internal/stored-setting.ts` | `readStoredSetting`; reads `SETTINGS_STORAGE_KEY` without the store |
| `contracts/settings-pages.key.ts` | `SETTINGS_PAGES_KEY`, `SettingsPageEntry` (in the barrel; no `.vue`) |
| `contracts/settings-pages.contract.ts` | The 19 page components. Imported only by `shell/settings-pages.ts`, never through `contracts/index.ts` (the stores import the barrel; `stores/settings.import-graph.test.ts` fails if its graph reaches a `.vue`) |
| `ui/SettingsPanel.vue`, `ui/pages/*Page.vue`, `ui/settings-page.css` | Panel shell and one multi-root page per IA page; block CSS in `settings-page.css`, loaded per page |
| `internal/__fixtures__/golden-capture.fixture.ts` | Test/script helper: store state from a seeded blob; resets the `hadStoredSettings` latch per call. Under `__fixtures__/`, which `feature-purity` exempts |
| `internal/__fixtures__/blobs/` | Pre-wave blobs: `empty`, `v36-minimal`, `v4-beta`, `full-current`, `tampered`, `zh`, `legacy-keybindings`, `unknown-keys` |
| `internal/__fixtures__/expected/` | What the store produced for each blob (plus `none`) before the refactor |

## Rules

- **Flat blob.** One JSON object under `solomd.settings.v1`, forever. Slices partition the schema, never the storage. Do not nest or split without a superseding ADR.
- **Report mode.** The loader runs normalizers, then validates each slice with Zod and reports drift (`[settings:drift] <slice>.<key>: <issue>`). It never drops or resets a value. Unknown keys pass through.
- **Order is behavior.** Slice `normalize` runs in registry order; migrations run in ascending `to`. Reordering changes output; the golden test fails.
- **Never rename or retype a stored key** without a migration step.

## Add a key

1. Add it to the owning slice: schema, `defaults()`, optional `normalize`.
2. Add it to a fixture blob only if its default is not enough to pin behavior.
3. Never put a key in two slices.

## Add a page

1. Write `ui/pages/<Cat><Page>Page.vue` as a multi-root fragment: each `data-cat` block is a direct child of `.settings__body`.
2. Add the page key to `lib/settings-nav.ts` (`ALL_PAGE_KEYS`) and the nav tree.
3. Export the component from `contracts/settings-pages.contract.ts` (not the barrel); add `{ key, component }` to `shell/settings-pages.ts` in `ALL_PAGE_KEYS` order. The registry test fails on a mismatch.

## Panel rules

- **Fragments.** Search, `style.order` and `pageVisibilityCss` need `[data-cat]` blocks as direct children of the body. Chrome rule: `.settings__body[data-searching] > :deep([data-cat]...)`.
- **Watcher order.** `SettingsPanel.vue` calls `useSettingsNavigation` → `useSettingsSearch` → `useSearchShortcuts`. Reordering changes behavior.
- **Page-local transient state re-initializes on every open.** The shortcut filter, the custom-font mode and the mind-map error live in page components; `DsModal` renders its slot with `v-if`, so closing the panel unmounts them. Accepted: no persisted input is lost.

## Add a migration step

1. Bump `SETTINGS_VERSION` in the port.
2. Append `{ to: N, up }` to `SETTINGS_MIGRATIONS`. `up` is pure, returns a new object, and is idempotent: guard on a marker key so re-running is a no-op. A downgrade write resets `settingsVersion` to the older build's value, so the step runs again on the next upgrade.
   `normalize` sees the migrated record, so a migrated key it rebuilds keeps the migration's result.
3. Add a blob that exercises it under `__fixtures__/blobs/`.
4. Regenerate expected output only for an intended change:

```bash
cd app && node --experimental-transform-types --import ./scripts/node-test-loader.mjs scripts/capture-settings-golden.ts
```

Review the diff of `expected/`; an unintended change is a regression.

## Tests

```bash
cd app && node --experimental-transform-types --import ./scripts/node-test-loader.mjs --test src/features/settings/internal/*.test.ts
```

The golden fixture calls `__resetHadStoredForTests()` (exported from `stores/settings.ts` for tests only) per case, so case order does not matter.
