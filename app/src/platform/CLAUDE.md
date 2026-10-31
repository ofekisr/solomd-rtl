# platform/

Typed ports over Tauri. The only place that imports `@tauri-apps/*`.
Decision: [ADR 0003](../../../docs/design/adr/0003-platform-ports.md). Design: [Wave 1 platform LLD](../../../docs/design/wave-refactor/2026-10-30-wave1-platform-lld.md).

## Ports

Rust paths are under `src-tauri/src/` (files holding the port's `#[tauri::command]` fns). Command ports wrap `invoke`; plugin ports wrap a Tauri plugin or API module.

| Dir | Export | Kind | Rust module(s) / plugin |
|---|---|---|---|
| `fs/` | `fsPort` | command | `commands/`, `search.rs`, `replace.rs`, `watcher.rs` |
| `android/` | `androidPort` | command | `saf_android.rs`, `storage_android.rs` |
| `cloud/` | `cloudPort` | command | `cloud_folder.rs` |
| `convert/` | `convertPort` | command | `convert/`, `pandoc.rs`, `image_upload/` |
| `git-sync/` | `gitSyncPort` | command | `github_sync/`, `crypto/` |
| `git-history/` | `gitHistoryPort` | command | `git_history.rs` |
| `git-pane/` | `gitPaneService()` | adapter over `lib/git-pane/service.ts` (`GitPaneService`) | `git_pane/` (`gitpane_*` commands, `gitpane:changed` event) |
| `ai/` | `aiPort` | command | `ai_proxy.rs`, `ollama.rs`, `cost_meter.rs`, `agent_trace.rs`, `agent_tools.rs`, `cjk_proofread.rs` |
| `ai-tools/` | `aiToolsPort` | command | `recipe_runner.rs`, `integrations/`, `mcp_profiles.rs`, `cookbook.rs` |
| `rag/` | `ragPort` | command | `rag.rs`, `workspace_index/` |
| `settings/` | `settingsPort` | command | `themes.rs`, `spellcheck.rs`, `directive_completions.rs`, `set_default.rs`, `runner.rs` |
| `capture/` | `capturePort` | command | `capture_endpoint/`, `quick_capture.rs`, `rest_api/` |
| `window/` | `windowCommandsPort` | command | `runner.rs`, `win_chrome.rs`, `devtools.rs` |
| `window/` | `windowPort` | API | `@tauri-apps/api` window, webview, app; deep-link plugin |
| `events/` | `eventsPort` | API | `@tauri-apps/api/event` |
| `dialog/` | `dialogPort` | plugin | `plugin-dialog` |
| `opener/` | `openerPort` | plugin | `plugin-opener` |
| `clipboard/` | `clipboardPort` | plugin | `plugin-clipboard-manager` |
| `path/` | `pathPort` | plugin | `@tauri-apps/api/path`, `@tauri-apps/api/core` `convertFileSrc`, `plugin-fs` |

`ipc/` is the generic core: catalog types (`command.port.ts`), `command-name.ts` (`snakeToCamel`), `platform-error.ts` (`PlatformUnsupportedError`), Tauri/web command adapters, validation (`resolveValidationMode`), fixture checker.

## Rules

- Callers import port instances from `../platform/index.ts` only. `import type` of a port interface from `<x>/<x>.port.ts` is fine (injected deps in `shell/`).
- Adapters return raw IPC results and never wrap errors.
- Sync stays sync (`windowPort.currentWindow`, `pathPort.sep`).
- Web adapters reject with `PlatformUnsupportedError` (sync methods throw it).
- `.port.ts` holds types and Zod only; no `@tauri-apps/*`. `ipc/command.port.ts` holds types only; `PlatformUnsupportedError` lives in `ipc/platform-error.ts`, `snakeToCamel` in `ipc/command-name.ts`.
- Adapters export their injected-module types as test seams.
- Schemas must match Rust serde output and the args callers pass today.

## Validation modes

| Mode | Where | Behavior |
|---|---|---|
| `strict` | dev (`import.meta.env.DEV`), unit tests | Throw on schema mismatch ([ADR 0006](../../../docs/design/adr/0006-strict-ipc-validation-in-dev.md)) |
| `off` | prod | No parsing |
| `report` | only callers passing it to `createValidation` | Warn `[platform:drift]` once, return raw value |

## Add a command

1. Add the entry to the domain's `<x>Commands` catalog in `<x>.port.ts` (args + result Zod).
2. Add a fixture in `<x>.port.test.ts`; `catalogFixtureProblems` (used by catalog tests, not `strict`) fails on missing or invalid ones.
3. The method name is the camelCased command; no adapter edit needed.

## Add a domain

1. `<x>.port.ts`, `<x>.tauri.adapter.ts`, `<x>.web.adapter.ts`, `<x>.port.test.ts`.
2. One import pair and one `export const <x>Port` line in `index.ts`.
3. Add a row to the table above and a case to `index.test.ts`.
