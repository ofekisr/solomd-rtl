# app/

Vue 3 + CodeMirror 6 + Pinia front end. `src-tauri/` is the Rust desktop shell. Project rules live in the root `CLAUDE.md` §Invariants. File naming: [file roles](../docs/conventions/file-roles.md).

## Map

| Path | Today | Wave target |
|---|---|---|
| `src/App.vue` | Root host, ~2500 lines | Split into `shell/` + services (Wave 1) |
| `src/components/` | ~118 flat Vue components; `git/`, `properties/` subfolders | Empties into `features/<f>/ui/` by Wave 4 |
| `src/composables/` | `use*` hooks | Move with their feature |
| `src/stores/` | Pinia stores; `settings.ts` holds all settings | Per-feature settings slices (Wave 3) |
| `src/lib/` | Pure TS: CM extensions (`cm-*.ts`), parsers, `theme/`, `git-pane/` | Stays. Pure: no `vue`, `pinia`, `@tauri-apps/*` |
| `src/ui/` | `Ds*` design-system primitives | Stays |
| `src/i18n/` | Locale tables. New strings go in `en.ts` | Keys move into features (Wave 2+) |
| `src/styles/` | Global CSS and tokens | Stays |
| `src/dev/` | Dev-only render harnesses | Stays |
| `src-tauri/src/` | Rust commands (`commands.rs`, `ai_proxy.rs`, `git_pane/`) | Grouped by domain, mirroring `platform/` |
| `e2e/` | Playwright theme e2e (macOS baselines) | Stays |

Planned folders, not created yet: `src/platform/` (Wave 1), `src/features/` (Wave 1+), `src/shell/` (Wave 1), `src/ai/` (Wave 4), `arch/` (Wave 0 PR-2).

## Tests

| Kind | Where | Run |
|---|---|---|
| Unit | Co-located `src/**/*.test.ts` | `pnpm --dir app test` |
| Types | All of `src/` | `pnpm --dir app exec vue-tsc --noEmit` |
| e2e | `e2e/` | `pnpm --dir app exec playwright test --config e2e/playwright.config.ts` (macOS) |
| Arch | `arch/*.arch.test.ts` (from Wave 0 PR-2) | `pnpm --dir app arch` (from PR-3) |

Unit tests run on Node type-stripping: import local files with the `.ts` extension.

## Which CLAUDE.md to read

| Working in | Read first |
|---|---|
| Anywhere | Root `CLAUDE.md` |
| `src/features/<f>/` | That feature's `CLAUDE.md` (each feature gets one from Wave 1) |
| `arch/` | `arch/CLAUDE.md` (from Wave 0 PR-2) |
| `src/lib/theme/` | `docs/superpowers/specs/2026-10-29-theme-layer-design.md` |
| `../demos/` | [demos/CLAUDE.md](../demos/CLAUDE.md) |

Changed code in an area? Update that area's `CLAUDE.md` in the same commit.
