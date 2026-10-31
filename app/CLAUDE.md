# app/

Vue 3 + CodeMirror 6 + Pinia front end. `src-tauri/` is the Rust desktop shell. Project rules live in the root `CLAUDE.md` §Invariants. File naming: [file roles](../docs/conventions/file-roles.md).

## Map

| Path | Today | Wave target |
|---|---|---|
| `src/App.vue` | Thin host (≤ 500 lines): services, startup order, root element | Stays |
| `src/components/shell/` | App chrome split out of `App.vue`: layout, right sidebar, dialogs host | Stays |
| `src/shell/` | App-wide services (window, file-open, shortcuts, session, updates), the editor-feature factory list and the settings page/slice registry, both provided to features by `App.vue`. Read [shell/CLAUDE.md](src/shell/CLAUDE.md) | Stays |
| `src/features/` | Editor features (Wave 2), one folder each: `editor` (host, plain engine, core/appearance/live-render), `find`, `vim`, `spellcheck`, `ai-rewrite`, `focus-mode`, `image-upload`, `completion`, `session`, `folds`, `format`, `context-menu`; plus `file-tree` (sidebar tree) and `settings` (slices, loader, panel pages). Editor features are registered in `shell/editor-registry.service.ts` and reach `Editor.vue` by `provide`/`inject`. Read [features/editor/CLAUDE.md](src/features/editor/CLAUDE.md) and [features/settings/CLAUDE.md](src/features/settings/CLAUDE.md) | Grows per wave |
| `src/components/` | Vue components grouped by domain: `mindmap/`, `preview/`, `pane/`, `panels/`, `dialogs/`, `settings/`, `github-sync/`, `theme/`, `bases/`, `ai/`, `git/`, `properties/`, `shell/`; about 40 ungrouped at the top level. A component's `use*`/helper `.ts` files sit beside it | Empties into `features/<f>/ui/` by Wave 4 |
| `src/composables/` | `use*` hooks; host state for `App.vue` (`createX`/`useX`, see shell/CLAUDE.md). Subfolders: `mindmap/`, `git/`, `theme/`, `commands/`, `files/` | Move with their feature; host ones stay |
| `src/stores/` | Pinia stores; `settings.ts` is the store shell over the slices in `features/settings/` (state, `persist`, slice actions). Stores read a stored flag before hydration through `readStoredSetting` | Stays |
| `src/platform/` | Typed ports over Tauri; only importer of `@tauri-apps/*`. Read [platform/CLAUDE.md](src/platform/CLAUDE.md) | Stays |
| `src/lib/` | Mostly pure TS: CM extensions (`cm/`), the Markdown renderer (`markdown/`), exporters (`pdf/`, `docx/`), image helpers (`image/`), parsers, `mindmap/` (`.mmap` model; also imported by `mcp-mindmap/`), `theme/`, `git-pane/`, `fixtures/`. 1 file still imports `vue`/`pinia`/`@tauri-apps/*` (`libPurity` baseline: `ai-activity.ts`) | Stays. Fully pure when it moves (Wave 4) |
| `src/ui/` | `Ds*` design-system primitives | Stays |
| `src/i18n/` | Locale tables. New strings go in `en.ts`. `keys.ts` exports `I18nKey` (dot-paths of `en`) | Tables stay; keys are typed per feature |
| `src/styles/` | Global CSS and tokens | Stays |
| `src/dev/` | Dev-only render harnesses | Stays |
| `src-tauri/src/` | Rust commands grouped by domain: `commands/` (fs, frontmatter, print), `git_pane/` (`cli/actions/` etc.), `github_sync/`, `workspace_index/`, `capture_endpoint/`, … Every `.rs` ≤ 600 lines except the AI files (`ai_proxy.rs`, `agent_*.rs`, `recipe*.rs`, `rag.rs`, `ollama.rs`, `trace.rs`). `generate_handler!` in `lib.rs` and `runner.rs` names commands by module path | AI files split in Wave 4 |
| `e2e/` | Playwright theme e2e (macOS baselines) | Stays |

Planned folder, not created yet: `src/ai/` (Wave 4).

## Tests

| Kind | Where | Run |
|---|---|---|
| Unit | Co-located `src/**/*.test.ts` | `pnpm --dir app test` |
| Types | All of `src/` | `pnpm --dir app exec vue-tsc --noEmit` |
| e2e | `e2e/` | `pnpm --dir app exec playwright test --config e2e/playwright.config.ts` (macOS) |
| Arch | `arch/*.test.ts` | `pnpm --dir app arch` |

Unit tests run with `--experimental-transform-types` and `scripts/node-test-loader.mjs` (extensionless imports resolve to `.ts`; `.vue`/`.css` are stubbed), so `lib/` files no longer need `.ts` added just for tests.

## Which CLAUDE.md to read

| Working in | Read first |
|---|---|
| Anywhere | Root `CLAUDE.md` |
| `src/features/<f>/` | That feature's `CLAUDE.md` (each feature gets one from Wave 1) |
| `src/features/editor/` | [src/features/editor/CLAUDE.md](src/features/editor/CLAUDE.md) |
| `arch/` | [arch/CLAUDE.md](arch/CLAUDE.md) |
| `src/platform/` | [src/platform/CLAUDE.md](src/platform/CLAUDE.md) |
| `src/shell/`, `src/App.vue`, `src/components/shell/` | [src/shell/CLAUDE.md](src/shell/CLAUDE.md) |
| `src/lib/theme/` | `docs/superpowers/specs/2026-10-29-theme-layer-design.md` |
| `../demos/` | [demos/CLAUDE.md](../demos/CLAUDE.md) |

Changed code makes an area's `CLAUDE.md` wrong? Fix it in the same commit.
