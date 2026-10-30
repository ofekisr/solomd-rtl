# 0007. Settings registry as shipped

**Status**: accepted · **Date**: 2026-10-31

## Context

- [ADR 0005](0005-settings-slices.md) Decision 5 says `shell/settings-registry.service.ts` lists slices and pages in order.
- The store needs the slice list without importing `main.ts` or `shell/`, and the page list imports `.vue` files that the stores must never reach (`stores/settings.import-graph.test.ts`).
- Wave 3 shipped a different split. Root Invariant 1 requires a superseding ADR when code and an accepted ADR disagree.
- Spec: [Wave 3 LLD](../superpowers/specs/2026-10-31-wave3-settings-shell-lld.md), "As shipped".

## Decision

Supersedes ADR 0005 Decision 5 only.

1. **Slices**: `features/settings/internal/settings-slices.ts` holds the ordered `SETTINGS_SLICES`; `contracts/settings-store.contract.ts` exports it. The store reads it from there.
2. **Pages**: `shell/settings-pages.ts` holds the ordered `SETTINGS_PAGES`. `App.vue` provides it under `SETTINGS_PAGES_KEY`; `SettingsPanel.vue` injects it and throws if missing. Page components are exported from `contracts/settings-pages.contract.ts`, never the barrel.
3. **`shell/settings-registry.service.ts`** re-exports the slices and holds the registry test (key ownership, page order, editor-feature keys). Nothing in production imports it.
4. **ADR 0006 as shipped**: `resolveValidationMode(env)` takes the Vite `env` (`{ DEV?: boolean } | undefined`), not no arguments.
5. **Role suffixes under `features/*/contracts`**: `.key.ts` (an `InjectionKey` and its entry type) and `.contract.ts` (re-export surface that must stay out of the barrel). Both are in [file roles](../conventions/file-roles.md).

## Consequences

- Easier: the store and the loader stay free of `.vue` and `shell/`; the registry test still guards ownership.
- Harder: a new page touches `lib/settings-nav.ts`, `settings-pages.contract.ts` and `shell/settings-pages.ts`; the registry test fails on a mismatch.
- ADR 0005 Decisions 1–4 and 6 stand.
