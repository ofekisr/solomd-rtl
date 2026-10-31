# 0005. Settings: typed slices over one flat blob, a versioned loader, and a page registry

**Status**: accepted · Decision 5 superseded by 0007 · **Date**: 2026-10-31

## Context

- `stores/settings.ts` is 1793 lines: one `Settings` interface (172 keys), one `defaults()`, one `load()` with ad-hoc clamps and five marker-guarded one-time migrations, and 170 actions.
- The stored blob is one flat JSON object under `localStorage['solomd.settings.v1']`. `stores/tabs.ts` and `stores/tiles.ts` read flat keys from it directly.
- `SettingsPanel.vue` (2612 lines) hard-codes about 150 `data-cat` blocks. Search and page visibility depend on those blocks being direct children of `.settings__body`.
- HLD v3.2 Wave 3: per-feature settings slice schema + versioned migration (theme pattern); old settings must load unchanged; Settings UI rendered from the feature registry.
- Full design: [Wave 3 LLD](../wave-refactor/2026-10-31-wave3-settings-shell-lld.md).

## Decision

1. **Slices partition the schema, not the storage.** A `SettingsSlice` (`features/settings/contracts/settings-slice.port.ts`) owns a set of keys: a Zod object, `defaults()`, optional `normalize`. Every key belongs to exactly one slice. The blob stays one flat object under `solomd.settings.v1`, forever.
2. **Versioned loader.** `loadSettings` parses, runs `SettingsMigration` steps above the blob's `settingsVersion` (missing = 1), merges slice defaults, runs each slice's `normalize` in registry order, writes `settingsVersion`, then validates in report mode: drift is reported in dev, values are never dropped. Unknown keys pass through.
3. **Golden fixtures pin behavior.** Pre-wave blobs and today's `load()` output are committed; the loader and the store must reproduce them.
4. **Store API unchanged.** `useSettingsStore` keeps its id, keys and action names. Actions live in `<area>.actions.ts` mixins.
5. **Page registry.** Each Settings page is a multi-root component; `shell/settings-registry.service.ts` lists slices and pages in order; `SettingsPanel.vue` renders the list.
6. **New file roles**: `.slice.ts` (schema, defaults, normalize — no IPC, no Vue) and `.actions.ts` (store actions for one area — no IPC).

## Consequences

- Easier: a feature adds a setting by adding a key to its slice; drift in old blobs shows up in dev; key ownership is checkable.
- Harder: a one-time data change is a migration step with a version bump and a golden fixture, not an `if (!parsed.marker)` in `load()`.
- Must: never rename or retype a stored key without a migration step; never split the blob without a superseding ADR; keep normalize order stable (golden test).
