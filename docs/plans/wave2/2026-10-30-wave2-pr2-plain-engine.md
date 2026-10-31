# Wave 2 PR-2 — Plain-textarea engine → `PlainEditor` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Windows plain-textarea engine (≈ 2600 script + 235 template + 470 style lines) out of `components/Editor.vue` into `features/editor/ui/PlainEditor.vue` + children + `features/editor/internal/plain/*` without changing behavior.

**Architecture:** Extract-in-place, then move. Pure helpers first (characterized by Node tests), then composables sharing one `PlainState` object (Wave 1b `createX` pattern), then the component. `Editor.vue` renders `<PlainEditor>` in its `v-else` branch and forwards every exposed method's plain branch to it.

**Tech Stack:** Vue 3 SFC, TypeScript, `node --test`.

**Spec:** `docs/design/wave-refactor/2026-10-30-wave2-editor-lld.md` §PR-2 (line ranges refer to `Editor.vue` at `dcb2ad77`).

## Global Constraints

- No behavior change. Copy code verbatim; only change what moving requires (refs passed in, `props.x` → parameter).
- This PR is the only Wave 2 layer-2 PR that edits `app/src/components/Editor.vue`. Do not touch files other PRs own: `lib/cm-live-blocks.ts`, `lib/live-blocks/`, `features/<anything except editor>/`, `features/editor/{contracts,internal/core,internal/*.ts at top level}`, `shell/editor-registry.service.ts`.
- New files: `.ts` ≤ 400 lines, `.vue` ≤ 500 lines. `Editor.vue` may only shrink.
- No `vue` import in pure helper files (`plain-*.ts` without `use` prefix).
- Local imports end in `.ts`. No `any`.
- Workers never commit. `pnpm --dir app guard` green after each task.
- Plain path can be exercised on macOS with `?forcePlain` (dev hook, Editor.vue 260-263) in the `solomd-web-alt` preview (:1430).

---

### Task 1: Pure helpers + characterization tests

**Files:**
- Create: `app/src/features/editor/internal/plain/plain-blocks.ts` (+ `.test.ts`)
- Create: `app/src/features/editor/internal/plain/plain-edits.ts` (+ `.test.ts`)
- Create: `app/src/features/editor/internal/plain/plain-search.ts` (+ `.test.ts`)
- Modify: `app/src/components/Editor.vue` (delete the moved bodies, import them)

**Interfaces — Produces:**

```ts
// plain-blocks.ts — verbatim from Editor.vue 127-134, 542-552, 732-872, 2354-2369
export type PlainBlock = { id: string; start: number; end: number; text: string; hasTrailingNewline: boolean; html: string };
export function plainTocFingerprint(source: string): string;
export function splitPlainMarkdownBlocks(src: string): Array<{ start: number; end: number; text: string; hasTrailingNewline: boolean }>;
export function mapRenderedPrefixToSource(source: string, renderedPrefix: string): number;

// plain-edits.ts — verbatim from 1994-2030, 2136-2139; element param narrowed
export type TextareaLike = Pick<HTMLTextAreaElement, 'value' | 'selectionStart' | 'selectionEnd'>;
export function computePlainTabEdit(el: TextareaLike, outdent: boolean): { value: string; selStart: number; selEnd: number };
export function computeSmartEnter(el: TextareaLike): { value: string; caret: number } | null;

// plain-search.ts — the match-finding loop of runPlainSearch (1446-1464) as a pure fn
export function findPlainMatches(text: string, query: string, caseSensitive: boolean): Array<{ start: number; end: number }>;
```

Also move `buildAcItems` (1828-1867) and `baseNoteName` (1824) into `plain-autocomplete-items.ts` if they read only their arguments plus module imports; if `buildAcItems` reads `cachedCitations` / `workspaceIndex`, give it those as parameters: `buildAcItems(kind, query, sources: { citations(): CitationEntry[]; notePaths(): string[]; tags(): string[] })` — copy exactly which store fields it reads today.

- [ ] **Step 1: Characterization tests first** — write them against functions copied verbatim into the new files (Editor.vue untouched yet), then run them; they must PASS on the first run because they pin today's behavior. Examples:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitPlainMarkdownBlocks, mapRenderedPrefixToSource, plainTocFingerprint } from './plain-blocks.ts';

