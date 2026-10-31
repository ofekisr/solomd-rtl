# Mindmap Phase 8 — Lens, Themes, Toolbar Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mindmap tabs use the global view buttons (Edit · Split · Live edit · Preview · Reading) through a per-tab Data · Map · Doc lens. The phase also adds a Settings → 🧠 Mindmap category, 5 map themes, toolbar icons, canvas controls, and a fix so paste cannot change a read-only map.

**Architecture:** Pure logic lives in focused `src/lib` modules, each unit-tested with `node:test`:
- `mindmap-lens.ts`: lens state, the 15-cell matrix, command ids, keybinding migration.
- `view-mode-guard.ts`: lets an active map veto a global view change.
- `mindmap-outline.ts`: outline Markdown from a parsed map.
- `mindmap-themes.ts`: presets and the WCAG contrast check.

`MindmapView.vue` renders the cell for the current `(lens, settings.viewMode)` pair from parts (`json`, `map`, `outlineText`, `outlinePreview`). `ReadingView.vue` delegates map tabs to a new `MindmapReading.vue`. Display application (theme → compact → branch → text → font) moves into a reusable applier in `useMindmapDisplay.ts`.

**Tech Stack:** Vue 3, Pinia, TypeScript, CodeMirror 6, Tauri 2, `mind-elixir` 5.15.1, `node:test`.

**Spec:** `docs/design/mindmap/2026-10-12-mindmap-phase8-lens-design.md`. Parent: `docs/design/mindmap/2026-10-11-mindmap-design.md`. Backlog (out of scope): `docs/design/mindmap/2026-10-12-mindmap-follow-ups.md`.

## Global Constraints

