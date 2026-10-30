# features/editor/

Editor features (Wave 2). ADR: [0004](../../../../docs/adr/0004-editor-feature-registry.md). Spec: `docs/superpowers/specs/2026-10-30-wave2-editor-lld.md`.

## Layout

| Path | Holds |
|---|---|
| `contracts/` | Public surface: `EditorFeature`, `EXTENSION_SLOTS`, `EditorFeatureContext`, `EditorApi`, registry factory, core feature factories. Other code imports only `contracts/index.ts` |
| `contracts/editor-component.ts` | Exports `Editor.vue` (Vue; separate entry) |
| `internal/editor-feature-registry.service.ts` | Validates features, orders extensions by slot rank, resolves commands |
| `contracts/testkit.ts` | Test helpers: `stateWith`, `fakeView`, `fakeContext`. Tests import it directly; `contracts/index.ts` does not export it (keeps it out of the prod bundle) |
| `contracts/editor-registry.port.ts` | `EDITOR_REGISTRY_FACTORY` (`InjectionKey<() => EditorFeatureRegistry>`) |
| `ui/Editor.vue` | Host (< 200 lines): builds the context, composes the registry and host composables, forwards `EditorApi`, renders CM or `PlainEditor` |

Registered in `src/shell/editor-registry.service.ts` (`EDITOR_FEATURE_FACTORIES`). `App.vue` provides `createEditorRegistry` under `EDITOR_REGISTRY_FACTORY`; `Editor.vue` injects it and throws if missing. Code that builds an editor outside `App` (tests) takes the factory from `shell/` directly.

`EditorFeature.settingsKeys` is `readonly SettingsKey[]` and `i18nKeys` is `readonly I18nKey[]` (`i18n/keys.ts`; `foo.*` names a group). `tsc` catches typos; `shell/settings-registry.service.test.ts` checks every registered feature's keys exist. Do not add per-feature key assertions.

### Host composables and CM helpers

| File | Role |
|---|---|
| `internal/useEditorFeatures.ts` | Compartments, one reconfigure watcher, lifecycle hooks |
| `internal/useCmView.ts` | View create/destroy, content sync + flush, relayout, dev expose |
| `internal/useCmTabSwitch.ts` | Tab switch with caret memory (#144/#169) |
| `internal/cm-api.ts` | `gotoLine`, `getViewLine`, `lineTopY`, `scrollToLine`, `getLineSelection` |
| `internal/editor-context.ts` | Builds the getter-only `EditorFeatureContext` |

### Core features (`internal/core/`)

| Feature | Slots |
|---|---|
| `core.feature.ts` | `ime-guard`, `history`, `drag-aware`, `selection-tools`, `keymap`, `task-list`, `stable-click`, `cursor`, `active-line`, `line-numbers`, `wrap` |
| `appearance.feature.ts` | `direction`, `language`, `theme`, `font` (`font-theme.ts` helper) |
| `live-render.feature.ts` | `rich` (live preview + blocks) |

### Slots

`EXTENSION_SLOTS` fixes extension order (CM precedence is positional). Owner per slot:

| Slot | Owner |
|---|---|
| `ime-guard`, `history`, `drag-aware`, `selection-tools`, `keymap`, `cursor`, `active-line`, `line-numbers`, `wrap`, `task-list`, `stable-click` | core |
| `direction`, `language`, `theme`, `font` | appearance |
| `rich` | live-render |
| `search` | find |
| `vim` | vim |
| `spellcheck-attr`, `md-spellcheck` | spellcheck |
| `ai-lock`, `ai-key` | ai-rewrite |
| `focus`, `typewriter` | focus-mode |
| `image-paste` | image-upload |
| `md-completion`, `slash` | completion |
| `fold` | folds |
| `session` | session |
| `update-listener` | host (`useCmView.ts` appends it after the registry's extensions) |

## Rules

- Features and `.service.ts` files import no `vue` / `pinia` (type-only imports are fine). Only the `use*.ts` composables, `ui/*.vue` and their tests import `vue`. Remaining exception (`featurePurity` baseline): `find/internal/cm-find-panel.ts` (mounts `FindBar.vue`). The format editor buses are `use{Table,Formula}EditorBus.ts` composables, so they are not exceptions.
- Local imports carry the `.ts` extension (Node type-stripping tests).
- Each `.ts` file is at most 400 lines. No `any`.
- A feature talks to another feature only through `ctx.run(command, ...args)`.

## Add a feature

1. Write the feature object (`id` kebab-case, `settingsKeys`, `i18nKeys`) in its own folder.
2. Pick slots from `EXTENSION_SLOTS`. Static pieces go in `extensions`; setting-driven pieces go in `slots` (`deps` + `build`, optional `when` / `after`). One reconfigurable slot per slot name per feature.
3. Add a factory to `EDITOR_FEATURE_FACTORIES`. Order there is lifecycle-hook order.
4. Write characterization tests with `contracts/testkit.ts` (`stateWith`, `fakeView`, `fakeContext`).
5. Command names are global; a duplicate throws at registry creation.
- `when()` is read only when the state is built: a slot excluded then has no compartment and is skipped on reconfigure until the next `setState` (tab switch). Prefer an always-present slot with a conditional `build`.
- Slot reconfigures skip tab switches: `setState` rebuilds every compartment, so put tab-switch side effects in `onTabSwitch`, not in a slot's `after`.
- `setup` must not call `ctx.run`: `Editor.vue` binds the context after `useEditorFeatures` returns, i.e. after every `setup` has run.

- The host component lives in `ui/Editor.vue`; outside code imports it through `contracts/editor-component.ts` (never via `contracts/index.ts`, which Node tests import).

## Plain engine

Windows uses a plain `<textarea>` editor instead of CodeMirror: WebView2's contentEditable IME path drops the first character and doubles CJK punctuation (see `shouldUsePlainWindowsEditor` in `ui/Editor.vue`). `Editor.vue` renders `<PlainEditor>` in its `v-else` branch and forwards each `EditorApi` method to it.

| Path | Holds |
|---|---|
| `ui/PlainEditor.vue` | Plain host template, context menu, `defineExpose(EditorApi)` |
| `ui/PlainFindBar.vue`, `ui/PlainAutocomplete.vue` | Find/replace bar and autocomplete popup; take the `PlainApi` as `engine` prop |
| `ui/plain-*.css` | Scoped styles, loaded with `<style scoped src>` |
| `internal/plain/usePlainEngine.ts` | Builds the shared `PlainApi`: composables created in fixed order, cycles broken by `late` / `lateRef` (`plain-late.ts`) |
| `internal/plain/usePlainCommands.ts`, `usePlainLifecycle.ts`, `usePlainTextTransforms.ts` | Exposed methods; mount/unmount + tab/content/view-mode watchers; case and format handlers |
| `internal/plain/plain-*.ts` | Pure helpers with characterization tests (no `vue`) |

- `solomd:transform-case` / `solomd:format-markdown`: the `format` feature handles them on CodeMirror (its listeners bail when `ctx.view()` is null); `PlainEditor` handles them on the plain engine.
- Dev hook: open the web build with `?forcePlain=1` to exercise the plain engine on macOS/Linux (`pnpm --dir app dev`, `:1420` / `:1430`).
