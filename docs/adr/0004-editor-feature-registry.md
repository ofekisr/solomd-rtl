# 0004. Editor features: an ordered registry of slots, commands and lifecycle hooks

**Status**: accepted · **Date**: 2026-10-30

## Context

- `components/Editor.vue` is 5024 lines. About 2600 lines of script, 240 of template and 470 of style are the Windows plain-textarea engine. The CodeMirror (CM) path builds 30 extension positions in one `buildExtensions()`, keeps 18 `Compartment`s and 20 watchers that each call `reconfigure`.
- CM extension order is behavior: keymaps, DOM handlers and decorations take precedence by position. Splitting features must not reorder them.
- HLD v3.2 Wave 2: an `EditorFeature` contract (CM extensions + commands + settings slice + i18n keys); `Editor.vue` becomes a host under 400 lines that composes registered features; `shell/` owns registration order.
- Full design: [Wave 2 LLD](../superpowers/specs/2026-10-30-wave2-editor-lld.md).

## Decision

1. **Contract.** A feature is a plain TS object (`EditorFeature` in `features/editor/contracts/editor-feature.port.ts`): `id`, declared `settingsKeys` and `i18nKeys`, static `extensions` keyed by slot, reconfigurable `slots` (`deps` → `build`, optional `when`, `after`), `commands`, and `setup` / `onMount` / `onTabSwitch` / `onUnmount` hooks. Features import no `vue`; they read state through an `EditorFeatureContext` of getters.
2. **Ordered slots.** `EXTENSION_SLOTS` is one constant listing today's 30 extension positions in today's order. A feature places each extension in a named slot. The registry emits extensions sorted by slot rank, then by registration order. A golden-order test pins the list.
3. **One reconfigure path.** The Vue composable `useEditorFeatures` owns every `Compartment`. One watcher reads all slot `deps`, shallow-compares them, and reconfigures every changed slot in a single transaction, then runs each changed slot's `after`.
4. **Registration order lives in `shell/`.** `shell/editor-registry.service.ts` lists features in order and builds the registry once.
5. **Two engines, one host.** The CM engine composes features. The plain-textarea engine stays a single engine (`features/editor/ui/PlainEditor.vue` + `internal/plain/`), not pluggable. Both implement one `EditorApi`, which `Editor.vue` forwards through `defineExpose`.

## Consequences

- Easier: a feature is one folder with tests that run in Node on `EditorState`; adding a toggle is one slot, not a compartment + watcher + `buildExtensions` edit.
- Harder: an extension's position is now a slot name. A new position needs a new entry in `EXTENSION_SLOTS` and a golden-test update.
- Must: keep `EXTENSION_SLOTS` in today's order unless a later ADR says otherwise. Plain-engine features stay inside `features/editor/` until a later ADR makes them pluggable. Wave 3 turns `settingsKeys` into a settings-slice schema.