test('empty source is one empty block', () => {
  assert.deepEqual(splitPlainMarkdownBlocks(''), [{ start: 0, end: 0, text: '', hasTrailingNewline: false }]);
});
test('blocks cover the source exactly, in order', () => {
  const src = '# Title\n\npara one\nline two\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\n- a\n- b\n';
  const blocks = splitPlainMarkdownBlocks(src);
  assert.equal(blocks.map((b) => src.slice(b.start, b.end)).join(''), src);
  assert.ok(blocks.some((b) => b.text.startsWith('```js') && b.text.includes('const b = 2;')), 'fence with a blank line stays one block');
});
test('rendered prefix maps back past markdown markers', () => {
  assert.equal(mapRenderedPrefixToSource('**bold** text', 'bold t'), '**bold** t'.length);
});
test('fingerprint is stable and differs on change', () => {
  assert.equal(plainTocFingerprint('# a'), plainTocFingerprint('# a'));
  assert.notEqual(plainTocFingerprint('# a'), plainTocFingerprint('# b'));
});
```

If an assertion's expected value turns out different from today's output, the test is wrong, not the code: fix the expectation to today's output (these are characterization tests). Same style for `computePlainTabEdit` (indent a single line, outdent, multi-line selection), `computeSmartEnter` (`- item|` → new `- `; empty item ends the list), `findPlainMatches` (case-sensitive vs not; overlapping query `aa` in `aaaa` — match today's loop).

- [ ] **Step 2:** `cd app && node --test src/features/editor/internal/plain/` → PASS.
- [ ] **Step 3:** In `Editor.vue`, delete the moved definitions and import them from `../features/editor/internal/plain/<file>.ts`. `runPlainSearch` keeps its ref updates and calls `findPlainMatches`.
- [ ] **Step 4:** `pnpm --dir app guard` → exit 0.

### Task 2: Composables over one `PlainState`

**Files (create under `app/src/features/editor/internal/plain/`):**

| File | Moves (Editor.vue lines) |
|---|---|
| `usePlainState.ts` | `createPlainState(deps)`: refs 331-347, `plainLiveEnabled` 349, `plainEditorStyle` 353, history 1344-1415, `syncPlainEditorFromStore` / `syncPlainEditorAfterModeSwitch` / `handlePlainInput` 1260-1343, `focusPlainEditor` 1248, `plainInsertText` 1223, `plainSetCaret` 1152, `plainLineStartOffset` 1168, `emitPlainCursorAndSelection` 924-956, `plainSelectionText` 909 |
| `usePlainGutter.ts` | 359-448, 873-908 |
| `usePlainFolds.ts` | 449-523 |
| `usePlainRender.ts` | `plainBlocks` 524-541, `renderPlainBlock` 553-588, `processPlainLiveRenderedBlocks` 589-724, `attachPlainCodeCopyButtons` 725-731 |
| `usePlainOverlays.ts` | 957-1151 (typewriter, focus band, solid caret, overlay scheduling) |
| `usePlainFind.ts` | 1416-1801 |
| `usePlainAutocomplete.ts` | 1802-1993 |
| `usePlainKeys.ts` | 2031-2353, 2104-2177 helpers |
| `usePlainBlockEditing.ts` | 2401-2643, 2792-2887, 1191-1222 (scroll-to-line, live scroll sync, paste) |
| `usePlainContextMenu.ts` | plain branch of 2651-2784 (mousedown capture, contextmenu, menu actions) + `readClipboard`/`writeClipboard` copies |

**Interfaces — Produces:**

```ts
export interface PlainDeps {
  props: { tab: Tab; focusMode: boolean; typewriterMode: boolean; spellCheck: boolean };   // the component's reactive props
  emitCursor(line: number, col: number): void;
  emitSelection(text: string): void;
  getCitations(): CitationEntry[];
  imagePasteOpts(): ImagePasteOptions;
}
export function createPlainState(deps: PlainDeps): PlainState;   // PlainState = the refs + functions listed above
// every other composable: useX(state: PlainState, deps: PlainDeps, ...other composables' returns it calls)
```

Cross-calls between composables (e.g. find calls `selectPlainRange` from block editing) are passed as arguments in creation order; break cycles with a late-bound object (`const api = {} as PlainApi; … Object.assign(api, useX(...))`). Keep every function body verbatim.

- [ ] **Step 1:** Move one composable at a time, `Editor.vue` calling it from `<script setup>` (template unchanged; destructure the returned refs/functions under their old names so the template still compiles). Run `pnpm --dir app guard` after each file.
- [ ] **Step 2:** All plain watchers (422-447, 515, 1148, 1780, 3959, 3964-3973) move with their composable. Watchers that serve both engines (3809 content, 3895 folding, 3948 view mode, 3668 tab switch) split: plain branch → `PlainEditor` (Task 3), CM branch stays in `Editor.vue`.
- [ ] **Step 3:** `pnpm --dir app guard` → exit 0.

### Task 3: `PlainEditor.vue` + children + CSS; `Editor.vue` delegates

**Files:**
- Create: `app/src/features/editor/ui/PlainEditor.vue`, `PlainFindBar.vue`, `PlainAutocomplete.vue`, `plain-editor.css`, `plain-find-bar.css`, `plain-autocomplete.css` (use `<style scoped src="./x.css"></style>` only if a `.vue` would pass 500 lines)
- Modify: `app/src/components/Editor.vue`

**Interfaces:**

```vue
<!-- PlainEditor.vue -->
props: { tab: Tab; focusMode?: boolean; typewriterMode?: boolean; spellCheck?: boolean;
         getCitations: () => CitationEntry[]; imagePasteOpts: () => ImagePasteOptions }
