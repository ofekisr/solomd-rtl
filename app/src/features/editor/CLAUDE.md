# features/editor/

Editor features (Wave 2). ADR: [0004](../../../../docs/adr/0004-editor-feature-registry.md). Spec: `docs/superpowers/specs/2026-10-30-wave2-editor-lld.md`.

## Layout

| Path | Holds |
|---|---|
| `contracts/` | Public surface: `EditorFeature`, `EXTENSION_SLOTS`, `EditorFeatureContext`, `EditorApi`. Other code imports only `contracts/index.ts` |
| `internal/editor-feature-registry.service.ts` | Validates features, orders extensions by slot rank, resolves commands |
| `internal/useEditorFeatures.ts` | Host composable: compartments, one reconfigure watcher, lifecycle hooks |
| `internal/cm-probe.ts` | Test helpers: `stateWith`, `fakeView`, `fakeContext` |

Features are registered in `src/shell/editor-registry.service.ts` (`EDITOR_FEATURE_FACTORIES`).

## Rules

- Features and `.service.ts` files import no `vue` / `pinia` (type-only imports are fine). Only `useEditorFeatures.ts` and its test import `vue`.
- Local imports carry the `.ts` extension (Node type-stripping tests).
- Each `.ts` file is at most 400 lines. No `any`.
- A feature talks to another feature only through `ctx.run(command, ...args)`.

## Add a feature

1. Write the feature object (`id` kebab-case, `settingsKeys`, `i18nKeys`) in its own folder.
2. Pick slots from `EXTENSION_SLOTS`. Static pieces go in `extensions`; setting-driven pieces go in `slots` (`deps` + `build`, optional `when` / `after`). One reconfigurable slot per slot name per feature.
3. Add a factory to `EDITOR_FEATURE_FACTORIES`. Order there is lifecycle-hook order.
4. Write characterization tests with `cm-probe` (`stateWith`, `fakeView`, `fakeContext`).
5. Command names are global; a duplicate throws at registry creation.
- `when()` must be stable for the life of a view: a slot excluded at build time has no compartment, so reconfiguring it later is a silent no-op. Use an always-present slot with a conditional `build` instead.

- The host component lives in `ui/Editor.vue`; outside code imports it through `contracts/editor-component.ts` (never via `contracts/index.ts`, which Node tests import).

## Plain engine

Windows uses a plain `<textarea>` editor instead of CodeMirror: WebView2's contentEditable IME path drops the first character and doubles CJK punctuation (see the comment above `usePlainWindowsEditor` in `ui/Editor.vue`). `Editor.vue` renders `<PlainEditor>` in its `v-else` branch and forwards each `EditorApi` method to it.

| Path | Holds |
|---|---|
| `ui/PlainEditor.vue` | Plain host template, context menu, `defineExpose(EditorApi)` |
| `ui/PlainFindBar.vue`, `ui/PlainAutocomplete.vue` | Find/replace bar and autocomplete popup; take the `PlainApi` as `engine` prop |
| `ui/plain-*.css` | Scoped styles, loaded with `<style scoped src>` |
| `internal/plain/usePlainEngine.ts` | Builds the shared `PlainApi`: composables created in fixed order, cycles broken by `late` / `lateRef` (`plain-late.ts`) |
| `internal/plain/usePlainCommands.ts`, `usePlainLifecycle.ts`, `usePlainTextTransforms.ts` | Exposed methods; mount/unmount + tab/content/view-mode watchers; case and format handlers |
| `internal/plain/plain-*.ts` | Pure helpers with characterization tests (no `vue`) |

- Exactly one component handles `solomd:transform-case` / `solomd:format-markdown` per pane: `PlainEditor` on the plain engine, `Editor.vue` otherwise.
- Dev hook: open the web build with `?forcePlain=1` to exercise the plain engine on macOS/Linux (`pnpm --dir app dev`, `:1420` / `:1430`).
