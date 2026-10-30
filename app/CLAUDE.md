# app/

Vue 3 + CodeMirror 6 + Pinia front end. `src-tauri/` is the Rust desktop shell. Project rules live in the root `CLAUDE.md` §Invariants. File naming: [file roles](../docs/conventions/file-roles.md).

## Map

| Path | Today | Wave target |
|---|---|---|
| `src/App.vue` | Thin host (≤ 500 lines): services, startup order, root element | Stays |
| `src/components/shell/` | App chrome split out of `App.vue`: layout, right sidebar, dialogs host | Stays |
| `src/shell/` | App-wide services (window, file-open, shortcuts, session, updates). Read [shell/CLAUDE.md](src/shell/CLAUDE.md) | Stays |
| `src/components/` | ~118 flat Vue components; `git/`, `properties/` subfolders | Empties into `features/<f>/ui/` by Wave 4 |
| `src/composables/` | `use*` hooks; host state for `App.vue` (`createX`/`useX`, see shell/CLAUDE.md) | Move with their feature; host ones stay |
| `src/stores/` | Pinia stores; `settings.ts` holds all settings | Per-feature settings slices (Wave 3) |
| `src/platform/` | Typed ports over Tauri; only importer of `@tauri-apps/*`. Read [platform/CLAUDE.md](src/platform/CLAUDE.md) | Stays |
| `src/lib/` | Mostly pure TS: CM extensions (`cm-*.ts`), parsers, `theme/`, `git-pane/`, `fixtures/`. Some files still import `vue`/`pinia`/`@tauri-apps/*` | Stays. Fully pure as the PR-2 baseline shrinks |
| `src/ui/` | `Ds*` design-system primitives | Stays |
| `src/i18n/` | Locale tables. New strings go in `en.ts` | Keys move into features (Wave 2+) |
| `src/styles/` | Global CSS and tokens | Stays |
| `src/dev/` | Dev-only render harnesses | Stays |
| `src-tauri/src/` | Rust commands (`commands.rs`, `ai_proxy.rs`, `git_pane/`) | Grouped by domain, mirroring `platform/` |
| `e2e/` | Playwright theme e2e (macOS baselines) | Stays |

Planned folders, not created yet: `src/features/` (Wave 1+), `src/ai/` (Wave 4).

## Tests

| Kind | Where | Run |
|---|---|---|
| Unit | Co-located `src/**/*.test.ts` | `pnpm --dir app test` |
| Types | All of `src/` | `pnpm --dir app exec vue-tsc --noEmit` |
| e2e | `e2e/` | `pnpm --dir app exec playwright test --config e2e/playwright.config.ts` (macOS) |
| Arch | `arch/*.test.ts` | `pnpm --dir app arch` |

Unit tests run on Node type-stripping: import local files with the `.ts` extension.

## Which CLAUDE.md to read

| Working in | Read first |
|---|---|
| Anywhere | Root `CLAUDE.md` |
| `src/features/<f>/` | That feature's `CLAUDE.md` (each feature gets one from Wave 1) |
| `arch/` | [arch/CLAUDE.md](arch/CLAUDE.md) |
| `src/platform/` | [src/platform/CLAUDE.md](src/platform/CLAUDE.md) |
| `src/shell/`, `src/App.vue`, `src/components/shell/` | [src/shell/CLAUDE.md](src/shell/CLAUDE.md) |
| `src/lib/theme/` | `docs/superpowers/specs/2026-10-29-theme-layer-design.md` |
| `../demos/` | [demos/CLAUDE.md](../demos/CLAUDE.md) |

Changed code makes an area's `CLAUDE.md` wrong? Fix it in the same commit.
