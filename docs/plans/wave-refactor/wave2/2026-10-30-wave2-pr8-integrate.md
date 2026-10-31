# Wave 2 PR-8 — Integrate: `Editor.vue` host composes the registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Editor.vue` < 400 lines: the CodeMirror path builds its state from `createEditorRegistry()` through `useEditorFeatures`; editor-owned `lib/` files move into their features; `Editor.vue` and `EditorContextMenu.vue` move into `features/`.

**Architecture:** Strangler swap, one feature group per seam: delete the `Editor.vue` copy of a feature's code once the registry provides it, run `guard`, commit. Host-only logic (view lifecycle, content sync, tab switch caret memory, scroll API) moves to `features/editor/internal/` composables and `cm-api.ts`.

**Tech Stack:** Vue 3 SFC, TypeScript, CodeMirror 6, `node --test`, Playwright e2e.

**Spec:** `docs/design/wave-refactor/2026-10-30-wave2-editor-lld.md` §PR-8, E11–E14, E23; ADR 0004.

## Global Constraints

- Rulings carried in: `md-completion` needs no safe-mode gate (flags were constant false); the CM transform-case/format listeners now live in the `format` feature's `setup` — `Editor.vue` must stop registering its own; the host runs `useEditorFeatures` on both engines (view null on plain) so setup/watches behave as today's component-wide watchers, but plain-only reactions (viewMode → plain sync, folding off → clear plain folds) stay in `PlainEditor`.

- No behavior change. The CM extension order is pinned by `EXTENSION_SLOTS`; the host's update listener sits in slot `update-listener`.
- `features/editor/ui/Editor.vue` < 400 lines; every new `.ts` ≤ 400, `.vue` ≤ 500.
- Lifecycle order must match today: mount → create view → (appearance) lazy language → (session) restore → (folds) restore; tab switch → (folds) save → caret memory save → `setState` → lazy language → session restore → folds restore → scroll reassert; unmount → folds save → listener cleanup → flush pending content → destroy.
- Outside imports of a feature go through its `contracts/index.ts` (the `feature-boundary` arch rule fails otherwise).
- Moving a baselined file: `git mv`, then rename its key in `app/arch/baseline.json` in the same commit (only allowed hand edit); then `pnpm --dir app arch:rebaseline`.
- Workers never commit; the controller commits per task after `pnpm --dir app verify`.

---

### Task 0: Register every feature (controller task from PR-4…PR-7)

**Files:** Modify `app/src/shell/editor-registry.service.ts`; create `app/src/shell/editor-registry.service.test.ts`.

- `EDITOR_FEATURE_FACTORIES` = `createCoreFeature, createAppearanceFeature, createLiveRenderFeature` (core lives inside the editor feature — export the three factories from `features/editor/contracts/index.ts`), then `createFindFeature, createVimFeature, createSpellcheckFeature, createAiRewriteFeature, createFocusModeFeature, createImageUploadFeature, createCompletionFeature, createSessionFeature, createFoldsFeature, createFormatFeature` (each from its `contracts/index.ts`). Session before folds (lifecycle order).
- Golden test: every `EXTENSION_SLOTS` entry except `update-listener` is used by ≥ 1 registered feature (static `extensions` key or slot); ids unique; commands unique; `createEditorRegistry().extensions(fakeContext({ settings: <defaults-like object> }), compartments)` builds an `EditorState` for a markdown tab and for a `ts` tab.

### Task 1: Host composables + `cm-api.ts`

**Files:** Create `app/src/features/editor/internal/{useCmView.ts, useCmTabSwitch.ts, cm-api.ts, cm-api.test.ts, editor-context.ts}`.

```ts
// editor-context.ts — builds the EditorFeatureContext from Vue sources
export function createEditorContext(sources: {
  props: { tab: Tab; focusMode: boolean; typewriterMode: boolean; spellCheck: boolean };
  settings: SettingsStore; themeMode(): 'light' | 'dark'; t: EditorFeatureContext['t'];
  tabs: { setContent(id: string, text: string): void; tabs: Tab[]; activeId: string | null };
  toasts: EditorFeatureContext['toast']; view(): EditorView | null; citations(): CitationEntry[];
}): EditorFeatureContext & { bind(host: EditorFeaturesHost, registry: EditorFeatureRegistry): void };
// bind() sets run → registry.command(name)(ctx, ...args) and reconfigure → host.reconfigure

// useCmView.ts — Editor.vue 192-197, 295-329 (content sync + flush), 3119-3143 (update listener → slot 'update-listener'),
// 3223-3247 (create view, dev expose, relayout + flush listeners), 3583-3596 (flush pending, dev cleanup, destroy)
export function useCmView(opts: { host: Ref<HTMLDivElement | null>; ctx: EditorFeatureContext; features: EditorFeaturesHost;
  emitCursor(line: number, col: number): void; emitSelection(text: string): void; noteTypedFormat(prefix: string, ch: string): void }): {
  view(): EditorView | null; updateListener(): Extension; mount(): void; unmount(): void; buildState(doc: string, anchor?: number): EditorState };

// useCmTabSwitch.ts — CM branch of 3601-3606 + 3668-3747 (caret memory, setState, #169 scroll reassert)
export function useCmTabSwitch(opts: { props: { tab: Tab }; cm: ReturnType<typeof useCmView>; features: EditorFeaturesHost }): void;

// cm-api.ts — CM branches; pure over EditorView (no Vue)
export function cmGotoLine(view: EditorView, line: number): void;          // 4000-4007
export function cmGetViewLine(view: EditorView): number;                    // 4168-4173
export function cmLineTopY(view: EditorView, line: number): number;        // 4190-4192
export function cmScrollToLine(view: EditorView, line: number): void;      // 4205-4218
export function cmGetLineSelection(view: ViewLike): LineSelection;         // 4125-4134
```