- Branch `feat/mindmap-phase8`; no worktree; never push.
- pnpm in `app/`. Phase 8 adds no npm dependency.
- TypeScript: no `any`, no zod (plain type guards), constants for every literal value, functions ≤ ~20 lines, early returns, no comments except non-obvious "why".
- `src/lib` imports between lib files use the `.ts` extension (node test runner requirement). Components, stores and composables import without extension, as today.
- Lookups by an untrusted string key use `Object.hasOwn` (never `key in obj`, which matches `toString`, `constructor`).
- Unit tests: `cd app && node --test --experimental-strip-types src/lib/<file>.test.ts`.
- Build: `cd app && pnpm build` (runs `vue-tsc` + `vite build`) must pass at the end of every task that touches `.vue`, stores or composables.
- Browser checks: `preview_start` with name `solomd-web` (`.claude/launch.json`, port 1420). Use a workspace with a `.mmap` file that has ≥ 3 levels, one Hebrew topic, and two identical subtrees (for the duplicates chip).
- Known pre-existing failures, out of scope: 12 `src/lib/*.test.ts` files with extensionless imports; one Rust assertion in `detect_language_from_extension`.
- Every map payload passes through the codec's `parse` (which runs `sanitizeMindmapData`) before it is rendered.
- New user-facing strings go in `app/src/i18n/en.ts` only. Other locales fall back.
- Layout uses logical properties (`inset-inline-*`, `margin-inline-*`, `border-inline-*`) so RTL mirrors.
- Colors use the app tokens `--bg`, `--bg-elev`, `--text`, `--text-faint`, `--border`, `--accent`. `--bg-secondary` does not exist.
- No new default key bindings.
- Commit trailer: `Co-Authored-By: Claude <model> 5.5 <noreply@anthropic.com>` (use the implementer's model name).

## Spec deltas (decided while planning)

| Spec says | Plan does | Why |
|---|---|---|
| Data · Split: invalid JSON keeps the last valid map | It also locks the map (read-only, no sync) while the JSON is invalid | A map edit would otherwise serialize over the user's unfinished JSON |
| Theme picker: select with a swatch strip per option | Radio group of buttons, each with a label and an 8-swatch strip | Native `<option>` cannot render swatches |
| Fit and Root sit beside the zoom controls | Appended into the package's `.mind-elixir-toolbar.rb` element | Gets the same position and styling with no duplicate positioning code |
| "N duplicates" | N = number of duplicate groups | Matches what the dialog lists |
| (silent) | The fit-width toolbar button stays Markdown-only | It only affects Markdown preview width |
| (silent) | Phase 7's `applyText` removed `--color`/`--main-color` when no text color was set. It now leaves them alone. | `changeTheme` already resets both to the preset. Removing them would erase the preset's text colors. |

## File Map

| File | Change | Task |
|---|---|---|
| `app/src/lib/mindmap-lens.ts` (+ test) | Create | 1 |
| `app/src/lib/keybindings.ts` | Replace 4 view ids with lens ids | 1 |
| `app/src/stores/settings.ts` | Keybinding migration on load; view-mode guard | 1, 2 |
| `app/src/types.ts` | `Tab.mindmapLens` | 1 |
| `app/src/lib/view-mode-guard.ts` (+ test) | Create | 2 |
| `app/src/lib/mindmap-outline.ts` (+ test) | Create | 3 |
| `app/src/components/MindmapOutlineText.vue` | Create | 3 |
| `app/src/components/MindmapCanvas.vue` | `locked` prop (3); canvas controls + duplicates chip (10) | 3, 10 |
| `app/src/components/MindmapView.vue` | Lens shell (4), applier (5), theme family (7) | 4, 5, 7 |
| `app/src/components/MindmapToolbar.vue` | Lens switch (4), icons (9), drop Find duplicates (10) | 4, 9, 10 |
| `app/src/components/Toolbar.vue` | View buttons on map tabs; `<>` disabled | 4 |
| `app/src/lib/mindmap-view-mode.ts` (+ test) | Delete | 4 |
| `app/src/composables/useMindmapDisplay.ts` | Applier (5); theme step (7) | 5, 7 |
| `app/src/components/MindmapReading.vue` | Create | 5 |
| `app/src/components/ReadingView.vue` | Delegate map tabs | 5 |
| `app/src/lib/mindmap-themes.ts` (+ test) | Create | 6 |
| `app/src/lib/mindmap-display.ts` (+ test) | `theme` key | 6 |
| `app/src/components/MindmapMapFields.vue` | Theme picker | 7 |
| `app/src/components/SettingsPanel.vue` | 🧠 Mindmap category | 8 |
| `app/src/composables/useMindmapCanvasControls.ts` | Create | 10 |
| `app/src/components/MindmapCanvas.vue` (paste, sync) | Read-only paste fix (spec §6) | 11 |
| `app/src/i18n/en.ts` | New strings | 1, 3, 4, 7, 8, 9, 10 |

---

### Task 1: Lens model, commands, keybinding migration

**Files:**
- Create: `app/src/lib/mindmap-lens.ts`
- Test: `app/src/lib/mindmap-lens.test.ts`
- Modify: `app/src/lib/keybindings.ts:210-213`, `app/src/stores/settings.ts` (load, ~line 771), `app/src/types.ts:40-42`

**Interfaces:**
- Consumes: `ViewMode` from `app/src/types.ts` (`'edit' | 'preview' | 'split' | 'liveEdit' | 'reading'`).
- Produces:
  - `type MindmapLens = 'data' | 'map' | 'doc'`
  - `type CellPart = 'json' | 'map' | 'outlinePreview' | 'outlineText' | 'wideMap' | 'outlineReading'`
  - `MINDMAP_LENSES: readonly MindmapLens[]`, `DEFAULT_MINDMAP_LENS`
  - `normalizeLens(value: unknown): MindmapLens`
  - `resolveTabLens(tab: { mindmapLens?: unknown; mindmapMode?: unknown }): MindmapLens`
  - `nextLens(lens: MindmapLens): MindmapLens`
  - `isLensAction(actionId: string): boolean`
  - `targetLensFor(actionId: string, current: MindmapLens): MindmapLens | null`
  - `lensCell(lens: MindmapLens, view: ViewMode): readonly CellPart[]` (first part renders inline-start)
  - `cellHas(parts: readonly CellPart[], part: CellPart): boolean`
  - `migrateLensKeybindings(bindings: Record<string, string | null>): Record<string, string | null>`
  - `type JsonExit = { ok: true } | { ok: false; error: string }`
  - `checkJsonExit(text: string, parse: (text: string) => JsonExit): JsonExit`

- [ ] **Step 1: Write the failing test**

`app/src/lib/mindmap-lens.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cellHas, checkJsonExit, isLensAction, lensCell, migrateLensKeybindings, nextLens,
  normalizeLens, resolveTabLens, targetLensFor, type CellPart, type MindmapLens,
} from './mindmap-lens.ts';
import type { ViewMode } from '../types.ts';

test('normalizeLens falls back to map', () => {
  assert.equal(normalizeLens('data'), 'data');
  assert.equal(normalizeLens('source'), 'map');
  assert.equal(normalizeLens(undefined), 'map');
});

test('resolveTabLens migrates the Phase 7 mindmapMode', () => {
  assert.equal(resolveTabLens({ mindmapMode: 'source' }), 'data');
  assert.equal(resolveTabLens({ mindmapMode: 'outline' }), 'doc');
  assert.equal(resolveTabLens({ mindmapMode: 'map' }), 'map');
  assert.equal(resolveTabLens({ mindmapMode: 'constructor' }), 'map');
  assert.equal(resolveTabLens({}), 'map');
});

test('resolveTabLens prefers mindmapLens over the legacy field', () => {
  assert.equal(resolveTabLens({ mindmapLens: 'doc', mindmapMode: 'source' }), 'doc');
  assert.equal(resolveTabLens({ mindmapLens: 'bogus', mindmapMode: 'source' }), 'map');
});

test('nextLens cycles data → map → doc → data', () => {
  assert.equal(nextLens('data'), 'map');
  assert.equal(nextLens('map'), 'doc');
  assert.equal(nextLens('doc'), 'data');
});

test('targetLensFor maps lens commands and ignores others', () => {
  assert.equal(targetLensFor('mindmap.lensData', 'map'), 'data');
  assert.equal(targetLensFor('mindmap.lensDoc', 'map'), 'doc');
  assert.equal(targetLensFor('mindmap.cycleLens', 'doc'), 'data');
  assert.equal(targetLensFor('mindmap.fit', 'map'), null);
  assert.equal(targetLensFor('toString', 'map'), null);
  assert.equal(isLensAction('mindmap.lensMap'), true);
  assert.equal(isLensAction('mindmap.viewMap'), false);
  assert.equal(isLensAction('constructor'), false);
});

const MATRIX: ReadonlyArray<[ViewMode, MindmapLens, CellPart[]]> = [
  ['edit', 'data', ['json']],
  ['edit', 'map', ['outlineText']],
  ['edit', 'doc', ['outlineText']],
  ['split', 'data', ['json', 'map']],
  ['split', 'map', ['map', 'outlinePreview']],
  ['split', 'doc', ['outlineText', 'outlinePreview']],
  ['liveEdit', 'data', ['map']],
  ['liveEdit', 'map', ['map']],
  ['liveEdit', 'doc', ['outlinePreview']],
  ['preview', 'data', ['outlinePreview']],
  ['preview', 'map', ['outlinePreview']],
  ['preview', 'doc', ['outlinePreview']],
  ['reading', 'data', ['wideMap']],
  ['reading', 'map', ['wideMap']],
  ['reading', 'doc', ['outlineReading']],
];

test('lensCell covers all 15 lens × view pairs', () => {
  for (const [view, lens, parts] of MATRIX) {
    assert.deepEqual(lensCell(lens, view), parts, `${lens} · ${view}`);
  }
});

test('cellHas checks membership', () => {
  assert.equal(cellHas(['json', 'map'], 'map'), true);
  assert.equal(cellHas(['outlineText'], 'json'), false);
});

test('migrateLensKeybindings moves old ids to new ids', () => {
  const out = migrateLensKeybindings({ 'mindmap.viewSource': 'Mod+1', 'mindmap.cycleView': null, 'file.save': 'Mod+S' });
  assert.deepEqual(out, { 'mindmap.lensData': 'Mod+1', 'mindmap.cycleLens': null, 'file.save': 'Mod+S' });
});

test('migrateLensKeybindings keeps an existing new-id binding', () => {
  const out = migrateLensKeybindings({ 'mindmap.viewMap': 'Mod+1', 'mindmap.lensMap': 'Mod+2' });
  assert.deepEqual(out, { 'mindmap.lensMap': 'Mod+2' });
});

test('checkJsonExit passes the parser error through', () => {
  assert.deepEqual(checkJsonExit('{}', () => ({ ok: true })), { ok: true });
  assert.deepEqual(checkJsonExit('{', () => ({ ok: false, error: 'Invalid JSON: x' })), { ok: false, error: 'Invalid JSON: x' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-lens.test.ts`
Expected: FAIL — `Cannot find module .../mindmap-lens.ts`.

- [ ] **Step 3: Write the implementation**

`app/src/lib/mindmap-lens.ts`:

```ts
import type { ViewMode } from '../types.ts';

export type MindmapLens = 'data' | 'map' | 'doc';
export type CellPart = 'json' | 'map' | 'outlinePreview' | 'outlineText' | 'wideMap' | 'outlineReading';
export type JsonExit = { ok: true } | { ok: false; error: string };

export const MINDMAP_LENSES: readonly MindmapLens[] = ['data', 'map', 'doc'];
export const DEFAULT_MINDMAP_LENS: MindmapLens = 'map';
const CYCLE = 'cycle';

const LEGACY_MODE_TO_LENS: Readonly<Record<string, MindmapLens>> = { source: 'data', outline: 'doc', map: 'map' };

const LENS_ACTIONS: Readonly<Record<string, MindmapLens | typeof CYCLE>> = {
  'mindmap.lensData': 'data',
  'mindmap.lensMap': 'map',
  'mindmap.lensDoc': 'doc',
  'mindmap.cycleLens': CYCLE,
};

const LEGACY_LENS_ACTION_IDS: Readonly<Record<string, string>> = {
  'mindmap.viewMap': 'mindmap.lensMap',
  'mindmap.viewSource': 'mindmap.lensData',
  'mindmap.viewOutline': 'mindmap.lensDoc',
  'mindmap.cycleView': 'mindmap.cycleLens',
};

const CELLS: Readonly<Record<ViewMode, Readonly<Record<MindmapLens, readonly CellPart[]>>>> = {
  edit: { data: ['json'], map: ['outlineText'], doc: ['outlineText'] },
  split: { data: ['json', 'map'], map: ['map', 'outlinePreview'], doc: ['outlineText', 'outlinePreview'] },
  liveEdit: { data: ['map'], map: ['map'], doc: ['outlinePreview'] },
  preview: { data: ['outlinePreview'], map: ['outlinePreview'], doc: ['outlinePreview'] },
  reading: { data: ['wideMap'], map: ['wideMap'], doc: ['outlineReading'] },
};

export function normalizeLens(value: unknown): MindmapLens {
  return MINDMAP_LENSES.includes(value as MindmapLens) ? (value as MindmapLens) : DEFAULT_MINDMAP_LENS;
}

export function resolveTabLens(tab: { mindmapLens?: unknown; mindmapMode?: unknown }): MindmapLens {
  if (tab.mindmapLens !== undefined) return normalizeLens(tab.mindmapLens);
  const legacy = tab.mindmapMode;
  if (typeof legacy !== 'string' || !Object.hasOwn(LEGACY_MODE_TO_LENS, legacy)) return DEFAULT_MINDMAP_LENS;
  return LEGACY_MODE_TO_LENS[legacy];
}

export function nextLens(lens: MindmapLens): MindmapLens {
  return MINDMAP_LENSES[(MINDMAP_LENSES.indexOf(lens) + 1) % MINDMAP_LENSES.length];
}

export function isLensAction(actionId: string): boolean {
  return Object.hasOwn(LENS_ACTIONS, actionId);
}

export function targetLensFor(actionId: string, current: MindmapLens): MindmapLens | null {
  if (!isLensAction(actionId)) return null;
  const target = LENS_ACTIONS[actionId];
  return target === CYCLE ? nextLens(current) : target;
}

export function lensCell(lens: MindmapLens, view: ViewMode): readonly CellPart[] {
  return CELLS[view][lens];
}

export function cellHas(parts: readonly CellPart[], part: CellPart): boolean {
  return parts.includes(part);
}

export function migrateLensKeybindings(bindings: Record<string, string | null>): Record<string, string | null> {
  const out = { ...bindings };
  for (const [legacy, next] of Object.entries(LEGACY_LENS_ACTION_IDS)) {
    if (!Object.hasOwn(out, legacy)) continue;
    if (!Object.hasOwn(out, next)) out[next] = out[legacy];
    delete out[legacy];
  }
  return out;
}

export function checkJsonExit(text: string, parse: (text: string) => JsonExit): JsonExit {
  const result = parse(text);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-lens.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Replace the registry entries**

In `app/src/lib/keybindings.ts`, replace lines 210–213 (`mindmap.viewMap` … `mindmap.cycleView`) with:

```ts
  { id: 'mindmap.lensData', label: 'Mindmap: Data Lens', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.lensMap', label: 'Mindmap: Map Lens', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.lensDoc', label: 'Mindmap: Doc Lens', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.cycleLens', label: 'Mindmap: Cycle Lens', category: 'mindmap', scope: 'mindmap', defaults: [] },
```

The command palette builds mindmap commands from `KEY_ACTIONS` (`useCommands.ts:158`), so no palette change is needed.

- [ ] **Step 6: Migrate stored bindings on load**

In `app/src/stores/settings.ts`, add `import { migrateLensKeybindings } from '../lib/mindmap-lens';`. Directly after the `for (const [k, v] of Object.entries(parsed.keybindings))` block (~line 775), add:

```ts
      merged.keybindings = migrateLensKeybindings(merged.keybindings);
```

- [ ] **Step 7: Add the tab field**

In `app/src/types.ts`, replace the `mindmapMode` doc comment and field with:

```ts
  /** Mindmap tabs only: Data · Map · Doc lens. Read through `resolveTabLens`. */
  mindmapLens?: 'data' | 'map' | 'doc';
  /** Phase 7 field, read once by `resolveTabLens` for migration and then deleted. */
  mindmapMode?: 'map' | 'source' | 'outline';
```

- [ ] **Step 8: Build**

Run: `cd app && pnpm build`
Expected: success. (`MindmapView` still uses `mindmap-view-mode.ts`; Task 4 replaces it.)

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/mindmap-lens.ts app/src/lib/mindmap-lens.test.ts app/src/lib/keybindings.ts app/src/stores/settings.ts app/src/types.ts
git commit -m "feat(mindmap): lens model, lens commands, keybinding id migration"
```

---

### Task 2: View-mode guard

**Files:**
- Create: `app/src/lib/view-mode-guard.ts`
- Test: `app/src/lib/view-mode-guard.test.ts`
- Modify: `app/src/stores/settings.ts` (`setViewMode` ~line 850, `toggleReadingMode` ~line 881)

**Interfaces:**
- Produces:
  - `type ViewModeGuard = (next: ViewMode) => boolean`
  - `addViewModeGuard(guard: ViewModeGuard): () => void` (returns the remover)
  - `isViewModeChangeAllowed(next: ViewMode): boolean`

- [ ] **Step 1: Write the failing test**

`app/src/lib/view-mode-guard.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addViewModeGuard, isViewModeChangeAllowed } from './view-mode-guard.ts';

test('no guards allows every change', () => {
  assert.equal(isViewModeChangeAllowed('split'), true);
});

test('a blocking guard vetoes until removed', () => {
  const seen: string[] = [];
  const remove = addViewModeGuard((next) => { seen.push(next); return next !== 'reading'; });
  assert.equal(isViewModeChangeAllowed('split'), true);
  assert.equal(isViewModeChangeAllowed('reading'), false);
  remove();
  assert.equal(isViewModeChangeAllowed('reading'), true);
  assert.deepEqual(seen, ['split', 'reading']);
});

test('every guard must allow', () => {
  const removeA = addViewModeGuard(() => true);
  const removeB = addViewModeGuard(() => false);
  assert.equal(isViewModeChangeAllowed('edit'), false);
  removeA();
  removeB();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/view-mode-guard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`app/src/lib/view-mode-guard.ts`:

```ts
import type { ViewMode } from '../types.ts';

export type ViewModeGuard = (next: ViewMode) => boolean;

const guards = new Set<ViewModeGuard>();

export function addViewModeGuard(guard: ViewModeGuard): () => void {
  guards.add(guard);
  return () => { guards.delete(guard); };
}

export function isViewModeChangeAllowed(next: ViewMode): boolean {
  for (const guard of guards) {
    if (!guard(next)) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test --experimental-strip-types src/lib/view-mode-guard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the store**

In `app/src/stores/settings.ts` add `import { isViewModeChangeAllowed } from '../lib/view-mode-guard';`.

At the top of `setViewMode(mode)`:

```ts
      if (mode !== this.viewMode && !isViewModeChangeAllowed(mode)) return;
```

In `toggleReadingMode()`, in the `else` branch before `this.lastNonReadingViewMode = this.viewMode;`:

```ts
        if (!isViewModeChangeAllowed('reading')) return;
```

`cycleViewMode` and `toggleLiveEditSource` go through `setViewMode`. `exitReadingMode` needs no guard: no reading cell contains the JSON editor.

- [ ] **Step 6: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/view-mode-guard.ts app/src/lib/view-mode-guard.test.ts app/src/stores/settings.ts
git commit -m "feat(view): view-mode guard so an active editor can veto a global view change"
```

---

### Task 3: Outline Markdown helper, read-only outline text, locked canvas

**Files:**
- Create: `app/src/lib/mindmap-outline.ts`, `app/src/components/MindmapOutlineText.vue`
- Test: `app/src/lib/mindmap-outline.test.ts`
- Modify: `app/src/components/MindmapCanvas.vue`, `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: `mapToHeadingsMarkdown(data)` (`mindmap-headings.ts`), `withoutGateArrows(data)` (`mindmap-graph.ts`), `MindmapCodec` (`mindmap-format.ts`).
- Produces:
  - `type ParsedMap = ReturnType<MindmapCodec['parse']>`
  - `outlineMarkdownOf(parsed: ParsedMap): string` (`''` when parsing failed)
  - `outlineLines(markdown: string): string[]`
  - `<MindmapOutlineText :markdown="string" />`
  - `MindmapCanvas` prop `locked?: boolean` (default `false`): no editing and no `update:content` while true

- [ ] **Step 1: Write the failing test**

`app/src/lib/mindmap-outline.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mmapCodec } from './mindmap-format.ts';
import { outlineLines, outlineMarkdownOf } from './mindmap-outline.ts';

const codec = mmapCodec('plan.mmap');
const DATA = { nodeData: { id: 'root', topic: 'Root', children: [{ id: 'a', topic: 'שלום' }, { id: 'b', topic: 'Child' }] } };

test('outlineMarkdownOf renders topics as headings', () => {
  const md = outlineMarkdownOf(codec.parse(codec.serialize(DATA)));
  assert.match(md, /Root/);
  assert.match(md, /שלום/);
  assert.match(md, /Child/);
  assert.ok(md.indexOf('Root') < md.indexOf('Child'));
});

test('outlineMarkdownOf returns empty text for unparsable input', () => {
  assert.equal(outlineMarkdownOf(codec.parse('{ not json')), '');
});

test('outlineLines splits on newlines', () => {
  assert.deepEqual(outlineLines('# A\n\n## B'), ['# A', '', '## B']);
});
```

If `codec.serialize` rejects `DATA` because the type wants more fields, build it with the same helper `mindmap-format.test.ts` uses for valid maps.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-outline.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`app/src/lib/mindmap-outline.ts`:

```ts
import type { MindmapCodec } from './mindmap-format.ts';
import { mapToHeadingsMarkdown } from './mindmap-headings.ts';
import { withoutGateArrows } from './mindmap-graph.ts';

export type ParsedMap = ReturnType<MindmapCodec['parse']>;

const LINE_BREAK = '\n';

export function outlineMarkdownOf(parsed: ParsedMap): string {
  return parsed.ok ? mapToHeadingsMarkdown(withoutGateArrows(parsed.data)) : '';
}

export function outlineLines(markdown: string): string[] {
  return markdown.split(LINE_BREAK);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-outline.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Read-only outline text component**

`app/src/components/MindmapOutlineText.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../i18n';
import { outlineLines } from '../lib/mindmap-outline';

const props = defineProps<{ markdown: string }>();
const { t } = useI18n();
const lines = computed(() => outlineLines(props.markdown));
</script>

<template>
  <div class="mm-outline-text">
    <p class="mm-outline-text__note" role="note">{{ t('mindmap.outlineLocked') }}</p>
    <div class="mm-outline-text__body" aria-readonly="true">
      <div v-for="(line, index) in lines" :key="index" class="mm-outline-text__line" dir="auto">{{ line }}</div>
    </div>
  </div>
</template>

<style scoped>
.mm-outline-text { display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--bg); color: var(--text); }
.mm-outline-text__note { margin: 0; padding: 6px 12px; font-size: 12px; color: var(--text-faint); background: var(--bg-elev); border-block-end: 1px solid var(--border); }
.mm-outline-text__body { flex: 1; overflow: auto; padding: 12px 16px; font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; line-height: 1.6; }
.mm-outline-text__line { white-space: pre-wrap; min-height: 1.6em; unicode-bidi: plaintext; text-align: start; }
</style>
```

Add to `mindmap` in `app/src/i18n/en.ts`:

```ts
    outlineLocked: 'Editing Markdown → map is not available yet',
```

- [ ] **Step 6: Add the `locked` prop to the canvas**

In `app/src/components/MindmapCanvas.vue`:

1. Props: add `locked?: boolean` to the type and `locked: false` to `withDefaults`.
2. Add a helper and use it wherever edit is (re-)enabled:

```ts
function canEdit(): boolean {
  return !isReadOnly.value && !props.locked;
}
```

   - `mount()`: `editable: canEdit(),`
   - `applyExternalContent()`: `if (wasGraphView && canEdit()) mind.enableEdit();`
   - `leaveGraphView()`: `if (canEdit()) instance.enableEdit();`
3. `syncNow()`: change the guard to `if (!mind || props.locked || isGraphView.value || parseError.value !== null) return;`
4. Add the watcher next to the other watchers:

```ts
watch(() => props.locked, (isLocked) => {
  if (!mind || isGraphView.value) return;
  if (isLocked) mind.disableEdit();
  else if (canEdit()) mind.enableEdit();
});
```

- [ ] **Step 7: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/mindmap-outline.ts app/src/lib/mindmap-outline.test.ts app/src/components/MindmapOutlineText.vue app/src/components/MindmapCanvas.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): outline helper, read-only outline text, locked canvas"
```

---

### Task 4: Lens shell — cells, split, guards, toolbars

**Files:**
- Modify: `app/src/components/MindmapView.vue`, `app/src/components/MindmapToolbar.vue`, `app/src/components/Toolbar.vue`, `app/src/i18n/en.ts`
- Delete: `app/src/lib/mindmap-view-mode.ts`, `app/src/lib/mindmap-view-mode.test.ts`

**Interfaces:**
- Consumes: everything Tasks 1–3 produce; `addViewModeGuard`; `tabs.activeId: string`; `settings.viewMode: ViewMode`.
- Produces:
  - `MindmapView` exposes `{ setLens(next: MindmapLens): void, canvas, lens }`.
  - `MindmapToolbar` props `{ lens: MindmapLens; hasMap: boolean; isPanelOpen: boolean; isReadOnly: boolean; isGraphView: boolean }`, emits `set-lens`, `run`, `toggle-panel`.

- [ ] **Step 1: Check for callers of the old shell API**

Run: `cd app && grep -rn "setMode\|mindmap-view-mode\|MindmapMode" src --include=*.ts --include=*.vue`
Expected: hits only in `MindmapView.vue`, `MindmapToolbar.vue` and the two `mindmap-view-mode` files. Update any other hit to `setLens` / `MindmapLens`.

- [ ] **Step 2: Rewrite the `MindmapView.vue` script**

Replace the imports, state and functions from the top of `<script setup>` through `setOverride`/`clearOverride` as follows. Keep `applyNodePatch`, `findLiveElement`, the display block, `onUpdate` and `onJump` unchanged.

```ts
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MindElixirInstance, NodeObj } from 'mind-elixir';
import type { Topic } from 'mind-elixir';
import type { Tab, ViewMode } from '../types';
import { useI18n } from '../i18n';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useSettingsStore } from '../stores/settings';
import { mmapCodec } from '../lib/mindmap-format';
import { outlineMarkdownOf } from '../lib/mindmap-outline';
import { cellHas, checkJsonExit, isLensAction, lensCell, resolveTabLens, targetLensFor, type CellPart, type MindmapLens } from '../lib/mindmap-lens';
import { addViewModeGuard } from '../lib/view-mode-guard';
import { clearActiveMindmap, setActiveMindmap, type MindmapCanvasApi, type MindmapHandle } from '../lib/mindmap-active';
import { eventToCombo, resolveBindings } from '../lib/keybindings';
import { useMindmapJump } from '../composables/useMindmapJump';
import type { MindmapSource } from '../lib/mindmap-source';
import MindmapToolbar from './MindmapToolbar.vue';
import { buildNodePatch, type NodeField } from '../lib/mindmap-node-style';
import MindmapCanvas from './MindmapCanvas.vue';
import MindmapSidePanel from './MindmapSidePanel.vue';
import MindmapNodeFields from './MindmapNodeFields.vue';
import MindmapMapFields from './MindmapMapFields.vue';
import MindmapOutlineText from './MindmapOutlineText.vue';
import { resolveMapDisplay, type MapDisplay } from '../lib/mindmap-display';
import { applyMapDisplay, captureBranchGenerators, type BranchGenerators } from '../composables/useMindmapDisplay';
import Editor from './Editor.vue';
import Preview from './Preview.vue';

const SOURCE_LANGUAGE = 'json';
const FLUSH_CONTENT_EVENT = 'solomd:flush-content-sync';
const TOGGLE_PANEL_ACTION = 'mindmap.togglePanel';
const props = defineProps<{ tab: Tab }>();
const tabs = useTabsStore();
const toasts = useToastsStore();
const settings = useSettingsStore();
const { t } = useI18n();
const { jumpTo } = useMindmapJump();
const codec = computed(() => mmapCodec(props.tab.fileName));
const exportName = computed(() => props.tab.fileName.replace(/\.[^.]+$/u, ''));
const lens = computed<MindmapLens>(() => resolveTabLens(props.tab));
const parts = computed(() => lensCell(lens.value, settings.viewMode));
const canvas = ref<MindmapCanvasApi | null>(null);
const sourceError = ref<string | null>(null);
const selected = ref<NodeObj[]>([]);
const singleNode = computed(() => (selected.value.length === 1 ? selected.value[0] : null));
const isPanelEditable = computed(() => !(canvas.value?.isReadOnly || canvas.value?.isGraphView));

function has(part: CellPart): boolean {
  return cellHas(parts.value, part);
}

function partOrder(part: CellPart): number {
  return parts.value.indexOf(part);
}

const isSplit = computed(() => parts.value.length > 1);
const isPanelVisible = computed(() => has('map') && settings.mindmapPanelOpen);
const parsedContent = computed(() => codec.value.parse(props.tab.content));
const outlineMarkdown = computed(() => (has('outlineText') || has('outlinePreview') ? outlineMarkdownOf(parsedContent.value) : ''));
const lastValidContent = ref('');
const liveJsonError = computed<string | null>(() => {
  if (!has('json') || !has('map') || parsedContent.value.ok) return null;
  return parsedContent.value.error;
});
const jsonError = computed(() => sourceError.value ?? liveJsonError.value);
const mapContent = computed(() => (has('json') ? lastValidContent.value : props.tab.content));

watch(parsedContent, (parsed) => { if (parsed.ok) lastValidContent.value = props.tab.content; }, { immediate: true });
watch(() => has('map'), (hasMap) => { if (!hasMap) selected.value = []; });

const sourceTab = computed<Tab>(() => new Proxy(props.tab, {
  get: (target, key) => (key === 'language' ? SOURCE_LANGUAGE : Reflect.get(target, key)),
}));

function leaveJsonAllowed(): boolean {
  const exit = checkJsonExit(props.tab.content, (text) => codec.value.parse(text));
  if (exit.ok) return true;
  sourceError.value = exit.error;
  toasts.error(t('mindmap.sourceInvalid'));
  return false;
}

function leaveCellAllowed(nextParts: readonly CellPart[]): boolean {
  canvas.value?.flush();
  if (!has('json') || cellHas(nextParts, 'json')) return true;
  window.dispatchEvent(new Event(FLUSH_CONTENT_EVENT));
  return leaveJsonAllowed();
}

function guardViewChange(next: ViewMode): boolean {
  if (tabs.activeId !== props.tab.id) return true;
  return leaveCellAllowed(lensCell(lens.value, next));
}

function storeLens(next: MindmapLens): void {
  props.tab.mindmapLens = next;
  delete props.tab.mindmapMode;
  tabs.persist();
}

function setLens(next: MindmapLens): void {
  if (next === lens.value) return;
  if (!leaveCellAllowed(lensCell(next, settings.viewMode))) return;
  sourceError.value = null;
  selected.value = [];
  storeLens(next);
}

function migrateLegacyMode(): void {
  if (props.tab.mindmapLens === undefined && props.tab.mindmapMode !== undefined) storeLens(lens.value);
}

function openAsText(): void {
  setLens('data');
  if (!has('json')) settings.setViewMode('edit');
}
```

`watch(parsedContent, …)` runs while the JSON editor is in the cell, so `lastValidContent` stays current when the user enters Data · Split.

- [ ] **Step 3: Update view actions, keys and lifecycle**

Replace `runViewAction`, `onViewKey`, the `onMounted`/`onBeforeUnmount` lines and `defineExpose`:

```ts
function runViewAction(actionId: string): boolean {
  if (actionId === TOGGLE_PANEL_ACTION) {
    settings.toggleMindmapPanel();
    return true;
  }
  const target = targetLensFor(actionId, lens.value);
  if (target === null) return false;
  setLens(target);
  return true;
}
```

```ts
function onViewKey(e: KeyboardEvent): void {
  const combo = eventToCombo(e);
  const actionId = combo ? resolveBindings(settings.keybindings, 'mindmap').get(combo) : undefined;
  if (!actionId || !(isLensAction(actionId) || actionId === TOGGLE_PANEL_ACTION)) return;
  e.preventDefault();
  e.stopPropagation();
  runViewAction(actionId);
}
```

```ts
let removeViewGuard: (() => void) | null = null;

onMounted(() => {
  migrateLegacyMode();
  removeViewGuard = addViewModeGuard(guardViewChange);
  activate();
});
onBeforeUnmount(() => {
  removeViewGuard?.();
  clearActiveMindmap(handle);
});
defineExpose({ setLens, canvas, lens });
```

- [ ] **Step 4: Replace the template and styles**

```vue
<template>
  <div class="mindmap-shell" @keydown.capture="onViewKey" @focusin="activate" @pointerdown="activate">
    <MindmapToolbar
      :lens="lens"
      :has-map="has('map')"
      :is-panel-open="settings.mindmapPanelOpen"
      :is-read-only="canvas?.isReadOnly ?? false"
      :is-graph-view="canvas?.isGraphView ?? false"
      @set-lens="setLens"
      @run="(id) => handle.run(id)"
      @toggle-panel="settings.toggleMindmapPanel()"
    />
    <div class="mindmap-shell__body">
      <div class="mindmap-shell__cell" :class="{ 'mindmap-shell__cell--split': isSplit }">
        <div v-if="has('json')" class="mindmap-shell__source" :style="{ order: partOrder('json') }">
          <div v-if="jsonError" class="mindmap-shell__error" role="alert">{{ jsonError }}</div>
          <Editor :key="`${tab.id}-source`" :tab="sourceTab" />
        </div>
        <MindmapCanvas
          v-if="has('map')"
          ref="canvas"
          :style="{ order: partOrder('map') }"
          :content="mapContent"
          :codec="codec"
          :export-name="exportName"
          :register-active="false"
          :locked="liveJsonError !== null"
          @update:content="onUpdate"
          @selection="(nodes) => (selected = nodes.map((n) => ({ ...n })))"
          @open-as-text="openAsText"
          @jump-to-source="onJump"
          @ready="onCanvasReady"
        />
        <MindmapOutlineText v-if="has('outlineText')" :markdown="outlineMarkdown" :style="{ order: partOrder('outlineText') }" />
        <Preview v-if="has('outlinePreview')" :source="outlineMarkdown" class="mindmap-shell__outline" :style="{ order: partOrder('outlinePreview') }" />
      </div>
      <MindmapSidePanel v-if="isPanelVisible" :has-single-node="singleNode !== null">
        <template #node>
          <p v-if="!isPanelEditable" class="mindmap-shell__hint">{{ t('mindmap.panelReadOnly') }}</p>
          <MindmapNodeFields v-if="singleNode" :node="singleNode" :disabled="!isPanelEditable" @patch="applyNodePatch" />
        </template>
        <template #map>
          <MindmapMapFields :value="displayOverride" :inherited="settings.mindmapDefaults" :disabled="!isPanelEditable" @set="setOverride" @clear="clearOverride" />
        </template>
      </MindmapSidePanel>
    </div>
  </div>
</template>

<style scoped>
.mindmap-shell { display: flex; flex-direction: column; width: 100%; height: 100%; }
.mindmap-shell__body { position: relative; flex: 1; min-height: 0; display: flex; }
.mindmap-shell__body > * { flex: 1; min-width: 0; }
.mindmap-shell__cell { display: flex; min-height: 0; }
.mindmap-shell__cell > * { flex: 1; min-width: 0; min-height: 0; }
.mindmap-shell__cell--split { gap: 1px; background: var(--border); }
.mindmap-shell__cell--split > * { background: var(--bg); }
.mindmap-shell__source { display: flex; flex-direction: column; }
.mindmap-shell__error { padding: 6px 12px; font-size: 12px; background: var(--bg-elev); color: var(--text); border-block-end: 1px solid var(--border); }
.mindmap-shell__hint { font-size: 12px; color: var(--text-faint); }
.mindmap-shell__outline { overflow: auto; }
.mindmap-shell__outline :deep(:is(h1, h2, h3, h4, h5, h6, li, p)) { unicode-bidi: plaintext; text-align: start; }
</style>
```

The panel rule `.mindmap-shell__body > *` is unchanged from Phase 7. If the side panel widens, give `MindmapSidePanel` `flex: none` in its own styles.

- [ ] **Step 5: Replace `MindmapToolbar.vue`**

```vue
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from '../i18n';
import { MINDMAP_LENSES, type MindmapLens } from '../lib/mindmap-lens';

const props = defineProps<{ lens: MindmapLens; hasMap: boolean; isPanelOpen: boolean; isReadOnly: boolean; isGraphView: boolean }>();
const emit = defineEmits<{ 'set-lens': [lens: MindmapLens]; run: [actionId: string]; 'toggle-panel': [] }>();
const { t } = useI18n();
const isMenuOpen = ref(false);

const LENS_LABEL_KEYS: Record<MindmapLens, string> = { data: 'mindmap.lensData', map: 'mindmap.lensMap', doc: 'mindmap.lensDoc' };
const EXPORT_ITEMS: readonly { id: string; label: string }[] = [
  { id: 'mindmap.exportPng', label: 'PNG' },
  { id: 'mindmap.exportSvg', label: 'SVG' },
  { id: 'mindmap.exportHtml', label: 'HTML' },
  { id: 'mindmap.exportJson', label: 'JSON' },
  { id: 'mindmap.exportMarkdown', label: 'Markdown' },
  { id: 'mindmap.exportMermaid', label: 'Mermaid' },
  { id: 'mindmap.exportAdjacency', label: 'Adjacency JSON' },
];
const MAP_ONLY_ITEMS: readonly { id: string; labelKey: string }[] = [
  { id: 'mindmap.copyPlaintext', labelKey: 'mindmap.menuCopyPlaintext' },
  { id: 'mindmap.toHeadingsDocument', labelKey: 'mindmap.menuHeadings' },
  { id: 'mindmap.findDuplicates', labelKey: 'mindmap.menuDuplicates' },
  { id: 'mindmap.shortcutHelp', labelKey: 'mindmap.menuShortcuts' },
];

function closeOnOutsidePointer(event: PointerEvent): void {
  if (!(event.target as Element | null)?.closest('.mm-toolbar__more')) isMenuOpen.value = false;
}

watch(isMenuOpen, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', closeOnOutsidePointer);
  else document.removeEventListener('pointerdown', closeOnOutsidePointer);
});
watch(() => [props.lens, props.hasMap], () => { isMenuOpen.value = false; });
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutsidePointer));

function runAndClose(actionId: string): void {
  isMenuOpen.value = false;
  emit('run', actionId);
}
</script>

<template>
  <div class="mm-toolbar" role="toolbar">
    <div class="mm-toolbar__modes" role="tablist" :aria-label="t('mindmap.lensLabel')">
      <button v-for="l in MINDMAP_LENSES" :key="l" type="button" role="tab" :aria-selected="lens === l" :class="{ active: lens === l }" @click="emit('set-lens', l)">
        {{ t(LENS_LABEL_KEYS[l]) }}
      </button>
    </div>
    <button type="button" :title="t('mindmap.toolbarUndo')" :aria-label="t('mindmap.toolbarUndo')" :disabled="!hasMap || isReadOnly || isGraphView" @click="emit('run', 'mindmap.undo')">↶</button>
    <button type="button" :title="t('mindmap.toolbarRedo')" :aria-label="t('mindmap.toolbarRedo')" :disabled="!hasMap || isReadOnly || isGraphView" @click="emit('run', 'mindmap.redo')">↷</button>
    <button type="button" :title="t('mindmap.toolbarPanel')" :aria-label="t('mindmap.toolbarPanel')" :aria-pressed="isPanelOpen" :disabled="!hasMap" @click="emit('toggle-panel')">▤</button>
    <div class="mm-toolbar__more">
      <button type="button" :title="t('mindmap.toolbarMore')" :aria-label="t('mindmap.toolbarMore')" :aria-expanded="isMenuOpen" :disabled="!hasMap" @click="isMenuOpen = !isMenuOpen">⋯</button>
      <div v-if="isMenuOpen" class="mm-toolbar__menu" role="menu" @keydown.escape="isMenuOpen = false">
        <div class="mm-toolbar__group">{{ t('mindmap.menuExport') }}</div>
        <button v-for="item in EXPORT_ITEMS" :key="item.id" type="button" role="menuitem" @click="runAndClose(item.id)">{{ item.label }}</button>
        <hr />
        <button v-for="item in MAP_ONLY_ITEMS" :key="item.id" type="button" role="menuitem" @click="runAndClose(item.id)">{{ t(item.labelKey) }}</button>
        <hr />
        <button type="button" role="menuitemcheckbox" :aria-checked="isGraphView" @click="runAndClose('mindmap.toggleGraphView')">{{ isGraphView ? '✓ ' : '' }}{{ t('mindmap.graphViewBadge') }}</button>
        <button type="button" role="menuitemcheckbox" :aria-checked="isReadOnly" @click="runAndClose('mindmap.toggleReadOnly')">{{ isReadOnly ? '✓ ' : '' }}{{ t('mindmap.readOnlyBadge') }}</button>
      </div>
    </div>
  </div>
</template>
```

Keep the existing `<style scoped>` block unchanged.

- [ ] **Step 6: Strings**

In `app/src/i18n/en.ts` (`mindmap`), replace `viewMap`, `viewSource`, `viewOutline` with:

```ts
    lensLabel: 'Lens',
    lensData: 'Data',
    lensMap: 'Map',
    lensDoc: 'Doc',
```

Change `sourceInvalid` to `'Fix the JSON before leaving the Data editor'`.

- [ ] **Step 7: Show the view buttons on map tabs**

In `app/src/components/Toolbar.vue`:

1. Next to `isMarkdown` (line 113) add the following, reusing an existing `isMindmap` computed if Step 1's grep finds one:

```ts
const isMindmap = computed(() => tabs.activeTab?.language === 'mindmap');
const hasViewButtons = computed(() => isMarkdown.value || isMindmap.value);
```

2. Change `<div class="toolbar__group" v-if="isMarkdown">` (the view group, ~line 1000) to `v-if="hasViewButtons"`.
3. On the live-preview `<>` button (the one calling `settings.toggleLivePreview()`), add `:disabled="isMindmap"`.
4. Change the fit-width button's `v-if` to `v-if="isMarkdown && (settings.viewMode === 'split' || settings.viewMode === 'preview' || settings.viewMode === 'reading')"`.
5. Change the divider after the group (`<span v-if="isMarkdown" class="toolbar__divider">`, ~line 1068) to `v-if="hasViewButtons"`.

- [ ] **Step 8: Delete the Phase 7 view-mode module**

```bash
git rm app/src/lib/mindmap-view-mode.ts app/src/lib/mindmap-view-mode.test.ts
```

- [ ] **Step 9: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 10: Browser verification**

Start `solomd-web` and open the sample `.mmap`. Check each item:

1. The global view buttons show on the map tab. `<>` is disabled.
2. Map lens shows: Edit = outline text with the note, Split = map ‖ outline preview, Live edit = map, Preview = outline preview. Editing the map in Split updates the outline live.
3. Data lens:
   - Edit = JSON editor.
   - Split = JSON editor on the inline-start side ‖ map. Typing valid JSON redraws the map. Breaking the JSON shows the error, keeps the last map and locks it. Fixing the JSON unlocks the map.
   - A map edit in Split updates the JSON pane.
4. Doc lens: Split = outline text ‖ outline preview, both read-only. Live edit = outline preview.
5. Guard: in Data · Edit with invalid JSON, pressing Preview stays in Edit with the error toast. Switching to Doc lens also stays. With a Markdown tab active, view buttons work normally.
6. Hebrew topic lines align right in outline text and preview.
7. Reload: the lens persists. A session saved under Phase 7 with `mindmapMode: 'source'` opens in the Data lens.

- [ ] **Step 11: Commit**

```bash
git add -A app/src/components/MindmapView.vue app/src/components/MindmapToolbar.vue app/src/components/Toolbar.vue app/src/i18n/en.ts app/src/lib
git commit -m "feat(mindmap): Data · Map · Doc lens drives the global view buttons"
```

---

### Task 5: Reading cells — wide map and outline reading

**Files:**
- Create: `app/src/components/MindmapReading.vue`
- Modify: `app/src/composables/useMindmapDisplay.ts`, `app/src/components/MindmapView.vue`, `app/src/components/ReadingView.vue`

**Interfaces:**
- Consumes: `lensCell`, `resolveTabLens`, `cellHas`, `outlineMarkdownOf`, `MindmapCanvas` `locked` prop.
- Produces:
  - `interface MapDisplayApplier { apply(mind: MindElixirInstance, override: MapDisplay, defaults: MapDisplay): void }`
  - `createMapDisplayApplier(): MapDisplayApplier`
  - `<MindmapReading :tab="Tab" />`

- [ ] **Step 1: Extract the display applier**

Append to `app/src/composables/useMindmapDisplay.ts`. Extend the existing `mindmap-display` import with `resolveMapDisplay` and `type MapDisplay`.

```ts
export interface MapDisplayApplier {
  apply(mind: MindElixirInstance, override: MapDisplay, defaults: MapDisplay): void;
}

export function createMapDisplayApplier(): MapDisplayApplier {
  let owner: MindElixirInstance | null = null;
  let generators: BranchGenerators | null = null;
  return {
    apply(mind, override, defaults) {
      if (owner !== mind || !generators) {
        generators = captureBranchGenerators(mind);
        owner = mind;
      }
      const hasExplicitFont = override.font !== undefined || defaults.font !== undefined;
      applyMapDisplay(mind, resolveMapDisplay(override, defaults), generators, hasExplicitFont);
    },
  };
}
```

- [ ] **Step 2: Use it in `MindmapView.vue`**

Remove `branchGenerators`, `generatorsOwner` and the old `applyDisplay` body. Change the composable import to `import { createMapDisplayApplier } from '../composables/useMindmapDisplay';` and drop the `resolveMapDisplay` import. Then:

```ts
const displayApplier = createMapDisplayApplier();

function applyDisplay(): void {
  const mind = canvas.value?.getMind();
  if (mind) displayApplier.apply(mind, displayOverride.value, settings.mindmapDefaults);
}
```

- [ ] **Step 3: Create `MindmapReading.vue`**

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Tab, ViewMode } from '../types';
import { useSettingsStore } from '../stores/settings';
import { mmapCodec } from '../lib/mindmap-format';
import { cellHas, lensCell, resolveTabLens } from '../lib/mindmap-lens';
import { outlineMarkdownOf } from '../lib/mindmap-outline';
import type { MindmapCanvasApi } from '../lib/mindmap-active';
import { createMapDisplayApplier } from '../composables/useMindmapDisplay';
import MindmapCanvas from './MindmapCanvas.vue';
import Preview from './Preview.vue';

const READING_VIEW: ViewMode = 'reading';
const props = defineProps<{ tab: Tab }>();
const settings = useSettingsStore();
const codec = computed(() => mmapCodec(props.tab.fileName));
const isWideMap = computed(() => cellHas(lensCell(resolveTabLens(props.tab), READING_VIEW), 'wideMap'));
const outlineMarkdown = computed(() => (isWideMap.value ? '' : outlineMarkdownOf(codec.value.parse(props.tab.content))));
const canvas = ref<MindmapCanvasApi | null>(null);
const displayApplier = createMapDisplayApplier();

function applyDisplay(): void {
  const mind = canvas.value?.getMind();
  if (mind) displayApplier.apply(mind, canvas.value?.getDisplayOverride() ?? {}, settings.mindmapDefaults);
}

watch(() => settings.mindmapDefaults, applyDisplay, { deep: true });
</script>

<template>
  <MindmapCanvas
    v-if="isWideMap"
    ref="canvas"
    class="mindmap-reading__map"
    :content="tab.content"
    :codec="codec"
    :locked="true"
    :register-active="false"
    @ready="applyDisplay"
  />
  <Preview v-else :source="outlineMarkdown" skin="reading" class="mindmap-reading__outline" />
</template>

<style scoped>
.mindmap-reading__outline :deep(:is(h1, h2, h3, h4, h5, h6, li, p)) { unicode-bidi: plaintext; text-align: start; }
</style>
```

`:locked="true"` keeps reading read-only. With no `@update:content` listener, a collapse in reading never writes the file.

- [ ] **Step 4: Delegate from `ReadingView.vue`**

Import the component lazily so `mind-elixir` stays out of the main chunk:

```ts
import { computed, defineAsyncComponent, ref, onMounted, onBeforeUnmount } from 'vue';
const MindmapReading = defineAsyncComponent(() => import('./MindmapReading.vue'));
const MINDMAP_LANGUAGE = 'mindmap';
const isMindmap = computed(() => tab.value?.language === MINDMAP_LANGUAGE);
```

Replace the doc block:

```vue
    <div v-if="tab" class="reading-view__doc" :class="{ 'reading-view__doc--map': isMindmap }">
      <MindmapReading v-if="isMindmap" :tab="tab" />
      <Preview
        v-else
        :source="tab.content"
        :file-path="tab.filePath"
        :tab-id="tab.id"
        skin="reading"
      />
    </div>
```

Add the following style. It sits after `.reading-view__doc > :deep(.preview-host)`:

```css
.reading-view__doc--map > :deep(.mindmap-view) {
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 5: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 6: Browser verification**

1. In the Map lens, press Reading. The full-window map is shown, with no map toolbar or panel, and global display defaults applied. Dragging or editing a topic does nothing. The file is not marked dirty.
2. Press Escape. The previous view returns with the map tab.
3. In the Doc lens, Reading shows the outline in the reading skin, with Hebrew lines right-aligned.
4. In Data · Edit with invalid JSON, pressing Reading is blocked with the toast.

- [ ] **Step 7: Commit**

```bash
git add app/src/composables/useMindmapDisplay.ts app/src/components/MindmapView.vue app/src/components/MindmapReading.vue app/src/components/ReadingView.vue
git commit -m "feat(mindmap): reading cells — wide map and outline reading"
```

---

### Task 6: Map theme presets and the `theme` display key

**Files:**
- Create: `app/src/lib/mindmap-themes.ts`
- Test: `app/src/lib/mindmap-themes.test.ts`
- Modify: `app/src/lib/mindmap-display.ts`, `app/src/lib/mindmap-display.test.ts`

**Interfaces:**
- Produces:
  - `type MapThemeId = 'default' | 'ocean' | 'forest' | 'mono' | 'highContrast'`
  - `type ThemeFamily = 'light' | 'dark'`
  - `type MapThemeVarName = '--bgcolor' | '--root-bgcolor' | '--root-color' | '--main-bgcolor' | '--main-color' | '--color' | '--selected'`
  - `interface MapThemeVariant { palette: readonly string[]; cssVar: Readonly<Record<MapThemeVarName, string>> }`
  - `interface MapThemePreset { id: MapThemeId; labelKey: string; light: MapThemeVariant; dark: MapThemeVariant }`
  - `MAP_THEMES: readonly MapThemePreset[]`, `MAP_THEME_IDS`, `DEFAULT_MAP_THEME`, `PALETTE_SIZE` (8), `AA_TEXT_CONTRAST` (4.5)
  - `isMapThemeId(value: unknown): value is MapThemeId`
  - `mapThemeVariant(id: MapThemeId, family: ThemeFamily): { name: string; type: ThemeFamily; palette: string[]; cssVar: Record<MapThemeVarName, string> }`
  - `contrastRatio(a: string, b: string): number` (inputs `#rrggbb`)
  - `MapDisplay.theme?: MapThemeId`; `ResolvedMapDisplay.theme: MapThemeId`

- [ ] **Step 1: Write the failing test**

`app/src/lib/mindmap-themes.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AA_TEXT_CONTRAST, MAP_THEMES, MAP_THEME_IDS, PALETTE_SIZE, contrastRatio, isMapThemeId, mapThemeVariant, type ThemeFamily } from './mindmap-themes.ts';

const HEX6 = /^#[0-9a-f]{6}$/i;
const FAMILIES: readonly ThemeFamily[] = ['light', 'dark'];
const TEXT_PAIRS: ReadonlyArray<[string, string]> = [['--color', '--bgcolor'], ['--main-color', '--main-bgcolor'], ['--root-color', '--root-bgcolor']];

test('there are five presets in a fixed order', () => {
  assert.deepEqual(MAP_THEME_IDS, ['default', 'ocean', 'forest', 'mono', 'highContrast']);
  assert.deepEqual(MAP_THEMES.map((p) => p.id), MAP_THEME_IDS);
});

test('every variant has an 8-color palette and 7 hex css vars', () => {
  for (const preset of MAP_THEMES) {
    for (const family of FAMILIES) {
      const v = preset[family];
      assert.equal(v.palette.length, PALETTE_SIZE, `${preset.id}/${family}`);
      for (const color of v.palette) assert.match(color, HEX6);
      assert.equal(Object.keys(v.cssVar).length, 7);
      for (const color of Object.values(v.cssVar)) assert.match(color, HEX6);
    }
  }
});

test('mapThemeVariant returns a typed copy', () => {
  const theme = mapThemeVariant('ocean', 'dark');
  assert.equal(theme.type, 'dark');
  assert.equal(theme.name, 'solomd-ocean-dark');
  theme.palette[0] = '#000000';
  assert.notEqual(mapThemeVariant('ocean', 'dark').palette[0], '#000000');
});

test('contrastRatio matches WCAG reference values', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
  assert.equal(contrastRatio('#777777', '#777777'), 1);
});

test('high contrast meets AA for all text in both variants', () => {
  for (const family of FAMILIES) {
    const vars = mapThemeVariant('highContrast', family).cssVar as Record<string, string>;
    for (const [fg, bg] of TEXT_PAIRS) {
      assert.ok(contrastRatio(vars[fg], vars[bg]) >= AA_TEXT_CONTRAST, `${family} ${fg}/${bg}`);
    }
  }
});

test('isMapThemeId rejects unknown and prototype keys', () => {
  assert.equal(isMapThemeId('forest'), true);
  assert.equal(isMapThemeId('neon'), false);
  assert.equal(isMapThemeId('toString'), false);
});
```

Append to `app/src/lib/mindmap-display.test.ts`:

```ts
test('parseMapDisplay keeps a known theme and drops an unknown one', () => {
  assert.deepEqual(parseMapDisplay({ theme: 'forest' }), { theme: 'forest' });
  assert.deepEqual(parseMapDisplay({ theme: 'neon' }), {});
});

test('resolveMapDisplay resolves theme override → default → preset default', () => {
  assert.equal(resolveMapDisplay({ theme: 'mono' }, { theme: 'ocean' }).theme, 'mono');
  assert.equal(resolveMapDisplay({}, { theme: 'ocean' }).theme, 'ocean');
  assert.equal(resolveMapDisplay({}, {}).theme, 'default');
});
```

Make sure `parseMapDisplay` and `resolveMapDisplay` are in that file's import line.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-themes.test.ts src/lib/mindmap-display.test.ts`
Expected: FAIL — themes module not found; display theme assertions fail.

- [ ] **Step 3: Write `mindmap-themes.ts`**

```ts
export type MapThemeId = 'default' | 'ocean' | 'forest' | 'mono' | 'highContrast';
export type ThemeFamily = 'light' | 'dark';
export type MapThemeVarName = '--bgcolor' | '--root-bgcolor' | '--root-color' | '--main-bgcolor' | '--main-color' | '--color' | '--selected';

export interface MapThemeVariant { readonly palette: readonly string[]; readonly cssVar: Readonly<Record<MapThemeVarName, string>> }
export interface MapThemePreset { readonly id: MapThemeId; readonly labelKey: string; readonly light: MapThemeVariant; readonly dark: MapThemeVariant }
export interface MapThemeInput { name: string; type: ThemeFamily; palette: string[]; cssVar: Record<MapThemeVarName, string> }

export const PALETTE_SIZE = 8;
export const AA_TEXT_CONTRAST = 4.5;
export const DEFAULT_MAP_THEME: MapThemeId = 'default';
const THEME_NAME_PREFIX = 'solomd';

const WCAG = { linearThreshold: 0.03928, linearDivisor: 12.92, offset: 0.055, scale: 1.055, gamma: 2.4, flare: 0.05, red: 0.2126, green: 0.7152, blue: 0.0722, channelMax: 255 } as const;
const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX_RADIX = 16;
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
const BYTE = 0xff;

export const MAP_THEMES: readonly MapThemePreset[] = [
  {
    id: 'default',
    labelKey: 'mindmap.themeDefault',
    light: {
      palette: ['#dd7878', '#ea76cb', '#8839ef', '#e64553', '#fe640b', '#df8e1d', '#40a02b', '#209fb5'],
      cssVar: { '--bgcolor': '#f6f6f6', '--root-bgcolor': '#4c4f69', '--root-color': '#ffffff', '--main-bgcolor': '#ffffff', '--main-color': '#444446', '--color': '#777777', '--selected': '#4dc4ff' },
    },
    dark: {
      palette: ['#848fa0', '#748be9', '#d2f9fe', '#4145a5', '#789afa', '#706cf4', '#ef987f', '#775dd5'],
      cssVar: { '--bgcolor': '#252526', '--root-bgcolor': '#2d3748', '--root-color': '#ffffff', '--main-bgcolor': '#4c4f69', '--main-color': '#ffffff', '--color': '#cccccc', '--selected': '#4dc4ff' },
    },
  },
  {
    id: 'ocean',
    labelKey: 'mindmap.themeOcean',
    light: {
      palette: ['#0077b6', '#0096c7', '#00b4d8', '#48cae4', '#023e8a', '#0081a7', '#00afb9', '#2a9d8f'],
      cssVar: { '--bgcolor': '#f0f8fc', '--root-bgcolor': '#03045e', '--root-color': '#ffffff', '--main-bgcolor': '#ffffff', '--main-color': '#023e8a', '--color': '#1d4e6b', '--selected': '#00b4d8' },
    },
    dark: {
      palette: ['#48cae4', '#90e0ef', '#00b4d8', '#ade8f4', '#4cc9f0', '#56cfe1', '#72efdd', '#64dfdf'],
      cssVar: { '--bgcolor': '#0b1d2a', '--root-bgcolor': '#0077b6', '--root-color': '#ffffff', '--main-bgcolor': '#12324a', '--main-color': '#e0f4ff', '--color': '#a9d6ec', '--selected': '#72efdd' },
    },
  },
  {
    id: 'forest',
    labelKey: 'mindmap.themeForest',
    light: {
      palette: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#606c38', '#bc6c25', '#dda15e', '#588157'],
      cssVar: { '--bgcolor': '#f4f8f1', '--root-bgcolor': '#1b4332', '--root-color': '#ffffff', '--main-bgcolor': '#ffffff', '--main-color': '#1b4332', '--color': '#3a5a40', '--selected': '#52b788' },
    },
    dark: {
      palette: ['#74c69d', '#95d5b2', '#b7e4c7', '#52b788', '#a3b18a', '#dda15e', '#e9c46a', '#90be6d'],
      cssVar: { '--bgcolor': '#13201a', '--root-bgcolor': '#2d6a4f', '--root-color': '#ffffff', '--main-bgcolor': '#1f3a2d', '--main-color': '#e8f5ec', '--color': '#b7d8c4', '--selected': '#95d5b2' },
    },
  },
  {
    id: 'mono',
    labelKey: 'mindmap.themeMono',
    light: {
      palette: ['#222222', '#444444', '#666666', '#888888', '#333333', '#555555', '#777777', '#999999'],
      cssVar: { '--bgcolor': '#fafafa', '--root-bgcolor': '#222222', '--root-color': '#ffffff', '--main-bgcolor': '#ffffff', '--main-color': '#222222', '--color': '#444444', '--selected': '#888888' },
    },
    dark: {
      palette: ['#eeeeee', '#cccccc', '#aaaaaa', '#888888', '#dddddd', '#bbbbbb', '#999999', '#777777'],
      cssVar: { '--bgcolor': '#1a1a1a', '--root-bgcolor': '#eeeeee', '--root-color': '#111111', '--main-bgcolor': '#2a2a2a', '--main-color': '#eeeeee', '--color': '#cccccc', '--selected': '#aaaaaa' },
    },
  },
  {
    id: 'highContrast',
    labelKey: 'mindmap.themeHighContrast',
    light: {
      palette: ['#000000', '#0000cc', '#b30000', '#006600', '#7a00a3', '#8a4b00', '#005f73', '#3d3d3d'],
      cssVar: { '--bgcolor': '#ffffff', '--root-bgcolor': '#000000', '--root-color': '#ffffff', '--main-bgcolor': '#ffffff', '--main-color': '#000000', '--color': '#000000', '--selected': '#0050ff' },
    },
    dark: {
      palette: ['#ffffff', '#ffd400', '#00e5ff', '#7dff7d', '#ff8cff', '#ffa64d', '#8cb4ff', '#ff6b6b'],
      cssVar: { '--bgcolor': '#000000', '--root-bgcolor': '#ffffff', '--root-color': '#000000', '--main-bgcolor': '#000000', '--main-color': '#ffffff', '--color': '#ffffff', '--selected': '#ffd400' },
    },
  },
];

export const MAP_THEME_IDS: readonly MapThemeId[] = MAP_THEMES.map((preset) => preset.id);

export function isMapThemeId(value: unknown): value is MapThemeId {
  return typeof value === 'string' && MAP_THEME_IDS.includes(value as MapThemeId);
}

function presetFor(id: MapThemeId): MapThemePreset {
  return MAP_THEMES.find((preset) => preset.id === id) ?? MAP_THEMES[0];
}

export function mapThemeVariant(id: MapThemeId, family: ThemeFamily): MapThemeInput {
  const variant = presetFor(id)[family];
  return { name: `${THEME_NAME_PREFIX}-${id}-${family}`, type: family, palette: [...variant.palette], cssVar: { ...variant.cssVar } };
}

function linearChannel(byte: number): number {
  const c = byte / WCAG.channelMax;
  return c <= WCAG.linearThreshold ? c / WCAG.linearDivisor : ((c + WCAG.offset) / WCAG.scale) ** WCAG.gamma;
}

function relativeLuminance(hex: string): number {
  const match = HEX6.exec(hex);
  if (!match) throw new Error(`Expected #rrggbb, got ${hex}`);
  const n = Number.parseInt(match[1], HEX_RADIX);
  const r = linearChannel((n >> RED_SHIFT) & BYTE);
  const g = linearChannel((n >> GREEN_SHIFT) & BYTE);
  const b = linearChannel(n & BYTE);
  return WCAG.red * r + WCAG.green * g + WCAG.blue * b;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + WCAG.flare) / (dark + WCAG.flare);
}
```

- [ ] **Step 4: Add `theme` to the display model**

In `app/src/lib/mindmap-display.ts`:

```ts
import { DEFAULT_MAP_THEME, isMapThemeId, type MapThemeId } from './mindmap-themes.ts';

export interface MapDisplay { compact?: boolean; branchStyle?: BranchStyle; textColor?: string; font?: MapFont; theme?: MapThemeId }
export type ResolvedMapDisplay = { compact: boolean; branchStyle: BranchStyle; textColor: string | null; font: MapFont; theme: MapThemeId };

export const DEFAULT_MAP_DISPLAY: ResolvedMapDisplay = { compact: false, branchStyle: 'curve', textColor: null, font: 'system', theme: DEFAULT_MAP_THEME };
```

In `parseMapDisplay`, before `return out;`:

```ts
  if (isMapThemeId(value.theme)) out.theme = value.theme;
```

In `resolveMapDisplay`, add:

```ts
    theme: override.theme ?? defaults.theme ?? DEFAULT_MAP_DISPLAY.theme,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-themes.test.ts src/lib/mindmap-display.test.ts src/lib/mindmap-format.test.ts`
Expected: PASS. If an older `mindmap-display.test.ts` assertion `deepEqual`s a resolved display, add `theme: 'default'` to its expected object.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/mindmap-themes.ts app/src/lib/mindmap-themes.test.ts app/src/lib/mindmap-display.ts app/src/lib/mindmap-display.test.ts
git commit -m "feat(mindmap): five map theme presets with light/dark variants"
```

---

### Task 7: Apply themes; theme picker in the panel and Settings

**Files:**
- Modify: `app/src/composables/useMindmapDisplay.ts`, `app/src/components/MindmapView.vue`, `app/src/components/MindmapReading.vue`, `app/src/components/MindmapMapFields.vue`, `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: `mapThemeVariant`, `MAP_THEMES`, `ThemeFamily` (Task 6); `themeFamily(theme: Theme): 'light' | 'dark'` (`app/src/lib/themes.ts:124`).
- Produces:
  - `applyMapDisplay(mind, display, original, hasExplicitFont, family: ThemeFamily)`
  - `MapDisplayApplier.apply(mind, override, defaults, family: ThemeFamily)`

- [ ] **Step 1: Theme first in the apply order**

In `app/src/composables/useMindmapDisplay.ts`:

```ts
import { mapThemeVariant, type ThemeFamily } from '../lib/mindmap-themes';
```

Replace `applyText` and `applyMapDisplay`:

```ts
function applyText(mind: MindElixirInstance, display: ResolvedMapDisplay, hasExplicitFont: boolean): void {
  const style = mind.container.style;
  if (display.textColor) {
    for (const name of TEXT_COLOR_VARS) style.setProperty(name, display.textColor);
  }
  if (hasExplicitFont) style.fontFamily = FONT_STACKS[display.font];
  else style.removeProperty('font-family');
}

export function applyMapDisplay(mind: MindElixirInstance, display: ResolvedMapDisplay, original: BranchGenerators, hasExplicitFont: boolean, family: ThemeFamily): void {
  mind.changeTheme(mapThemeVariant(display.theme, family), false);
  if (mind.compact !== display.compact) mind.changeCompact(display.compact);
  applyBranchStyle(mind, display, original);
  applyText(mind, display, hasExplicitFont);
  mind.linkDiv();
}
```

`changeTheme` resets `generateMainBranch`/`generateSubBranch` to the package defaults and rewrites every theme CSS var. Branch style and text color must therefore run after it. A cleared text color needs no removal: `changeTheme` already restored the preset value.

Update `createMapDisplayApplier`: the `apply` signature gains `family: ThemeFamily` and passes it as the last argument to `applyMapDisplay`. Update the `MapDisplayApplier` interface the same way.

If `vue-tsc` rejects `mapThemeVariant(...)` as a `Theme`, check `ThemeCssVar` in `node_modules/mind-elixir/dist/types/types/index.d.ts` for each of the 7 var names. Only names present there may stay in `MapThemeVarName`.

- [ ] **Step 2: Pass the family from both callers**

`MindmapView.vue` and `MindmapReading.vue`: add `import { themeFamily } from '../lib/themes';` and pass `themeFamily(settings.theme)` as the 4th argument of `displayApplier.apply(...)`.

The canvas already calls `changeTheme` and emits `ready` when `settings.theme` changes (`MindmapCanvas.vue` watcher). Both callers re-apply on `ready`, so the preset follows the app theme family.

- [ ] **Step 3: Theme picker in `MindmapMapFields.vue`**

Script additions:

```ts
import { MAP_THEMES, type MapThemeId } from '../lib/mindmap-themes';
import { themeFamily } from '../lib/themes';
import { useSettingsStore } from '../stores/settings';
import { computed } from 'vue';

const settings = useSettingsStore();
const family = computed(() => themeFamily(settings.theme));
const currentTheme = computed<MapThemeId>(() => props.value.theme ?? props.inherited?.theme ?? 'default');
```

Template: insert as the first child of the `<fieldset>`:

```vue
    <div class="mm-fields__group">
      <span id="mm-theme-label">{{ t('mindmap.fieldTheme') }}</span>
      <div class="mm-fields__themes" role="radiogroup" aria-labelledby="mm-theme-label">
        <button
          v-for="preset in MAP_THEMES"
          :key="preset.id"
          type="button"
          role="radio"
          class="mm-fields__theme"
          :aria-checked="currentTheme === preset.id"
          @click="emit('set', { theme: preset.id })"
        >
          <span class="mm-fields__theme-name">{{ t(preset.labelKey) }}</span>
          <span class="mm-fields__swatches" aria-hidden="true">
            <span v-for="color in preset[family].palette" :key="color" class="mm-fields__swatch" :style="{ background: color }" />
          </span>
        </button>
      </div>
      <button v-if="isSet('theme')" type="button" @click="emit('clear', 'theme')">{{ resetLabel() }}</button>
    </div>
```

Styles:

```css
.mm-fields__group { display: flex; flex-direction: column; gap: 4px; }
.mm-fields__themes { display: flex; flex-direction: column; gap: 4px; }
.mm-fields__theme { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text); cursor: pointer; font: inherit; }
.mm-fields__theme[aria-checked='true'] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.mm-fields__swatches { display: flex; gap: 2px; }
.mm-fields__swatch { width: 10px; height: 10px; border-radius: 2px; }
```

The swatch `:key` uses the color. Every preset palette has 8 distinct colors (Task 6 data), so keys stay unique.

- [ ] **Step 4: Strings**

`app/src/i18n/en.ts` (`mindmap`):

```ts
    fieldTheme: 'Theme',
    themeDefault: 'Default',
    themeOcean: 'Ocean',
    themeForest: 'Forest',
    themeMono: 'Mono',
    themeHighContrast: 'High contrast',