emits: cursor(line, col), selection(text)
defineExpose<EditorApi>(…)   // EditorApi from features/editor/contracts/editor-api.port.ts (PR-1)
```

`PlainEditor` owns: template 4273-4507 (`.plain-host` and everything inside), `EditorContextMenu` teleport for the plain engine, styles 4550-5024, plain `onMounted` (3184-3222 + transform-case/format listeners for the plain branch), plain `onBeforeUnmount` work (3575-3582, plain `saveFolds`), plain branches of: tab switch (3675-3716 + `restorePlainScroll` 3637-3666 + `tabCaretMemory` for plain), content watcher (3812-3819), folding watcher (`plainFolds = []`), view-mode watcher (`syncPlainEditorAfterModeSwitch`, `processPlainLiveRenderedBlocks`), `maybeRestoreSession` (3150-3161), `saveFolds`/`restoreFolds` (plain lines), `onTransformCase` 3285-3317, `onFormatMarkdown` 3347-3376, `openFind` (plain), `openTableAtCursor`/`openFormulaAtCursor` (plain source/caret + `replaceDocRange` plain branch — copy the shared span logic for now; PR-7 dedups), `applyFold` (plain 3523-3560 incl. the shared guards), `gotoLine`, `insertImageFromPath`, `insertImageUrl`, `getViewLine`, `lineTopY`, `scrollToLine`, `insertMarkdown`, `getLineSelection` (returns `null`), `uploadLocalImages` (no-op: today it returns early because `view` is null).

Transform-case / format listeners: the plain component registers its own `solomd:transform-case` / `solomd:format-markdown` handlers running only the plain branch (plus the shared guards at the top of each handler: active-tab check, markdown check, `FORMAT_KINDS` check). `Editor.vue` keeps the CM handlers and registers them only when not plain.

`Editor.vue` after: `<div v-if="!usePlainWindowsEditor" …cm-host…>` unchanged; `<PlainEditor v-else ref="plainRef" :tab :focus-mode :typewriter-mode :spell-check :get-citations="() => cachedCitations" :image-paste-opts="imagePasteOpts" @cursor @selection />`. Each exposed method: `if (usePlainWindowsEditor) return plainRef.value?.<method>(...args);` then the CM body. The CM `EditorContextMenu` teleport stays in `Editor.vue`.

- [ ] **Step 1:** Build `PlainEditor.vue` from the composables; move template + CSS; wire `Editor.vue`.
- [ ] **Step 2:** `pnpm --dir app guard` → exit 0; `wc -l` every new file within budget; `Editor.vue` ≈ 1500.
- [ ] **Step 3: Browser check** (controller does it if the worker has no browser): `solomd-web-alt`, open `http://localhost:1430/?forcePlain=1`, new markdown tab: type text, Enter in a list, Tab indent, Ctrl+F find + replace, `[[` autocomplete, heading fold toggle in live edit, switch tabs and back (caret/scroll kept), right-click menu; then without `?forcePlain`, CM editor still types and finds. No console errors.
- [ ] **Step 4: Docs.** `features/editor/CLAUDE.md`: a "Plain engine" section (why it exists — WebView2 IME, Editor.vue 264-281 comment; files; `?forcePlain`).
