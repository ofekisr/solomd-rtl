# Wave 2 PR-5 — `image-upload`, `folds`, `session` features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three `EditorFeature`s built from the CodeMirror branch of `components/Editor.vue`, pinned by characterization tests, no caller yet.

**Architecture:** Each feature = `app/src/features/<f>/contracts/<f>.feature.ts` (exports `create<F>Feature(): EditorFeature`) + `contracts/index.ts` + `internal/` + `CLAUDE.md`. Per-instance state lives in the factory closure (one instance per editor pane). Code copied verbatim; `Editor.vue` keeps its copy until PR-8.

**Tech Stack:** TypeScript, CodeMirror 6, `node --test`.

**Spec:** `docs/design/wave-refactor/2026-10-30-wave2-editor-lld.md` §PR-4…PR-7; ADR 0004. Contract: `app/src/features/editor/contracts/editor-feature.port.ts`.

## Global Constraints

- No behavior change. Copy code from `Editor.vue`; only replace `props.x` / `settings.x` / `t` / `toasts` / `view` / `tabs.setContent` with `ctx.props().x` / `ctx.settings.x` / `ctx.t` / `ctx.toast` / `ctx.view()` / `ctx.setContent`.
- Never edit `components/Editor.vue`, `lib/cm-live-blocks.ts`, `lib/live-blocks/`, `features/editor/**`, `shell/editor-registry.service.ts` (controller registers features after the layer). Own only the folders below.
- Features import no `vue`/`pinia` at runtime. Import other features only via `contracts/index.ts`. Keep importing today's `lib/` modules from `lib/` (PR-8 moves files).
- Each `.ts` ≤ 400 lines; local imports end in `.ts`; no `any`.
- Manifest test per feature: `settingsKeys` ⊆ keys of `defaults()` in `app/src/stores/settings.ts` (exported by PR-1); `i18nKeys` resolve in `app/src/i18n/en.ts`.
- Test helpers: `stateWith`, `fakeView`, `fakeContext` from `app/src/features/editor/internal/cm-probe.ts`. `fakeContext({ view: () => fv as unknown as EditorView })` to hand a fake view to commands.
- Workers never commit. `pnpm --dir app guard` green at the end (other workers' in-progress files may break guard — report, don't touch).

---

### Task 1: `image-upload`

**Files:** `app/src/features/image-upload/{contracts/image-upload.feature.ts, contracts/index.ts, internal/image-paste-options.ts, internal/image-links.ts, internal/upload-local-images.ts, *.test.ts, CLAUDE.md}`.

**Interfaces — Produces** (PR-8 and the plain engine use `imagePasteOptionsFor`):

```ts
// internal/image-paste-options.ts — Editor.vue 161-180 with ctx
export function imagePasteOptionsFor(ctx: EditorFeatureContext): ImagePasteOptions;
// internal/image-links.ts — pure
export function parseFrontMatterImageRoot(source: string): string | undefined;          // 4115-4121 verbatim
export function localImageSources(doc: string): string[];                               // the regex loop of 4048-4060: unique, non-remote, in order
export function imageSrcChanges(doc: string, oldSrc: string, newUrl: string): Array<{ from: number; to: number; insert: string }>;  // 4099-4113 body
// internal/upload-local-images.ts
export async function uploadLocalImages(ctx: EditorFeatureContext): Promise<void>;     // 4041-4086 + resolveLocalImageAbsPath 4088-4097; same toasts, same console.error text
```

Feature:

```ts
export function createImageUploadFeature(): EditorFeature {
  return {
    id: 'image-upload',
    settingsKeys: ['attachmentMode', 'assetsDirName', 'attachmentCustomPath', 'imageUploader'],
    i18nKeys: ['toast.noUploaderConfigured', 'toast.noLocalImages', 'toast.uploadingProgress', 'toast.uploadedCount', 'toast.imageUploadFailedShort'],
    extensions: { 'image-paste': (ctx) => imagePasteExtension(imagePasteOptionsFor(ctx)) },
    commands: {
      insertImageFromPath: async (ctx, srcPath) => { const view = ctx.view(); if (!view) return; await cmInsertImageFromPath(view, String(srcPath), imagePasteOptionsFor(ctx)); },
      insertImageUrl: (ctx, url, alt = '') => { const clean = String(url ?? '').trim(); if (!clean || !ctx.view()) return; ctx.run('insertMarkdown', markdownImage(clean, String(alt))); },
      uploadLocalImages: (ctx) => uploadLocalImages(ctx),
    },
  };
}
```

Add every other settings key `resolveUploader(settings, …)` reads to `settingsKeys` (open `lib/image-upload.ts`, list the fields it reads). `uploadLocalImages`'s dynamic `import('../lib/image-resolve')` becomes a static or dynamic import of `../../../lib/image-resolve.ts` — keep it dynamic.

- [ ] **Tests:** `parseFrontMatterImageRoot` for `imageRoot`, `image_root`, `typora-root-url`, quoted value, no front matter → `undefined`. `localImageSources('![a](x.png) ![b](https://h/y.png) ![c](x.png) ![d](data:…) ![e](sub/z.jpg "t")')` → `['x.png', 'sub/z.jpg']`. `imageSrcChanges` replaces every `](old)` and encodes spaces like `encodeImageDestination`. `uploadLocalImages` with `imageUploader: 'none'` → toast `info:toast.noUploaderConfigured` and nothing dispatched; no view → returns. `insertImageUrl` calls `ctx.run('insertMarkdown', '![alt](https://x/y.png)')` (record runs via a `run` override) and does nothing for a blank URL.