```

- [ ] **Step 5: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 6: Browser verification**

1. In the Map tab panel, pick each of the 5 presets. The background, root, main topics, branch colors and selection outline change. Save, reload: the per-file theme persists (the `display.theme` key is in the file).
2. Switch the app theme between a light and a dark theme. Each preset swaps its variant.
3. With the straight branch style plus a text color set, change the preset. Branches stay straight and the text color still overrides.
4. Clear the text color. The preset's own text colors return.
5. Inspect High contrast in light and dark. Topic text is black on white / white on black.
6. Settings → Mindmap defaults → set Forest. A map with no per-file theme picks it up.

- [ ] **Step 7: Commit**

```bash
git add app/src/composables/useMindmapDisplay.ts app/src/components/MindmapView.vue app/src/components/MindmapReading.vue app/src/components/MindmapMapFields.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): apply map themes; theme picker with swatches"
```

---

### Task 8: Settings → 🧠 Mindmap category

**Files:**
- Modify: `app/src/components/SettingsPanel.vue`, `app/src/i18n/en.ts`

- [ ] **Step 1: Add the category**

In `app/src/components/SettingsPanel.vue`:

1. Line 84: `type SettingsCategory = 'basics' | 'writing' | 'mindmap' | 'sync' | 'integrations' | 'export' | 'keys' | 'advanced';`
2. `categories` (line ~208): insert after `writing`:

```ts
  { id: 'mindmap', icon: '🧠', labelKey: 'settings.catMindmap' },
