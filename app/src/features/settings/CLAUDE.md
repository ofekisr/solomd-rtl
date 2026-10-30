# features/settings

Settings contract: typed slices over one flat blob, a versioned loader, golden fixtures. Decision: [ADR 0005](../../../../docs/adr/0005-settings-slices.md). Design: [Wave 3 LLD](../../../../docs/superpowers/specs/2026-10-31-wave3-settings-shell-lld.md).

## Status

| Part | State |
|---|---|
| Contract, loader, migrations, golden fixtures | Shipped (Wave 3 PR-1) |
| `stores/settings.ts` calls `loadSettings` and spreads slice actions | PR-2 |
| Settings pages rendered from the registry | PR-3 |

Until PR-2 nothing imports `internal/settings-load.service.ts`: the store still has its own `load()`. The golden test pins that `load()`.

## Layout

| Path | Role |
|---|---|
| `contracts/settings-slice.port.ts` | `SETTINGS_STORAGE_KEY`, `SETTINGS_VERSION`, `SettingsSlice`, `SettingsMigration`, `DriftReporter`, `SettingsSliceManifestSchema` |
| `internal/settings-load.service.ts` | `loadSettings(raw, slices, migrations, opts)`; pure, no `localStorage`, no Vue |
| `internal/settings-migrations.ts` | `SETTINGS_MIGRATIONS`; step `to: 2` holds today's one-time steps |
| `internal/local-storage-stub.ts` | `withLocalStorage(seed)`: Map-backed `localStorage` + pinned `navigator` |
| `internal/useGoldenCapture.ts` | Test/script helper: store state from a seeded blob (named `use*` because it imports pinia) |
| `internal/__fixtures__/blobs/` | Pre-wave blobs: `empty`, `v36-minimal`, `v4-beta`, `full-current`, `tampered`, `zh`, `legacy-keybindings`, `unknown-keys` |
| `internal/__fixtures__/expected/` | What the store produced for each blob (plus `none`) before the refactor |

## Rules

- **Flat blob.** One JSON object under `solomd.settings.v1`, forever. Slices partition the schema, never the storage. Do not nest or split without a superseding ADR.
- **Report mode.** The loader runs normalizers, then validates each slice with Zod and reports drift (`[settings:drift] <slice>.<key>: <issue>`). It never drops or resets a value. Unknown keys pass through.
- **Order is behavior.** Slice `normalize` runs in registry order; migrations run in ascending `to`. Reordering changes output; the golden test fails.
- **Never rename or retype a stored key** without a migration step.

## Add a key

1. Add it to the owning slice: schema, `defaults()`, optional `normalize`. (Slices arrive in PR-2.)
2. Add it to a fixture blob only if its default is not enough to pin behavior.
3. Never put a key in two slices.

## Add a migration step

1. Bump `SETTINGS_VERSION` in the port.
2. Append `{ to: N, up }` to `SETTINGS_MIGRATIONS`. `up` is pure, returns a new object, and guards on a marker key so re-running is a no-op.
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

The golden test depends on the sticky module-level `hadStoredSettingsAtLoad` in `stores/settings.ts`: the `none` case must run first in its file.