### Task 2: `folds`

**Files:** `app/src/features/folds/{contracts/folds.feature.ts, contracts/index.ts, internal/apply-fold.ts, *.test.ts, CLAUDE.md}`.

```ts
// internal/apply-fold.ts — CM branch of Editor.vue 3522-3568
export function applyFold(ctx: EditorFeatureContext, action: FoldAction, level = 2): void {
  if (!ctx.settings.foldingEnabled) { ctx.toast.info(ctx.t('fold.disabledHint')); return; }
  const view = ctx.view();
  if (!view) return;
  view.focus();
  if (action === 'toggle') toggleHeadingFoldAtCursor(view);
  else if (action === 'all') foldAllHeadings(view);
  else if (action === 'none') unfoldAllFolds(view);
  else foldHeadingsToLevel(view, level);
}
export function foldExtensionFor(ctx: EditorFeatureContext, on: boolean): Extension;   // 2916-2924
```

(The `language !== 'markdown'` guard at 3527-3532 only returns on the plain engine; on CodeMirror it falls through — so the CM function has no language check.)

Feature (per-instance fold key in the closure; Editor.vue 3608-3628 CM lines):

```ts
export function createFoldsFeature(): EditorFeature {
  let foldKey = '';
  const keyFor = (ctx: EditorFeatureContext) => ctx.tab().filePath ?? ctx.tab().id;
  const save = (view: EditorView) => { rememberFolds(foldKey, captureFolds(view.state.doc.toString(), currentFoldRanges(view.state))); };
  const restore = (ctx: EditorFeatureContext, view: EditorView) => {
    foldKey = keyFor(ctx);
    const snapshot = ctx.settings.foldingEnabled ? recallFolds(foldKey) : null;
    if (snapshot) restoreFoldRanges(view, foldRangesFor(view.state.doc.toString(), snapshot));
  };
  return {
    id: 'folds', settingsKeys: ['foldingEnabled'], i18nKeys: ['fold.placeholder', 'fold.disabledHint'],
    setup: (ctx) => { foldKey = keyFor(ctx); },
    slots: [{ slot: 'fold', deps: (ctx) => ctx.settings.foldingEnabled, build: (ctx) => foldExtensionFor(ctx, ctx.settings.foldingEnabled) }],
    commands: { applyFold: (ctx, action, level) => applyFold(ctx, action as FoldAction, level === undefined ? 2 : Number(level)) },
    onMount: restore,
    beforeTabSwitch: (_ctx, view) => save(view),
    onTabSwitch: restore,
    onUnmount: (_ctx, view) => save(view),
  };
}
```

`restoreFoldRanges` / `captureFolds` need an `EditorView`-shaped object; if they only use `state`/`dispatch`, the tests can use `fakeView`.

- [ ] **Tests:** doc `# A\ntext\n## B\nmore\n# C\nend` with `stateWith(foldExtensionFor(ctx, true), doc, { anchor: 0 })` + `fakeView`: `applyFold(ctx,'all')` folds every foldable heading (read `currentFoldRanges(view.state)`), `'none'` clears, `'level', 2` folds only `##`, `'toggle'` folds the heading at the caret; `foldingEnabled: false` → toast `info:fold.disabledHint` and no dispatch; view focused once per successful call. Fold memory round trip: `beforeTabSwitch` on tab `t1` with folds → `onTabSwitch` on tab `t2` → back on `t1` restores the same ranges.

### Task 3: `session`

**Files:** `app/src/features/session/{contracts/session.feature.ts, contracts/index.ts, internal/restore-session.ts, *.test.ts, CLAUDE.md}`.

```ts
// internal/restore-session.ts — CM branch of 3147-3170
export function maybeRestoreSession(ctx: EditorFeatureContext, view: Pick<EditorView, 'state' | 'dispatch'>): void {
  const saved = readSession(ctx.tab().id);
  if (!saved || saved === '' || ctx.tab().content !== '') return;
  if (view.state.doc.length === 0 && saved !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: 0, insert: saved } });
  }
}

export function createSessionFeature(): EditorFeature {
  return {
    id: 'session', settingsKeys: [], i18nKeys: [],
    extensions: { session: (ctx) => sessionRestoreExtension(ctx.tab().id) },
    watches: [{
      deps: (ctx) => [ctx.tab().content, ctx.tab().savedContent] as const,
      run: (ctx) => { if (ctx.tab().content === ctx.tab().savedContent) clearSession(ctx.tab().id); },
    }],
    onMount: (ctx, view) => maybeRestoreSession(ctx, view),
    onTabSwitch: (ctx, view) => maybeRestoreSession(ctx, view),
  };
}
```

Today's clean-save watcher (3751-3756) runs `clearSession` when `content === saved` *as delivered to the callback*; reading `ctx.tab()` at run time sees the same values (the watcher fires synchronously after the change in `pre` flush) — keep this form.

- [ ] **Tests:** stub storage: `cm-session-restore` reads `localStorage`/`sessionStorage` — install a minimal in-memory `globalThis.localStorage` (and `sessionStorage`) in the test before importing; write a session for `t1`, empty tab content + empty doc → inserted; non-empty tab content → untouched; non-empty doc → untouched. Watch `run` with equal content/saved clears the stored session.

### Task 4: Register (controller, after PR-4…PR-7 all land)

- [ ] Controller adds `createImageUploadFeature`, `createSessionFeature`, `createFoldsFeature` to `EDITOR_FEATURE_FACTORIES` in LLD order (`… image-upload, completion, session, folds, format`).