```

3. `VALID_CATEGORIES` (line ~262): add `'mindmap'`.
4. The section at ~line 1242 (`<h4>{{ t('mindmap.settingsDefaults') }}</h4>`): change `data-cat="writing"` to `data-cat="mindmap"`.
5. CSS show-list (~line 2321): add `.settings__body[data-active-cat="mindmap"] > [data-cat="mindmap"],` to the selector group.
6. Run `grep -n '"writing"' app/src/components/SettingsPanel.vue`. Any other per-category list (CSS `order`, icons, counts) gets a matching `mindmap` entry.

- [ ] **Step 2: Strings**

`app/src/i18n/en.ts` → `settings`: add `catMindmap: 'Mindmap',` after `catWriting`.

Search keywords need no extra markup. The section renders "Mindmap defaults", "Theme", "Compact", "Branch style" and "Font". These cover the spec's keywords "mindmap", "map", "theme", "branch" and "compact", and English keywords also match in translated UIs (`lib/settings-search.ts`).

- [ ] **Step 3: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 4: Browser verification**

1. Settings shows 🧠 Mindmap after Writing. It holds the defaults section, including the theme picker. Writing no longer shows the section.
2. Search for each of `mindmap`, `map`, `theme`, `branch` and `compact`. The Mindmap section is listed under its category heading.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/SettingsPanel.vue app/src/i18n/en.ts
git commit -m "feat(settings): Mindmap category holds map defaults"
```

