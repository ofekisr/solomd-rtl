# shell/

App-wide services extracted from `App.vue` (Wave 1 PR-9). Spec: [LLD §PR-9](../../../docs/design/wave-refactor/2026-10-30-wave1-platform-lld.md#pr-9--appvue--five-shell-services).

## Services

| File | Owns |
|---|---|
| `window.service.ts` | Window title, webview zoom, wheel zoom, blur autosave, aux-window registry, close-requested / window-destroyed listeners |
| `file-open.service.ts` | Android init, opened-file event, deep links, pending opens, `?path=`, drag-drop, open-external |
| `shortcuts.service.ts` | Esc priority, zoom keys, native-menu sync, quick-capture hotkey, menu-action dispatch table |
| `session.service.ts` | Tabs + tiles persistence, tiles init / sync |
| `updates.service.ts` | Startup update check + toast |
| `editor-registry.service.ts` | Editor feature factory list (`EDITOR_FEATURE_FACTORIES`) + `createEditorRegistry()` (Wave 2). `App.vue` provides it as `EDITOR_REGISTRY_FACTORY`; `features/editor/ui/Editor.vue` injects it (a feature never imports `shell/`) |
| `settings-registry.service.ts` | Settings registry: re-exports the ordered `SETTINGS_SLICES` (list lives in `features/settings/internal/settings-slices.ts`, read by the store through the feature contract) and `settingsSliceKeys()`. Its test is the single key-ownership check (slice partition, page order, every editor feature's `settingsKeys` and `i18nKeys`) |
| `settings-pages.ts` | `SETTINGS_PAGES`: ordered page components (no role suffix: it imports `.vue` pages). `App.vue` provides it as `SETTINGS_PAGES_KEY`; `SettingsPanel.vue` injects it |

## Host composables and components (Wave 1b)

Spec: [Wave 1b LLD](../../../docs/design/wave-refactor/2026-10-30-wave1b-app-host-lld.md). Vue state that `App.vue` used to hold lives in `composables/`; its template lives in `components/shell/`.

| File | Owns |
|---|---|
| `composables/useRightSidebar.ts` | Pane visibility, master visibility, narrow drawer, search pane, `ctxToggle`, width + resize |
| `composables/useRsPaneReorder.ts` | Pointer-driven pane reorder (#131) |
| `composables/useAppDialogs.ts` | Modal open flags, Settings deep-link, unsaved / file-changed dialogs, `aiHasKey` |
| `composables/useCenterView.ts` | Bases / inbox / type-lens / saved-view content swap |
| `composables/useEditorCursor.ts` | Cursor, selection, outline line |
| `composables/useAppTypography.ts` | Font CSS vars, markdown-it flags |
| `composables/useWorkspaceSync.ts` | Folder-scoped back ends: index, properties, capture, RAG, spellcheck, git pane |
| `composables/useWikiOpen.ts` | `solomd:wiki-open` |
| `lib/right-sidebar.ts` | Pure pane order + pane flex style |
| `components/shell/AppLayout.vue` | Editing-mode chrome |
| `components/shell/RightSidebar.vue` | One sidebar strip (`side` prop) |
| `components/shell/SidebarContextMenu.vue` | Right-click pane toggles |
| `components/shell/AppDialogs.vue` | Every modal; mounted in reading mode too |

- Registries: `App.vue` provides `EDITOR_REGISTRY_FACTORY` and `SETTINGS_PAGES_KEY` before it creates the host composables. Providing is keyed, so it does not change watcher order. Consumers throw a clear error when the key is missing.
- Shared state: `App.vue` calls `createX()` once (it `provide`s); components call `useX()` (`inject`, throws when missing).
- Window listeners register at setup from composables `App.vue` calls, never from a component that mounts only outside reading mode.

## Deps contract

- Shape: `createXService(deps: XDeps): XService`. `App.vue` builds each service once in `<script setup>`.
- Ports arrive through `deps` as `import type` from `platform/<d>/<d>.port.ts`. Never import `platform/index.ts` here.
- No `vue`, `pinia`, store or `@tauri-apps/*` imports. Store state reaches a service as getter/setter functions or a narrow actions object.
- Pure helpers from `lib/` (e.g. `lib/platform.ts`) are allowed.

## Rules

- **No Vue reactivity in services.** Watchers that drive a service live in `App.vue`; their body is one service call. Read reactive values in the effect (before any `await`) and pass them in. Watchers with no service behind them live in the host composables above.
- **onMounted order is load-bearing.** Services expose step methods (`fileOpen.listenOpenedFile`, `windowService.cleanAuxRegistry`, …). `App.vue` calls them in the original order, interleaved with its own work. Do not collapse them into one `start()` call there.
- `stop()` removes only what `App.vue`'s `onBeforeUnmount` removed before. Listeners never removed stay that way.
- DOM listeners for keydown / wheel / blur / help / search / CJK stay registered in `App.vue`, bound to service handlers (stable references).

## Tests

```bash
node --test app/src/shell/*.test.ts
```

Fakes live in `fake-ports.ts`. Add fields in your own section only.
