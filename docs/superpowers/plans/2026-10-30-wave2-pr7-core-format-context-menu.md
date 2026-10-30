# Wave 2 PR-7 — editor core features, `format`, `context-menu` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The editor's base CodeMirror features (`core`, `appearance`, `live-render`), the `format` feature (case, markdown format, table/formula editors, insert snippet) and the CM context menu, pinned by characterization tests, no caller yet.

**Architecture:** Core features live in `app/src/features/editor/internal/core/*.feature.ts` (they are part of the host feature). `format` and `context-menu` are their own feature folders. Shared engine-neutral logic (`tableRangeAt`, `formatMath`, open-table/formula over `DocAccess`) lives in `format` so PR-8 can point the plain engine at it.

**Tech Stack:** TypeScript, CodeMirror 6, Vue 3 (only `useCmContextMenu.ts`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-30-wave2-editor-lld.md` §PR-4…PR-7; ADR 0004. Contract: `app/src/features/editor/contracts/editor-feature.port.ts` (incl. `ctx.reconfigure(slotKey, ext)` added after PR-1 review).

## Global Constraints

- No behavior change. Copy code from `Editor.vue`; only replace `props`/`settings`/`themeStore`/`tabs`/`t`/`toasts`/`view` access with `ctx`.
- Never edit `components/Editor.vue`, `lib/cm-live-blocks.ts`, `lib/live-blocks/`, `features/editor/{contracts,internal/*.ts top level,ui,internal/plain}`, `shell/editor-registry.service.ts`. Own only: `features/editor/internal/core/`, `features/format/`, `features/context-menu/`.
- `.feature.ts` and pure internal files import no `vue`/`pinia`. Vue only in `features/context-menu/internal/useCmContextMenu.ts`.
- Import other features only via `contracts/index.ts`. Keep importing today's `lib/` modules from `lib/`.
- Each `.ts` ≤ 400 lines; local imports end in `.ts`; no `any`.
- Manifest test per feature: `settingsKeys` ⊆ keys of `defaults()` (`app/src/stores/settings.ts`); `i18nKeys` resolve in `app/src/i18n/en.ts`.
- Test helpers: `stateWith`, `fakeView`, `fakeContext` from `app/src/features/editor/internal/cm-probe.ts`.
- Slot keys are `${featureId}:${slot}` (e.g. `appearance:language`); `ctx.reconfigure('appearance:language', ext)` reconfigures that compartment on the live view.
- Workers never commit. `pnpm --dir app guard` green at the end (other workers' in-progress files may break guard — report, don't touch).

---

### Task 1: `core`, `appearance`, `live-render`

**Files:** `app/src/features/editor/internal/core/{core.feature.ts, appearance.feature.ts, live-render.feature.ts, font-theme.ts, *.test.ts}`.

`core.feature.ts` (Editor.vue 3031-3065, 3113, 3118, 2981-2990 and the slot watchers 3862, 3877, 3888, 3855):

```ts
export function createCoreFeature(): EditorFeature {
  return {
    id: 'core',
    settingsKeys: ['solidCursor', 'highlightCurrentLine', 'showLineNumbers', 'wordWrap'],
    i18nKeys: [],
    extensions: {
      'ime-guard': () => imeCompositionGuard(),
      history: () => history(),
      'drag-aware': () => dragAwareExtension(),
      'selection-tools': () => [rectangularSelection(), crosshairCursor(), indentOnInput(), bracketMatching(), highlightActiveLine()],
      keymap: () => keymap.of([...defaultKeymap.filter((b) => b.key !== 'Mod-i'), ...historyKeymap, ...searchKeymap, indentWithTab]),
      'task-list': () => taskListExtension(),
      'stable-click': () => stableClickSelection(),
    },
    slots: [
      { slot: 'cursor', deps: (ctx) => ctx.settings.solidCursor, build: (ctx) => drawSelection({ cursorBlinkRate: ctx.settings.solidCursor ? 0 : 1200 }) },
      { slot: 'active-line', deps: (ctx) => ctx.settings.highlightCurrentLine, build: (ctx) => activeLineExtension(ctx.settings.highlightCurrentLine) },
      { slot: 'line-numbers', deps: (ctx) => ctx.settings.showLineNumbers, build: (ctx) => (ctx.settings.showLineNumbers ? lineNumbers() : []) },
      { slot: 'wrap', deps: (ctx) => ctx.settings.wordWrap, build: (ctx) => (ctx.settings.wordWrap ? EditorView.lineWrapping : []) },
    ],
  };
}
```

Name the blink rates `SOLID_CURSOR_BLINK_MS = 0`, `DEFAULT_CURSOR_BLINK_MS = 1200`. Keep the #193, #90, #296, #344, #167 comments.

`appearance.feature.ts` (bidi 3033-3035 + 3928-3930, language 3066-3070 + 202-207 + 3922-3936, theme 3074 + 3838-3846, font 3076 + 3915-3920; `fontSizeTheme` 2992-3024 → `font-theme.ts`):

```ts
const BIDI_AUTO_LANGUAGES = ['markdown', 'plaintext'];
export const LANGUAGE_SLOT_KEY = 'appearance:language';
function applyLazyLanguage(ctx: EditorFeatureContext, language: string): void {
  void loadLanguageExtension(language)?.then((support) => {
    if (ctx.tab().language !== language) return;
    ctx.reconfigure(LANGUAGE_SLOT_KEY, support);
  });
}
export function createAppearanceFeature(): EditorFeature {
  return {
    id: 'appearance', settingsKeys: ['fontSize', 'fontFamily'], i18nKeys: [],
    slots: [
      { slot: 'direction', deps: (ctx) => ctx.tab().language, build: (ctx) => bidiExtension(BIDI_AUTO_LANGUAGES.includes(ctx.tab().language) ? undefined : 'ltr') },
      { slot: 'language', deps: (ctx) => ctx.tab().language, build: (ctx) => createLanguageExtension(ctx.tab().language), after: (ctx) => applyLazyLanguage(ctx, ctx.tab().language) },
      { slot: 'theme', deps: (ctx) => ctx.themeMode(), build: (ctx) => cmThemeFor(ctx.themeMode()), after: () => { window.dispatchEvent(new CustomEvent('solomd:cm-relayout')); } },
      { slot: 'font', deps: (ctx) => [ctx.settings.fontSize, ctx.settings.fontFamily], build: (ctx) => fontSizeTheme(ctx.settings.fontSize, ctx.settings.fontFamily) },
    ],
    onMount: (ctx) => applyLazyLanguage(ctx, ctx.tab().language),
    onTabSwitch: (ctx) => applyLazyLanguage(ctx, ctx.tab().language),
  };
}
```

`live-render.feature.ts` (`richExtensionsFor` 2931-2979, `setLiveEditCopyLabel` 2926-2929, rich watchers 3870-3875, 3938-3955 CM part, PlantUML relayout 3903-3913):

```ts
export function createLiveRenderFeature(): EditorFeature {
  return {
    id: 'live-render',
    settingsKeys: ['viewMode', 'livePreview', 'alwaysShowMarkers', 'plantumlEnabled', 'plantumlServer', 'language'],
    i18nKeys: ['toolbar.copy', 'whiteboard.loading', 'whiteboard.openFull', 'whiteboard.loadFailed', 'mindmap.fenceOpenFull', 'mindmap.fenceParseError', 'mindmap.gateBroken'],
    slots: [{
      slot: 'rich',
      deps: (ctx) => [ctx.tab().language, ctx.settings.alwaysShowMarkers, ctx.settings.livePreview, ctx.settings.viewMode],
      build: (ctx) => richExtensionsFor(ctx),
    }],
    watches: [{
      deps: (ctx) => [ctx.settings.plantumlEnabled, ctx.settings.plantumlServer],
      run: () => { try { window.dispatchEvent(new CustomEvent('solomd:cm-relayout')); } catch {} },
    }],
    setup: (ctx) => { setLiveEditCopyLabel(() => ctx.t('toolbar.copy')); },
  };
}
```

`richExtensionsFor(ctx)`: today's body with `tab` → `ctx.tab()` read at call time for the language/viewMode branch, getters inside `liveBlocksExtension({...})` call `ctx.tab()` lazily (today they close over the `tab` object passed in — `getImageRoot: () => extractImageRoot(tab.content || '')` reads the *current* content of the same tab object; `ctx.tab()` returns the current tab, which is the same object between rebuilds since every tab switch rebuilds the state). `onBoardEdit` uses `ctx.findTab(tabId)` + `ctx.setContent`.

Note: the `watches` deps getter returns a fresh array every run, so Vue fires `run` on every change of either value — same as today's two-source `watch([…], …)`.

- [ ] **Tests:** `core`: each static extension builds an `EditorState`; `cursor` slot build for `solidCursor` true/false builds; `line-numbers` off → `[]`; `wrap` on → contains `EditorView.lineWrapping`; keymap has no `Mod-i` binding (`state.facet(keymap)` flat, `.some(b => b.key === 'Mod-i')` false) and contains a `Mod-z`/history binding. `appearance`: `direction` → `ltr` attribute for `ts`, auto for markdown (`state.facet(EditorView.contentAttributes)`/`EditorView.perLineTextDirection` — assert what `bidiExtension` actually sets); `theme.after` dispatches `solomd:cm-relayout` on `window` (install `globalThis.window = new EventTarget()` + `CustomEvent` in the test if absent); `font.deps` is a 2-tuple. `live-render`: markdown + `viewMode: 'liveEdit'` builds; non-markdown → `[]`; `livePreview: false` → rich highlight only (builds). Golden: the slot names used by `core` + `appearance` + `live-render` appear in `EXTENSION_SLOTS` in the order today's `buildExtensions()` lists them.

### Task 2: `format`

**Files:** `app/src/features/format/{contracts/format.feature.ts, contracts/index.ts, internal/cm-format.ts, internal/doc-commands.ts, internal/insert-markdown.ts, *.test.ts, CLAUDE.md}`.

**Interfaces — Produces** (PR-8 points the plain engine at `openTableWith` / `openFormulaWith`):

```ts
// internal/doc-commands.ts — engine-neutral, Editor.vue 3403-3491
export function tableRangeAt(source: string, caret: number): { from: number; to: number } | null;   // 3409-3435 with findTableSpan
export function formatMath(source: string, from: number, to: number, latex: string, display: boolean): string;  // 3477-3491
export function openTableWith(doc: DocAccess, notify: { info(m: string): void }, t: (k: string) => string): void;   // toast 'tableEditor.notInTable' on empty / no table
export function openFormulaWith(doc: DocAccess): void;

// internal/cm-format.ts — CM branches
export function transformCaseInView(view: ViewLike, mode: CaseMode | 'cycle'): void;   // 3268-3282
export function formatMarkdownInView(view: ViewLike, kind: FormatKind): void;          // 3333-3344
export function cmDocAccess(view: ViewLike): DocAccess;                               // getDoc, getCaret = selection.main.head, replaceRange = 3511-3512

// internal/insert-markdown.ts — 4226-4248 CM branch
export const CURSOR_MARKER = '$|$';
export function insertMarkdownInView(view: ViewLike, snippet: string): void;

// contracts/format.feature.ts
export function createFormatFeature(): EditorFeature;
//  i18nKeys: ['tableEditor.notInTable']
//  setup(ctx): window listeners 'solomd:transform-case' and 'solomd:format-markdown' (handlers = the shared guards of 3261-3266 / 3327-3331, then the CM function on ctx.view(); return early when no view); returns cleanup removing both
//  commands: openTableAtCursor, openFormulaAtCursor (via cmDocAccess(view); no view → table still toasts like today when source is '' — keep exact branch behavior: today `source = view?.state.doc.toString() ?? ''` then toast), insertMarkdown(ctx, snippet)
```

- [ ] **Tests:** `transformCaseInView` on `hello world` with caret in `world` → cycles to `WORLD` (or whatever `nextCaseInCycle` returns first — characterize), selection covers the word, focus called; empty doc → no dispatch. `formatMarkdownInView(view, 'bold')` on selected `x` → `**x**`, `userEvent` `input.format`, `scrollIntoView: true`. `insertMarkdownInView`: `$|$` marker places the caret; a snippet starting with `\n` mid-line gets one extra leading `\n`; at line start it does not. `tableRangeAt` finds the table around the caret, `null` outside. `formatMath`: inline → `$x$`; display alone on its line → `$$\nx\n$$`; display mid-sentence → `$$x$$`. `openTableWith` with empty doc → toast `tableEditor.notInTable`.

### Task 3: `context-menu`

**Files:** `app/src/features/context-menu/{contracts/index.ts, internal/clipboard.ts, internal/useCmContextMenu.ts, internal/cm-menu-actions.ts, *.test.ts, CLAUDE.md}`.

```ts
// internal/clipboard.ts — Editor.vue 2698-2715 verbatim (clipboardPort, navigator fallback)
export async function writeClipboard(text: string): Promise<void>;
export async function readClipboard(): Promise<string>;

// internal/cm-menu-actions.ts — CM branch of 2726-2751
export async function runCmMenuAction(view: ViewLike, id: Exclude<EditorMenuAction, 'translate'>, clipboard: { read(): Promise<string>; write(t: string): Promise<void> }): Promise<void>;
export function cmSelectionText(view: ViewLike | null): string;    // 2718-2721

// internal/useCmContextMenu.ts — Vue; CM branch of 2651-2696 + 2726-2733 translate
export function useCmContextMenu(getView: () => EditorView | null): {
  editorCtx: Ref<{ x: number; y: number; hasSelection: boolean } | null>;
  onContextMenu(event: MouseEvent): void;      // touch/pen/Android/iOS → return; non-Windows runtime + empty selection → return (system menu)
  onMenuAction(id: EditorMenuAction): Promise<void>;
};
// contracts/index.ts exports useCmContextMenu, readClipboard, writeClipboard
```

`EditorMenuAction` type comes from `components/EditorContextMenu.vue` today (`import type`); PR-8 moves the component.

- [ ] **Tests:** `runCmMenuAction` with a fake clipboard: `copy` writes the selection; `cut` writes and deletes with `userEvent: 'delete.cut'`; `paste` inserts with `input.paste`; `selectAll` selects the whole doc; empty selection + `copy` → no write; focus called once per action. `cmSelectionText` empty for no view / empty selection.

### Task 4: Register (controller, after PR-4…PR-7 all land)

- [ ] Controller adds `createCoreFeature`, `createAppearanceFeature`, `createLiveRenderFeature` (first three) and `createFormatFeature` (last) to `EDITOR_FEATURE_FACTORIES`.
