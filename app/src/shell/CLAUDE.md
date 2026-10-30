# shell/

App-wide services extracted from `App.vue` (Wave 1 PR-9). Spec: [LLD §PR-9](../../../docs/superpowers/specs/2026-10-30-wave1-platform-lld.md#pr-9--appvue--five-shell-services).

## Services

| File | Owns |
|---|---|
| `window.service.ts` | Window title, webview zoom, wheel zoom, blur autosave, aux-window registry, close-requested / window-destroyed listeners |
| `file-open.service.ts` | Android init, opened-file event, deep links, pending opens, `?path=`, drag-drop, open-external |
| `shortcuts.service.ts` | Esc priority, zoom keys, native-menu sync, quick-capture hotkey, menu-action dispatch table |
| `session.service.ts` | Tabs + tiles persistence, tiles init / sync |
| `updates.service.ts` | Startup update check + toast |

## Deps contract

- Shape: `createXService(deps: XDeps): XService`. `App.vue` builds each service once in `<script setup>`.
- Ports arrive through `deps` as `import type` from `platform/<d>/<d>.port.ts`. Never import `platform/index.ts` here.
- No `vue`, `pinia`, store or `@tauri-apps/*` imports. Store state reaches a service as getter/setter functions or a narrow actions object.
- Pure helpers from `lib/` (e.g. `lib/platform.ts`) are allowed.

## Rules

- **Vue reactivity stays in `App.vue`.** Every `watch` / `watchEffect` lives there; its body is one service call. Read reactive values in the effect (before any `await`) and pass them in.
- **onMounted order is load-bearing.** Services expose step methods (`fileOpen.listenOpenedFile`, `windowService.cleanAuxRegistry`, …). `App.vue` calls them in the original order, interleaved with its own work. Do not collapse them into one `start()` call there.
- `stop()` removes only what `App.vue`'s `onBeforeUnmount` removed before. Listeners never removed stay that way.
- DOM listeners for keydown / wheel / blur / help / search / CJK stay registered in `App.vue`, bound to service handlers (stable references).

## Tests

```bash
node --test app/src/shell/*.test.ts
```

Fakes live in `fake-ports.ts`. Add fields in your own section only.