Also content watcher CM branch (3821-3835) → `useCmView` (`watch(() => ctx.tab().content, …)`), and the external `solomd:relayout` listener.

- [ ] Tests: `cmGetLineSelection` on `fakeView` (empty, multi-line, selection ending at a line start counts the previous line). Other `cm-api` functions need a real view — covered by e2e + browser check.

### Task 2: Swap `Editor.vue` to the registry (one commit per group)

Order: (a) `core` + `appearance` + `live-render` + host update listener; (b) `find`, `vim`, `spellcheck`, `focus-mode`; (c) `ai-rewrite`, `completion` (+ `useCitations` → `ctx.citations`); (d) `image-upload`, `session`, `folds`; (e) `format` + `useCmContextMenu`; each: delete the matching compartments, `buildExtensions` entries, watchers and helpers from `Editor.vue`; `pnpm --dir app guard`; controller commits. After (e) `buildExtensions` and every `Compartment` are gone; `Editor.vue` builds the CM `EditorApi` from `features.run(...)` + `cm-api`, and forwards to `PlainEditor` on the plain engine.

`PlainEditor` props `getCitations` / `imagePasteOpts` come from `ctx.citations` / `imagePasteOptionsFor(ctx)` (image-upload contracts). Point the plain engine's table/formula code at `openTableWith` / `openFormulaWith` / `formatMath` from `format` contracts and delete its copies.

### Task 3: Moves

- `Editor.vue` already moved in PR-2 (`features/editor/ui/`, imported via `contracts/editor-component.ts`). `git mv app/src/components/EditorContextMenu.vue app/src/features/context-menu/ui/`; re-export it from a `contracts/context-menu-component.ts` (never from `contracts/index.ts`, which Node tests load); update `Preview.vue`, `Editor.vue`, `PlainEditor.vue`, and the `import type { EditorMenuAction }` sites.
- `git mv` (E11/E12): `lib/cm-find-panel.ts` → `features/find/internal/`; `lib/cm-spellcheck.ts`, `lib/cm-spellcheck-theme.ts` → `features/spellcheck/internal/`; `lib/cm-image-paste.ts`, `lib/image-upload.ts` → `features/image-upload/internal/`; `lib/table-editor-bus.ts`, `lib/formula-editor-bus.ts` → `features/format/internal/`. Move their co-located tests too. Fix relative imports inside moved files; outside importers (`SettingsPanel.vue`, `AppLayout.vue`, `lib/settings-nav.ts` if it imports code, not just a string) import through the feature's `contracts/index.ts` (add re-exports). A `lib/` file that must import a moved module is a stop: report it (lib must not depend on features).
- `baseline.json`: rename `fileSize`/`libPurity` keys for moved files; `pnpm --dir app arch:rebaseline` → `Editor.vue` and `cm-live-blocks.ts` drop out of `fileSize`, `libPurity` 5 → 2.

### Task 4: Close the wave (controller)

- [ ] `features/*/CLAUDE.md` accurate; `features/editor/CLAUDE.md` lists core features + slot table; `app/CLAUDE.md` map (`src/features/` row, `components/` count); HLD Wave 2 row unchanged, LLD "As shipped" + "Parked" updated; ADR index already has 0004.
- [ ] Shell registry golden test: with every factory registered, every `EXTENSION_SLOTS` entry except `update-listener` is used by ≥ 1 feature, and `createEditorRegistry().extensions(fakeContext(...), compartments)` builds an `EditorState` for markdown and for `ts`.
- [ ] `pnpm --dir app verify` → exit 0; browser check (E23) on CM and `?forcePlain=1`; `pnpm --dir app full` → exit 0.
- [ ] Final review (Opus) over the whole wave; one fix wave if needed; commit; `git push origin main`; `gh run watch` → CI green.
