# Wave 2 PR-4 — `find`, `spellcheck`, `vim`, `focus-mode` features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four `EditorFeature`s built from the CodeMirror branch of `components/Editor.vue`, pinned by characterization tests, registered in `shell/editor-registry.service.ts`, with no caller yet.

**Architecture:** Each feature = `app/src/features/<f>/contracts/<f>.feature.ts` (exports `create<F>Feature(): EditorFeature`) + `contracts/index.ts` + `internal/` + `CLAUDE.md`. Code is copied verbatim from `Editor.vue`; `Editor.vue` keeps its copy until PR-8.

**Tech Stack:** TypeScript, CodeMirror 6, `@replit/codemirror-vim`, `node --test`.

**Spec:** `docs/design/wave-refactor/2026-10-30-wave2-editor-lld.md` §PR-4…PR-7; ADR 0004. Contract: `app/src/features/editor/contracts/editor-feature.port.ts` (PR-1).

## Global Constraints

- No behavior change. Copy code from `Editor.vue`; only replace `props.x` / `settings.x` / `t` / `view` with `ctx.props().x` / `ctx.settings.x` / `ctx.t` / `ctx.view()`.
- Never edit `app/src/components/Editor.vue`, `lib/cm-live-blocks.ts`, `lib/live-blocks/`, `features/editor/**`. Own only the folders below. Do NOT edit `shell/editor-registry.service.ts` — four PRs run in parallel; the controller registers every feature in one commit after the layer.
- Features import no `vue`/`pinia` at runtime (type-only OK). Import from other features only via their `contracts/index.ts`. Keep importing today's `lib/` modules from `lib/` (PR-8 moves files).
- Every `*.feature.ts`/internal `.ts` ≤ 400 lines; local imports end in `.ts`; no `any`.
- Manifest test per feature: `settingsKeys` ⊆ `Object.keys(defaults())` from `app/src/stores/settings.ts`; every `i18nKeys` entry resolves in `app/src/i18n/en.ts` (walk the dotted path; a key ending in `.*` must resolve to an object). If importing the settings store module fails in Node, read the keys with a regex over `defaults()` source instead — report which you used.
- Test helpers: `stateWith`, `fakeView`, `fakeContext` from `app/src/features/editor/internal/cm-probe.ts` — import them through a relative path in tests only (test files are not scanned by the boundary rule).
- Workers never commit. `pnpm --dir app guard` green at the end (other workers' in-progress files may break guard — report, don't touch).

---

### Task 1: `find`

**Files:** Create `app/src/features/find/{contracts/find.feature.ts, contracts/index.ts, internal/incremental-find.ts, internal/incremental-find.test.ts, contracts/find.feature.test.ts, CLAUDE.md}`.

- [ ] **Step 1:** `internal/incremental-find.ts` — move verbatim `firstMatch` and `incrementalFindScroll` (Editor.vue 95-125, comment included). Export both.
- [ ] **Step 2:** Feature:

```ts
export function createFindFeature(): EditorFeature {
  return {
    id: 'find', settingsKeys: [], i18nKeys: [],
    extensions: {
      search: (ctx) => [search({ top: true, createPanel: createFindPanel(() => ctx.tab().filePath) }), incrementalFindScroll],
    },
    commands: {
      openFind: (ctx) => { const view = ctx.view(); if (view) { view.focus(); openSearchPanel(view); } },
    },
  };
}
```

- [ ] **Step 3: Tests.** `firstMatch`: query `b` in `a b a b` from offset 3 → second `b`; from past the last match wraps to the first; no match → `null` (build `SearchQuery` + `stateWith(search())`, a `{ state }` object stands in for the view). Feature: `extensions.search(ctx)` builds an `EditorState` without throwing and the state has the `search` config (`getSearchQuery(state)` works); `openFind` with `view: () => null` does nothing.
- [ ] **Step 4:** `contracts/index.ts`: `export { createFindFeature } from './find.feature.ts';`. `CLAUDE.md` (≤ 25 lines): what, slot, command, files, tests; plain engine has its own find bar (`features/editor/internal/plain/usePlainFind.ts`).

### Task 2: `spellcheck`

**Files:** `app/src/features/spellcheck/{contracts/spellcheck.feature.ts, contracts/index.ts, contracts/spellcheck.feature.test.ts, CLAUDE.md}`.

```ts
export function createSpellcheckFeature(): EditorFeature {
  return {
    id: 'spellcheck', settingsKeys: ['spellcheckEnabled'], i18nKeys: [],
    slots: [{
      slot: 'spellcheck-attr',
      deps: (ctx) => ctx.props().spellCheck,
      build: (ctx) => EditorView.contentAttributes.of({ spellcheck: ctx.props().spellCheck ? 'true' : 'false' }),
    }],
    extensions: {
      'md-spellcheck': (ctx) => ctx.tab().language === 'markdown'
        ? [spellcheckExtension({ enabled: () => ctx.settings.spellcheckEnabled }), spellcheckTheme]
        : [],
    },
  };
}
```