---

### Task 9: Toolbar icons — export split button, Graph and Read-only toggles

**Files:**
- Modify: `app/src/components/MindmapToolbar.vue`, `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: the Task 4 toolbar props and emits (unchanged).

- [ ] **Step 1: Replace `MindmapToolbar.vue`**

```vue
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from '../i18n';
import { MINDMAP_LENSES, type MindmapLens } from '../lib/mindmap-lens';

type MenuId = 'export' | 'more';

const props = defineProps<{ lens: MindmapLens; hasMap: boolean; isPanelOpen: boolean; isReadOnly: boolean; isGraphView: boolean }>();
const emit = defineEmits<{ 'set-lens': [lens: MindmapLens]; run: [actionId: string]; 'toggle-panel': [] }>();
const { t } = useI18n();
const openMenu = ref<MenuId | null>(null);

const MENU_HOST_SELECTOR = '.mm-toolbar__menu-host';
const PRIMARY_EXPORT = 'mindmap.exportPng';
const LENS_LABEL_KEYS: Record<MindmapLens, string> = { data: 'mindmap.lensData', map: 'mindmap.lensMap', doc: 'mindmap.lensDoc' };
const EXPORT_ITEMS: readonly { id: string; label: string }[] = [
  { id: 'mindmap.exportPng', label: 'PNG' },
  { id: 'mindmap.exportSvg', label: 'SVG' },
  { id: 'mindmap.exportHtml', label: 'HTML' },
  { id: 'mindmap.exportJson', label: 'JSON' },
  { id: 'mindmap.exportMarkdown', label: 'Markdown' },
  { id: 'mindmap.exportMermaid', label: 'Mermaid' },
  { id: 'mindmap.exportAdjacency', label: 'Adjacency JSON' },
];
const MORE_ITEMS: readonly { id: string; labelKey: string }[] = [
  { id: 'mindmap.copyPlaintext', labelKey: 'mindmap.menuCopyPlaintext' },
  { id: 'mindmap.toHeadingsDocument', labelKey: 'mindmap.menuHeadings' },
  { id: 'mindmap.findDuplicates', labelKey: 'mindmap.menuDuplicates' },
  { id: 'mindmap.shortcutHelp', labelKey: 'mindmap.menuShortcuts' },
];

