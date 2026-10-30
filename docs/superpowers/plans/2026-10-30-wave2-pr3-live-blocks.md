# Wave 2 PR-3 — Split `lib/cm-live-blocks.ts` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `app/src/lib/cm-live-blocks.ts` from 1620 lines to ≤ 400 by moving code into `app/src/lib/live-blocks/*.ts` (each ≤ 400), with characterization tests written first.

**Architecture:** Split module by responsibility. `cm-live-blocks.ts` stays the entry and re-exports every symbol other files import today, so no importer changes.

**Tech Stack:** TypeScript, CodeMirror 6, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-30-wave2-editor-lld.md` §PR-3.

## Global Constraints

- No behavior change; code moves verbatim. Module-level state (caches, `mermaidIdSeq`, `relayoutTimer`, `imageNaturalSizes`, WeakMaps) moves with its users and stays module-level (one instance).
- Own only `app/src/lib/cm-live-blocks.ts`, `app/src/lib/live-blocks/**`, and new tests. Do not edit `Editor.vue`, `cm-drag-aware.ts`, `fence-languages.ts`, `cm-live-render.ts` (importers keep importing from `./cm-live-blocks`).
- Every name exported from `cm-live-blocks.ts` today is still exported from it (`grep -n "^export" src/lib/cm-live-blocks.ts` before you start; save the list).
- `lib/` purity: new files import no `vue`/`pinia`/`@tauri-apps/*`. Local imports: match the file's existing style (this file imports without `.ts`; new files may use `.ts`).
- Workers never commit. `pnpm --dir app guard` green after each task.

---

### Task 1: Characterization tests on the current file

**Files:**
- Test: `app/src/lib/cm-live-blocks.test.ts`

Build states with `EditorState.create({ doc, extensions: liveBlocksExtension(opts), selection })` and read decorations through the field's provider:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { EditorView, type DecorationSet } from '@codemirror/view';
import { liveBlocksExtension } from './cm-live-blocks.ts';

function decos(doc: string, cursor = 0, opts = {}) {
  const state = EditorState.create({ doc, selection: { anchor: cursor }, extensions: liveBlocksExtension(opts) });
  const out: Array<{ from: number; to: number; widget: string; block: boolean }> = [];
  for (const source of state.facet(EditorView.decorations)) {
    const set = (typeof source === 'function' ? null : source) as DecorationSet | null;
    set?.between(0, state.doc.length, (from, to, d) => {
      out.push({ from, to, widget: d.spec.widget?.constructor.name ?? (d.spec.class ?? 'mark'), block: !!d.spec.block });
    });
  }
  return out;
}

const TABLE = '| a | b |\n|---|---|\n| 1 | 2 |\n';
test('GFM table renders as a block widget when the cursor is elsewhere', () => {
  const doc = `intro\n\n${TABLE}\nafter`;
  assert.ok(decos(doc, 0).some((d) => d.widget === 'TableWidget' && d.block));
});
test('cursor inside the table keeps its source', () => {
  const doc = `intro\n\n${TABLE}\nafter`;
  assert.ok(!decos(doc, doc.indexOf('| 1')).some((d) => d.widget === 'TableWidget'));
});
```

Cover, each as its own test with today's observed output: image line (`ImageWidget`), `$$…$$` block (`MathWidget`), inline `$x$` (`InlineMathWidget`), ```` ```mermaid ```` (`MermaidWidget`), ```` ```dot ```` (`GraphvizWidget`), ```` ```plantuml ```` with `getPlantuml: () => ({ enabled: true, server: 'https://x' })` vs disabled, ```` ```mindmap ```` fence, ```` ```tldraw ```` fence, HTML block, `keepSource: () => true` (nothing replaced; image renders below its line — assert the exact shape you observe). Widget class names are minified in no build here (Node runs source), so `constructor.name` is stable. If a decoration source is a function (view-dependent), skip it — record which in a comment.

- [ ] **Step 1:** Write tests; `cd app && node --test src/lib/cm-live-blocks.test.ts` → PASS (characterizing today).
- [ ] **Step 2:** `pnpm --dir app guard` → exit 0.

### Task 2: Move leaves out, one file per step

**Files (create under `app/src/lib/live-blocks/`):**

| File | Moves (cm-live-blocks.ts lines) |
|---|---|
| `diagram-cache.ts` | 86-144: `MermaidTheme`, mermaid/graphviz caches, `ensureMermaidRendered`, `ensureGraphvizRendered` |
| `layout.ts` | 38 `relayoutEffect`, 145-214: `IMAGE_LINE_RE`, `isPipeRow`, `isSeparatorRow`, image natural sizes, `scheduleImageRelayout`, `trackImageHeights` |
| `widgets.ts` | 215-442: `ImageWidget`, `TableWidget`, `HtmlBlockWidget`, `MathWidget`, `InlineMathWidget`, `inlineMathSpans` |
| `diagram-widgets.ts` | 443-581 + `diagramWidget` 920-928: `MermaidWidget`, `GraphvizWidget`, `PlantumlWidget` |
| `mindmap-widget.ts` | 582-717 |
| `tldraw-widget.ts` | 718-879 |
| `options.ts` | `BlockOptions` 880-919 (export it) |
| `diagram-fences.ts` | 929-975 `DiagramFenceContext`, `addDiagramFence` |
| `decorations.ts` | 976-1319 `splitSideLine`, `buildBlockDecorations` (if > 400, split the per-kind branches into `decorations-*.ts` helpers that take the builder) |
| `theme.ts` | 1453-1620 `liveBlocksTheme` |

Rules: whatever was `export`ed stays exported (from the entry, via `export { … } from './live-blocks/x.ts'`); whatever was private becomes a named export of its new file and is NOT re-exported from the entry. Imports between new files are explicit; no circular imports (order: `options`, `diagram-cache`, `layout` → `widgets`, `diagram-widgets`, `mindmap-widget`, `tldraw-widget` → `diagram-fences` → `decorations`).

- [ ] **Step 1..N:** One file per step; after each: `node --test src/lib/cm-live-blocks.test.ts` → PASS and `pnpm --dir app exec vue-tsc --noEmit` → exit 0.
- [ ] **Step N+1:** `wc -l src/lib/cm-live-blocks.ts src/lib/live-blocks/*.ts` → entry ≤ 400, each ≤ 400. Diff today's export list against the saved one → identical.
- [ ] **Step N+2:** `pnpm --dir app guard` → exit 0. Controller: `pnpm --dir app arch:rebaseline` drops the `cm-live-blocks.ts` `fileSize` entry; `verify`; browser check (live edit: table, image, mermaid, math render; cursor in reveals source); commit.