From Editor.vue 2912-2914, 3077, 3108-3109, 3779-3786. Tests: `stateWith(slot.build(ctx))` → `state.facet(EditorView.contentAttributes)` contains `{ spellcheck: 'true' }` / `'false'` for `props.spellCheck` true/false; `md-spellcheck` returns `[]` for language `ts`, non-empty for `markdown`; `deps` reads `props().spellCheck`.

### Task 3: `vim`

**Files:** `app/src/features/vim/{contracts/vim.feature.ts, contracts/index.ts, internal/vim-ex.ts, internal/vim-ex.test.ts, contracts/vim.feature.test.ts, CLAUDE.md}`.

- [ ] **Step 1:** `internal/vim-ex.ts` — Editor.vue 226-259 as a function with injected collaborators so it is testable:

```ts
export interface VimExHost {
  defineEx(name: string, prefix: string, fn: () => void): void;
  target: Pick<Window, 'dispatchEvent' | 'addEventListener' | 'removeEventListener' | 'setTimeout'>;
  clearTimeout(id: number): void;
  flags: { __solomdVimEx?: boolean };
}
export const VIM_SAVE_TIMEOUT_MS = 10000;
export function registerVimEx(host: VimExHost): void;   // body = today's block, `window` → host.target, globalThis flag → host.flags
export function registerVimExOnce(): void;              // registerVimEx({ defineEx: Vim.defineEx.bind(Vim), target: window, clearTimeout: (id) => clearTimeout(id), flags: globalThis as … })
```

Keep the comments of 226-259. `CustomEvent` usage unchanged.

- [ ] **Step 2:** Feature:

```ts
export function createVimFeature(): EditorFeature {
  return {
    id: 'vim', settingsKeys: ['vimMode'], i18nKeys: [],
    slots: [{ slot: 'vim', deps: (ctx) => ctx.settings.vimMode, build: (ctx) => (ctx.settings.vimMode ? vim() : []) }],
    setup: () => { registerVimExOnce(); },
  };
}
```

- [ ] **Step 3: Tests** (fake host with an `EventTarget`-like recorder): `:w` → one `solomd:menu-action` with `detail: 'file.save'`; `:q` → `file.closeTab`; `:wq` → `file.save`, and after a `solomd:saved` event → `file.closeTab`; `:wq` with no `solomd:saved` → listener removed after `VIM_SAVE_TIMEOUT_MS` (fake `setTimeout` captures the callback); calling `registerVimEx` twice with the same `flags` defines each Ex once (`write`, `wq`, `xit`, `quit` → 4 calls total). Slot: `build` with `vimMode: false` → `[]`.

### Task 4: `focus-mode`

**Files:** `app/src/features/focus-mode/{contracts/focus-mode.feature.ts, contracts/index.ts, contracts/focus-mode.feature.test.ts, CLAUDE.md}`.

```ts
export function createFocusModeFeature(): EditorFeature {
  return {
    id: 'focus-mode', settingsKeys: [], i18nKeys: [],
    slots: [
      { slot: 'focus', deps: (ctx) => ctx.props().focusMode, build: (ctx) => (ctx.props().focusMode ? focusModeExtension() : []) },
      { slot: 'typewriter', deps: (ctx) => ctx.props().typewriterMode, build: (ctx) => (ctx.props().typewriterMode ? typewriterModeExtension() : []) },
    ],
  };
}
```

From Editor.vue 3079-3080, 3788-3806. Tests: off → `[]`; on → `EditorState` builds; `deps` read the props.

### Task 5: Register (controller, after PR-4…PR-7 all land)

- [ ] Append to `EDITOR_FEATURE_FACTORIES` in `app/src/shell/editor-registry.service.ts` (keep the list order given in the LLD §PR-4…PR-7: `core, appearance, live-render, find, vim, spellcheck, ai-rewrite, focus-mode, image-upload, completion, session, folds, format`; insert yours at their positions relative to factories already present): `createFindFeature, createVimFeature, createSpellcheckFeature, createFocusModeFeature` (import from each `contracts/index.ts`).
- [ ] A `shell/editor-registry.service.test.ts` case (create the file if absent): `createEditorRegistry()` builds; ids are unique; `registry.extensions(fakeContext({ settings: { vimMode: false, spellcheckEnabled: true } }), compartments)` builds an `EditorState` for a markdown tab.
- [ ] `pnpm --dir app guard` → exit 0.