function closeOnOutsidePointer(event: PointerEvent): void {
  if (!(event.target as Element | null)?.closest(MENU_HOST_SELECTOR)) openMenu.value = null;
}

watch(openMenu, (menu) => {
  if (menu) document.addEventListener('pointerdown', closeOnOutsidePointer);
  else document.removeEventListener('pointerdown', closeOnOutsidePointer);
});
watch(() => [props.lens, props.hasMap], () => { openMenu.value = null; });
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutsidePointer));

function toggleMenu(menu: MenuId): void {
  openMenu.value = openMenu.value === menu ? null : menu;
}

function runAndClose(actionId: string): void {
  openMenu.value = null;
  emit('run', actionId);
}
</script>

<template>
  <div class="mm-toolbar" role="toolbar">
    <div class="mm-toolbar__modes" role="tablist" :aria-label="t('mindmap.lensLabel')">
      <button v-for="l in MINDMAP_LENSES" :key="l" type="button" role="tab" :aria-selected="lens === l" :class="{ active: lens === l }" @click="emit('set-lens', l)">
        {{ t(LENS_LABEL_KEYS[l]) }}
      </button>
    </div>
    <button type="button" :title="t('mindmap.toolbarUndo')" :aria-label="t('mindmap.toolbarUndo')" :disabled="!hasMap || isReadOnly || isGraphView" @click="emit('run', 'mindmap.undo')">↶</button>
    <button type="button" :title="t('mindmap.toolbarRedo')" :aria-label="t('mindmap.toolbarRedo')" :disabled="!hasMap || isReadOnly || isGraphView" @click="emit('run', 'mindmap.redo')">↷</button>
    <span class="mm-toolbar__sep" aria-hidden="true" />
    <div class="mm-toolbar__split mm-toolbar__menu-host">
      <button type="button" :title="t('mindmap.toolbarExportPng')" :aria-label="t('mindmap.toolbarExportPng')" :disabled="!hasMap" @click="emit('run', PRIMARY_EXPORT)">⬇</button>
      <button type="button" class="mm-toolbar__caret" :title="t('mindmap.toolbarExportFormats')" :aria-label="t('mindmap.toolbarExportFormats')" aria-haspopup="menu" :aria-expanded="openMenu === 'export'" :disabled="!hasMap" @click="toggleMenu('export')">▾</button>
      <div v-if="openMenu === 'export'" class="mm-toolbar__menu" role="menu" @keydown.escape="openMenu = null">
        <button v-for="item in EXPORT_ITEMS" :key="item.id" type="button" role="menuitem" @click="runAndClose(item.id)">{{ item.label }}</button>
      </div>
    </div>
    <button type="button" :title="t('mindmap.toolbarGraph')" :aria-label="t('mindmap.toolbarGraph')" :aria-pressed="isGraphView" :disabled="!hasMap" @click="emit('run', 'mindmap.toggleGraphView')">⇄</button>
    <button type="button" :title="t('mindmap.toolbarReadOnly')" :aria-label="t('mindmap.toolbarReadOnly')" :aria-pressed="isReadOnly" :disabled="!hasMap" @click="emit('run', 'mindmap.toggleReadOnly')">🔒</button>
    <button type="button" :title="t('mindmap.toolbarPanel')" :aria-label="t('mindmap.toolbarPanel')" :aria-pressed="isPanelOpen" :disabled="!hasMap" @click="emit('toggle-panel')">▤</button>
    <div class="mm-toolbar__more mm-toolbar__menu-host">
      <button type="button" :title="t('mindmap.toolbarMore')" :aria-label="t('mindmap.toolbarMore')" aria-haspopup="menu" :aria-expanded="openMenu === 'more'" :disabled="!hasMap" @click="toggleMenu('more')">⋯</button>
      <div v-if="openMenu === 'more'" class="mm-toolbar__menu" role="menu" @keydown.escape="openMenu = null">
        <button v-for="item in MORE_ITEMS" :key="item.id" type="button" role="menuitem" @click="runAndClose(item.id)">{{ t(item.labelKey) }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mm-toolbar { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-block-end: 1px solid var(--border); background: var(--bg-elev); color: var(--text); font-size: 12px; }
.mm-toolbar button { padding: 2px 8px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
.mm-toolbar button:disabled { opacity: 0.4; cursor: default; }
.mm-toolbar button.active, .mm-toolbar button[aria-pressed='true'] { border-color: var(--border); background: var(--bg); }
.mm-toolbar__modes { display: flex; gap: 2px; margin-inline-end: 8px; }
.mm-toolbar__sep { width: 1px; align-self: stretch; margin-inline: 4px; background: var(--border); }
.mm-toolbar__split { position: relative; display: flex; }
.mm-toolbar__split > button:first-child { border-start-end-radius: 0; border-end-end-radius: 0; }
.mm-toolbar__caret { padding-inline: 4px !important; border-start-start-radius: 0 !important; border-end-start-radius: 0 !important; }
.mm-toolbar__more { position: relative; margin-inline-start: auto; }
.mm-toolbar__menu { position: absolute; inset-inline-end: 0; inset-block-start: 100%; z-index: 20; display: flex; flex-direction: column; min-width: 200px; padding: 4px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 4px 16px rgb(0 0 0 / 20%); }
.mm-toolbar__split .mm-toolbar__menu { inset-inline-end: auto; inset-inline-start: 0; }
.mm-toolbar__menu button { text-align: start; }
</style>
```

- [ ] **Step 2: Strings**

`app/src/i18n/en.ts` (`mindmap`):

```ts
    toolbarExportPng: 'Export PNG',
    toolbarExportFormats: 'Export as…',
    toolbarGraph: 'Graph view',
    toolbarReadOnly: 'Read-only',
```

`menuExport` is no longer used by the toolbar. Delete it if `grep -rn "menuExport" app/src` shows no other use.

- [ ] **Step 3: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 4: Browser verification**

1. ⬇ exports a PNG.
2. ▾ lists the 7 formats, and each one exports.
3. ⇄ and 🔒 toggle, with `aria-pressed` reflecting state and the canvas badges appearing.
4. ⋯ holds only Copy as plaintext, Open as Markdown headings, Find duplicates and Keyboard shortcuts.
5. In the Doc lens, every map control is disabled while the lens tabs stay enabled.
6. Each icon button has a tooltip.
7. In an RTL UI or an RTL document, the split button and menus mirror.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/MindmapToolbar.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): export split button and graph/read-only toggle icons"
```

---

### Task 10: Canvas controls — Fit, Root, duplicates chip

**Files:**
- Create: `app/src/composables/useMindmapCanvasControls.ts`
- Modify: `app/src/components/MindmapCanvas.vue`, `app/src/components/MindmapToolbar.vue`, `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: `findDuplicateGroups(root: NodeObj): DuplicateGroup[]` (`mindmap-duplicates.ts:40`), canvas `selectRoot`, `findDuplicates`.
- Produces:
  - `interface CanvasControl { glyph: string; label: string; run: () => void }`
  - `appendCanvasControls(root: HTMLElement, controls: readonly CanvasControl[]): void`

- [ ] **Step 1: Controls helper**

`app/src/composables/useMindmapCanvasControls.ts`:

```ts
const PACKAGE_ZOOM_BAR = '.mind-elixir-toolbar.rb';
const CONTROL_CLASS = 'mm-canvas-control';
const ACTIVATION_KEYS: readonly string[] = ['Enter', ' '];

export interface CanvasControl {
  readonly glyph: string;
  readonly label: string;
  readonly run: () => void;
}

function controlElement(control: CanvasControl): HTMLElement {
  const el = document.createElement('span');
  el.className = CONTROL_CLASS;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', control.label);
  el.tabIndex = 0;
  el.title = control.label;
  el.textContent = control.glyph;
  el.addEventListener('click', control.run);
  el.addEventListener('keydown', (event) => {
    if (!ACTIVATION_KEYS.includes(event.key)) return;
    event.preventDefault();
    control.run();
  });
  return el;
}

export function appendCanvasControls(root: HTMLElement, controls: readonly CanvasControl[]): void {
  const bar = root.querySelector(PACKAGE_ZOOM_BAR);
  if (!bar || bar.querySelector(`.${CONTROL_CLASS}`)) return;
  for (const control of controls) bar.appendChild(controlElement(control));
}
```

The canvas key dispatcher already ignores keys on `[role="button"]` (`INTERACTIVE_SELECTOR`), so Enter and Space on a control do not reach map shortcuts.

- [ ] **Step 2: Wire Fit/Root into the canvas**

In `MindmapCanvas.vue`, import `appendCanvasControls`. In `mount()`, directly after `mind.init(data);`:

```ts
  appendCanvasControls(host.value, [
    { glyph: '⤢', label: t('mindmap.canvasFit'), run: () => mind?.scaleFit() },
    { glyph: '⌂', label: t('mindmap.canvasRoot'), run: selectRoot },
  ]);
```

Add to the scoped styles:

```css
.mindmap-view__canvas :deep(.mm-canvas-control) { display: inline-block; min-width: 1em; font-size: 16px; line-height: 1; text-align: center; cursor: pointer; }
.mindmap-view__canvas :deep(.mm-canvas-control:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 3: Duplicates count**

In `MindmapCanvas.vue`:

```ts
const DUPLICATE_COUNT_DEBOUNCE_MS = 500;
const duplicateCount = ref(0);
let duplicateTimer: number | null = null;

function countDuplicates(): void {
  duplicateTimer = null;
  duplicateCount.value = mind ? findDuplicateGroups(mind.nodeData).length : 0;
}

function scheduleDuplicateCount(): void {
  if (duplicateTimer !== null) window.clearTimeout(duplicateTimer);
  duplicateTimer = window.setTimeout(countDuplicates, DUPLICATE_COUNT_DEBOUNCE_MS);
}
```

Call sites:
- `mount()`: `countDuplicates();` after `gates.syncLabels();`.
- `onOperation()`: `scheduleDuplicateCount();` after `scheduleSync();`.
- `syncAfterHistoryJumps`: append `scheduleDuplicateCount();` inside both wrapped `undo` and `redo`.
- `applyExternalContent()`: `countDuplicates();` after `gates.syncLabels();` in the `if (mind)` branch.
- `mergeDuplicate()`: `countDuplicates();` after `findDuplicates();`.
- `teardown()`: `if (duplicateTimer !== null) window.clearTimeout(duplicateTimer); duplicateTimer = null;`.

- [ ] **Step 4: Status row with the chip**

Replace the two badge `<span>`s in the template with:

```vue
    <div class="mindmap-view__status">
      <button v-if="duplicateCount > 0 && !locked" type="button" class="mindmap-view__chip" @click="findDuplicates">
        {{ t('mindmap.duplicatesChip', { count: duplicateCount }) }}
      </button>
      <span v-if="isGraphView" class="mindmap-view__badge">{{ t('mindmap.graphViewBadge') }}</span>
      <span v-if="isReadOnly" class="mindmap-view__badge">{{ t('mindmap.readOnlyBadge') }}</span>
    </div>
```

Replace the `.mindmap-view__badge` and `.mindmap-view__badge--graph` rules with:

```css
.mindmap-view__status { position: absolute; inset-block-start: 8px; inset-inline-end: 8px; z-index: 5; display: flex; gap: 6px; pointer-events: none; }
.mindmap-view__badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); opacity: 0.9; }
.mindmap-view__chip { pointer-events: auto; padding: 2px 10px; border-radius: 999px; font-size: 12px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--accent); cursor: pointer; }
```

- [ ] **Step 5: Drop Find duplicates from `⋯`**

In `MindmapToolbar.vue`, delete the `{ id: 'mindmap.findDuplicates', … }` line from `MORE_ITEMS`. The command stays in the palette (it is in `KEY_ACTIONS`).

- [ ] **Step 6: Strings**

`app/src/i18n/en.ts` (`mindmap`):

```ts
    canvasFit: 'Fit to window',
    canvasRoot: 'Go to root',
    duplicatesChip: '{count} duplicates',
```

- [ ] **Step 7: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 8: Browser verification**

1. ⤢ and ⌂ appear inside the bottom zoom bar, styled like the package buttons, with tooltips. ⤢ fits the map and ⌂ selects and centers the root. Both work from the keyboard (Tab to the control, Enter).
2. The sample with two identical subtrees shows "1 duplicates" (one group) at the top inline-end. Clicking it opens the dialog. Merging hides the chip. Adding a new identical subtree brings the chip back after about 0.5 s.
3. The chip is hidden in the reading wide map.
4. Badges sit next to the chip without overlap, readable in light and dark.
5. `⋯` no longer lists Find duplicates. The palette still runs it.

- [ ] **Step 9: Commit**

```bash
git add app/src/composables/useMindmapCanvasControls.ts app/src/components/MindmapCanvas.vue app/src/components/MindmapToolbar.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): Fit/Root canvas controls and duplicates chip"
```

---

### Task 11: Read-only paste fix

Spec §6. Bug on `main`: Mind Elixir's container `paste` listener (`MindElixir.js` ~line 1016) calls `instance.copyNodes(...)` without checking `editable`. With a node selected, Cmd+V inserts the copied nodes into a read-only map. `scheduleSync` does not check the read-only toggle, so the change can reach the file.

**Files:**
- Modify: `app/src/components/MindmapCanvas.vue` (`sanitizeCopiedNodes`, `scheduleSync`)

**Interfaces:**
- Consumes: `isEditBlocked(): boolean` (`isReadOnly.value || props.locked`, added in Task 3), `isGraphView` ref.
- Produces: nothing new.

- [ ] **Step 1: Block paste while edit is blocked**

In `sanitizeCopiedNodes`, make the wrapper a no-op while editing is blocked:

```ts
function sanitizeCopiedNodes(instance: MindElixirInstance): void {
  const { copyNodes } = instance;
  instance.copyNodes = (tpcs, to) => {
    if (isEditBlocked() || isGraphView.value) return;
    const safe = tpcs.map(sanitizedTopic).filter((tpc): tpc is Topic => tpc !== null);
    return copyNodes.call(instance, safe, to);
  };
}
```

If `vue-tsc` reports that the bare `return;` does not match `copyNodes`'s return type, check the type in `node_modules/mind-elixir/dist/types/` and return the matching empty value.

- [ ] **Step 2: Skip sync while read-only**

```ts
function scheduleSync(): void {
  if (isReadOnly.value) return;
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(syncNow, SYNC_DEBOUNCE_MS);
}
```

`syncNow` already returns early while `props.locked`, so the two guards together cover both states. One side effect: collapsing a node while read-only no longer writes the expanded state to the file. A read-only map must not change the file, so this is intended.

- [ ] **Step 3: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 4: Browser verification**

1. Read-only on: copy a node (Cmd+C), select another node, press Cmd+V. No node is added and the tab is not dirty.
2. Locked (Data · Split with invalid JSON): the same paste adds no node, and the JSON text is unchanged.
3. Graph view: paste adds no node.
4. Read-only off: paste adds the node, and the file updates after the debounce.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/MindmapCanvas.vue
git commit -m "fix(mindmap): paste cannot change a read-only or locked map"
```

---

### Task 12: Verification, docs, bump

**Files:**
- Modify: `docs/design/mindmap/2026-10-12-mindmap-phase8-lens-design.md` (Status), `docs/design/mindmap/2026-10-11-mindmap-design.md` (Phase 8 row), `docs/plans/mindmap/2026-10-12-mindmap-desktop-checklist.md`, `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/tauri.conf.json`

- [ ] **Step 1: Full unit sweep**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-*.test.ts src/lib/xmind-*.test.ts src/lib/view-mode-guard.test.ts`
Expected: all pass. The known extensionless-import failures are not in this glob.

- [ ] **Step 2: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 3: Leftover sweep**

Run: `cd app && grep -rn "mindmapMode\|viewSource\|viewOutline\|mindmap.viewMap\|mindmap.cycleView\|bg-secondary" src --include=*.ts --include=*.vue`
Expected hits, and nothing else:
- `types.ts` (legacy field)
- `mindmap-lens.ts` (legacy maps)
- `MindmapView.vue` (`delete props.tab.mindmapMode`, `migrateLegacyMode`)

- [ ] **Step 4: Update docs**

1. Phase 8 spec `## Status`: add `Done DD-MM-YY (<version>) — plan docs/plans/mindmap/2026-10-12-mindmap-phase8-lens.md`. Copy this plan's "Spec deltas" table under a `## Decisions during planning` heading.
2. Parent design status table: set the Phase 8 row to `✅ Done DD-MM-YY (<version>)` with the plan path.
3. Desktop checklist: add a Phase 8 section with these items:
   - Lens × view cells in the packaged app.
   - Reading wide map plus Escape.
   - Themes in light and dark.
   - Settings → Mindmap.
   - Export split button through native save dialogs.
   - Fit/Root controls and the duplicates chip.
   - Cmd+V on a read-only map adds nothing.

- [ ] **Step 5: Bump the patch version**

Read the version from `app/package.json` and bump the patch number in all three files (`app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/tauri.conf.json`), as in earlier phases. Run `cd app/src-tauri && cargo check` so `Cargo.lock` updates.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers app/package.json app/src-tauri/Cargo.toml app/src-tauri/Cargo.lock app/src-tauri/tauri.conf.json
git commit -m "chore(mindmap): phase 8 docs and version bump"
```

- [ ] **Step 7: Desktop check (user)**

Hand off to the user for a Tauri desktop pass on the Phase 8 checklist section before merge.
