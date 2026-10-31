# Mindmap Phase 4 — Map UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every mindmap canvas (the `.mmap` tab and the fence editor) export, copy, jump to source, a read-only toggle, same-map gates, a duplicate finder and a graph view. Every action is reachable from the command palette.

**Architecture:** Mind Elixir core and `@mind-elixir/export-mindmap` do the work. Our code is glue only:

- Pure, node-tested libs in `app/src/lib/mindmap-*.ts` hold all data logic: export text, headings, source lines, gates, duplicates, graph.
- Browser-only glue goes in `mindmap-export-image.ts` (PNG/SVG + DOMPurify) and `mindmap-gate-controller.ts`, which drives a live `MindElixirInstance`.
- `MindmapCanvas.vue` stays thin. It builds an action table from two composables and registers itself in `mindmap-active.ts`, so palette commands reach the focused map.

**Tech Stack:** Vue 3.5 + Pinia, TypeScript, Tauri 2 (`write_file` / `write_binary_file` commands, `plugin-dialog`, `plugin-clipboard-manager`), `mind-elixir@5.15.1`, `@mind-elixir/export-mindmap@0.1.11` (new), `dompurify@3.3.3` (existing), `node:test`.

**Spec:** `docs/design/mindmap/2026-10-11-mindmap-design.md` (Phase 4 section, Guiding rule).

## Status

COMPLETE. 12-10-26, version 4.14.12. Branch `feat/mindmap`, unpushed.

| Task | Commits | Notes |
|---|---|---|
| 1 Text export core | `86fd55d..db14af7` | Plan; HTML data re-escaped |
| 2 PNG/SVG builders + Tauri writer | `6a64f26..76be3aa` | `6a64f26` escaped U+2028/2029 in plan text; SVG via DOMPurify |
| 3 Map to headings | `76be3aa..fcbdd3f` | |
| 4 Palette commands, export/copy actions, read-only | `fcbdd3f..afaa027` | `mindmap-active` registry |
| 5 Jump to source | `afaa027..a058a2d` | |
| 6 Gate model | `a058a2d..6c7951b` | |
| 7 Gate controller, follow/back | `6c7951b..59654e9` (`e85bcf9`, fix `59654e9`) | Fix: capture-phase key dispatch |
| 8 `- => ref` fence syntax | `59654e9..3798843` | |
| 9 Duplicate finder + merge | `3798843..51e1ffe` (`f7f8371`, fix `51e1ffe`) | Fix: retarget gates, unambiguous canonical |
| 10 Graph view + Mermaid/JSON adjacency | `51e1ffe..0e0c8ed` (`56fee05`, fix `0e0c8ed`) | Fix: re-enable editing after graph view |
| Final review (Opus, `86fd55d..0e0c8ed`) | `4ff126d` | C1 orphaned gates, I1 undo/redo labels, I2 merge content loss, I3 canonical size, 3 cheap minors |
| 11 Verification, docs, bump | this commit | |

**Tests:** 137/137 pass across the Step 1 sweep, files mindmap-*.test.ts + fence-scan + fence-languages (`node --test --experimental-strip-types src/lib/mindmap-*.test.ts src/lib/fence-scan.test.ts src/lib/fence-languages.test.ts`): mindmap-active 4, mindmap-direction 3, mindmap-duplicates 9, mindmap-export 9, mindmap-fence 15, mindmap-format 34, mindmap-gate-plaintext 5, mindmap-gates 9, mindmap-graph 5, mindmap-headings 4, mindmap-keymap 5, mindmap-source 4, fence-scan 12, fence-languages 19. `pnpm build` OK (chunk-size warning only).

**Browser check (web, controller-run per task):** 12 palette commands run; read-only badge blocks Tab and toggles back; headings doc created; Jump to Source lands on `    - B1`; gate insert, follow (expands collapsed target, no stray node), Alt+Left back, live rename, delete shows missing target, Repair and Remove persist; fence gate widget and editor writeback keep `[^a1]` and `- => a1`; Find Duplicates lists `Tasks x 2`, Merge turns the duplicate into a gate and persists; graph view draws a dashed gate arrow with no leak into content or exports; Mermaid export text OK; after the fix wave rename, undo, redo re-label the gate (Alef, Alpha, Alef). In web, export shows the toast "Mind map export failed: TypeError: … 'invoke'" (verified after 4ff126d). Phases 1-3 paths were exercised incidentally during Phase 4 checks (`.mmap` open, fence render, fullscreen writeback in Tasks 5/8); standalone `buildHtmlExport`/`buildSvgExport` console security checks were not rerun in Task 11 — covered by unit tests and the final review's probes.

**Desktop (Tauri) check:** PENDING. Not runnable in this session; nothing below claims it passed.

### Deviations

- Ruling 1: Task 1 html test asserts the embedded data (`dangerouslySetInnerHTML` is undefined), not a substring: the bundled runtime contains `onerror`.
- Ruling 2: `useMindmapExport` does not import `isImageFormat` (`noUnusedLocals`); the lib keeps the export.
- Ruling 3: `useMindmapCanvasActions` may exceed 20 lines (inner functions are at most 10); length findings are Minor.
- `mindmap.toggleReadOnly` and `mindmap.jumpToSource` default to `[]`: Mod+Alt+R is the AMD preset `view.toggleReading`, Mod+Alt+J is the compat preset for `proofread.cjk`. Palette-only.
- Ruling: palette entries are pushed after the App Store filter instead of spread (spread broke contextual typing). Behavior-equivalent today: no filter matches `mindmap.*`. A future App Store filter could hide or show them unexpectedly.
- Gate follow/back keys dispatch in the capture phase: core Enter and ArrowLeft handlers ran first and added a stray sibling. The bubble handler keeps the built-in-combo stop.
- `Before`/`Arrow` types are derived from core signatures (not hand-written).
- `withoutGateArrows`, read-only in graph view and merge-blocked in graph view: extras judged necessary to stop gate arrows leaking into saved content.
- Ruling: duplicate union keeps topic-plus-structure twins dropped, but the canonical form is JSON-encoded and compared as strings (not 32-bit hashes). `subtreeHash` is `fnv1a(canonical)`, kept for the spec.
- Ruling (reverses the above in part): canonical also compares content fields (note, link, image, tags, refId), so twins with different content stay visible. Canonical is built as nested arrays and stringified once (was exponential in depth).
- Ruling: gates or arrows pointing into a dropped twin subtree are pruned or become broken, not redirected. Gates targeting the merged duplicate itself are retargeted to the kept node.
- Ruling: merge clears undo history (`clearHistory`); merge is not undoable. Undo/redo wrappers re-sync gate labels.
- Refresh (duplicate dialog) is not undoable.
- Ruling: final review runs before Task 11, scope `86fd55d..HEAD`, so docs record the post-fix state.
- Ruling: fix wave also took cheap minors: `missingRef` validated against `[\w-]+`, `pickWritePath` moved inside `try`, gate-arrow strip test.
- Source-line mapping limitation: a topic that starts with `}` or `> ` serializes as a summary or arrow line, so its fence source line is not mapped.
- Ruling: no worktree; desktop check recorded as pending, not passed.

### Open items

- Desktop (Tauri) check PENDING: export PNG, SVG, HTML, JSON, Markdown, Mermaid, adjacency through the native save dialog; open each file (Hebrew labels in PNG/SVG, HTML read-only, JSON parses); copy as plaintext into a note. Web shows the failure toast; a real write needs this desktop check (PENDING).
- Parked, Phase 5 hardening: restrict `metadata.source.path`; validate orphaned-gate fallback `gate.target` against `[\w-]+` (a crafted `.mmap` could inject a newline into copy-as-plaintext).
- Thin tests: gates (`missingRef` broken, `withGate` no-mutation, broken label, `refId` survival), headings edge cases, fence gate edge cases, capture-phase key dispatch, gate controller.
- Missing tests: `mindmap-gate-controller` unit tests (needs a `MindElixirInstance` fake); regression test for capture-phase key dispatch; `HTML_MARKER_MISSING` branch; JSON/HTML exports strip gate-arrow ids.
- Check: SVG export as standalone file and as XHTML (DOMPurify output, `foreignObject` content namespace).
- Deferred minors:
  - Export: `MINDMAP_EXPORT_SPECS` mutable record; `Array.from(bytes)` for large PNG IPC; HTML export relies on package `JSON.stringify` byte identity (fails closed).
  - Headings/text: empty topic gives `# ` trailing space; `LINE_BREAKS` misses lone `\r` and U+2028; `BLANK_LINE` name; `mermaidLabel` does not escape `#` or backtick.
  - Canvas/palette: `activate()` on every mount (remount after external update steals the active slot in split view); `toggleReadOnly` mid topic edit calls `disableEdit` (core behavior unverified).
  - Jump: `jumpTo` dispatches goto even if `openPath` failed or spawned an aux window; overlay `void jumpTo` unhandled rejection and runs when stale; pathless `MindmapView` source goes to the hidden editor (unreachable until Phase 5).
  - Gates: `structuredClone` throws on Vue proxies (callers pass plain data); `findNode` O(n) per gate; `repairGate` read-only wrong toast, not limited to broken gates, bypasses undo; follow pushes history before select succeeds; menu labels fixed at setup; move/copy refusals silent; `syncLabels` drops multi-select; `ensureRef` fallback can collide with an existing refId; duplicate refIds last-wins; literal `=> x` topic becomes a gate (spec-consistent); `retargetGates` metadata cast and stale `missingRef`; gate inside a keep subtree may target its ancestor.
  - Duplicates dialog: merge buttons share one accessible name; Escape needs focus, no `aria-modal`; `ids[0]` ancestor is a silent no-op; keep-as-gate not rejected (unreachable); stale `duplicateGroups` after external refresh; `unicode-bidi` on the whole dialog.
  - Graph: `withoutGateArrows` drops user arrows with a `gate-arrow-` id prefix (impractical).

## Global Constraints

- Branch `feat/mindmap`; no worktree; never push.
- pnpm in `app/`, exact version pins, commit `app/pnpm-lock.yaml` with any dependency change.
- TypeScript: no `any`, no zod, constants for every literal value, functions ≤ ~20 lines, early returns, no comments except non-obvious "why".
- `src/lib` imports between lib files use the `.ts` extension (node test runner requirement).
- Unit tests: `cd app && node --test --experimental-strip-types src/lib/<file>.test.ts`.
- Build: `cd app && pnpm build` (runs `vue-tsc` + `vite build`) must pass at the end of every task that touches `.vue` or composables.
- Known pre-existing failures, out of scope: 12 `src/lib/*.test.ts` files with extensionless imports; one Rust assertion in `detect_language_from_extension`.
- Every map payload passes through `sanitizeMindmapData` before it is exported or rendered.
- Files are written through Tauri (`invoke('write_file' | 'write_binary_file')`), never browser downloads. Never call the package's `download*` functions.
- PNG export passes `watermarkEnabled: false`.
- Gate data lives in `node.metadata.gate`. Core already stores `metadata.refId` (plaintext `[^ref]` anchors), so always merge into `metadata`, never replace it.
- New user-facing strings go in `app/src/i18n/en.ts` under `mindmap`. Other locales fall back (the `mindmap` key is optional there).
- New keybinding actions: `category: 'mindmap', scope: 'mindmap'`. Palette-only actions use `defaults: []`.
- Commit trailer: `Co-Authored-By: Claude <model> 5.5 <noreply@anthropic.com>` (use the implementer's model name).

## Spike facts (12-10-26)

| Fact | Consequence |
|---|---|
| `convertToHtml(data)` inlines `JSON.stringify(data)` into `<script>` unescaped; `</script>` in a topic breaks out | `buildHtmlExport` re-escapes that exact substring (`<`, `>`, `&`, U+2028, U+2029) |
| The package has no SVG export; core `mind.exportSvg()` does not escape topics (a live `<script>` reaches the SVG) | SVG goes through DOMPurify with `HTML_INTEGRATION_POINTS: { foreignobject: true }` (labels survive, scripts never do) |
| `exportImageBlob(mind, 'png', opts)` works; watermark on by default | Pass `{ watermarkEnabled: false }` |
| `getData()` = JSON round-trip minus `parent`; keeps `metadata` | Gates survive save and copy |
| Plaintext converter: `[^ref]` → `metadata.refId`; serializer emits `[^refId]`, root line included, summaries as `- }label`, arrows as `- > [^a] … [^b]` | Gate wrapper and source-line mapper key off these shapes |
| Fence `line` is 0-based; `Editor.gotoLine` is 1-based | Body line `i` (0-based) of fence at `line` → editor line `line + 2 + i` |
| Pure parts of `@mind-elixir/export-mindmap` import fine under Node | `mindmap-export.ts` is node-testable; DOMPurify is browser-only |

## File map

| File | Responsibility | Task |
|---|---|---|
| `app/src/lib/mindmap-export.ts` (+test) | Export format table, file names, HTML/JSON/Markdown text builders | 1, 10 |
| `app/src/lib/mindmap-export-image.ts` | PNG bytes and sanitized SVG from a live map | 2 |
| `app/src/composables/useMindmapExport.ts` | Pick path, build payload, write through Tauri | 2 |
| `app/src/composables/useExport.ts` | Expose existing `pickWritePath` | 2 |
| `app/src/lib/mindmap-headings.ts` (+test) | Map → markdown headings document | 3 |
| `app/src/lib/mindmap-active.ts` (+test) | Registry: palette → focused canvas | 4 |
| `app/src/composables/useMindmapCanvasActions.ts` | Export/copy/headings/read-only actions for a canvas | 4 |
| `app/src/lib/mindmap-source.ts` (+test) | Node → source location (metadata or fence line) | 5 |
| `app/src/composables/useMindmapJump.ts` | Open file/tab and go to line | 5 |
| `app/src/lib/mindmap-gates.ts` (+test) | Gate model: read/make, find, labels, guards, ancestors | 6 |
| `app/src/lib/mindmap-gate-controller.ts` | Gate actions, `before` guards, context menu, live labels on a live map | 7 |
| `app/src/lib/mindmap-gate-plaintext.ts` (+test) | `- => <ref>` fence syntax ↔ `metadata.gate` | 8 |
| `app/src/lib/mindmap-duplicates.ts` (+test) | Subtree hash, duplicate groups, merge into gate | 9 |
| `app/src/components/MindmapDuplicates.vue` | Duplicate list dialog | 9 |
| `app/src/lib/mindmap-graph.ts` (+test) | Gate arrows, Mermaid `graph LR`, JSON adjacency | 10 |
| `app/src/components/MindmapCanvas.vue` | Wire actions, registry, read-only, graph view | 4, 5, 7, 9, 10 |
| `app/src/components/MindmapView.vue`, `MindmapFenceOverlay.vue` | Pass export name / source line; handle jump | 4, 5 |
| `app/src/lib/keybindings.ts` | New `mindmap.*` actions | 4, 5, 7, 9, 10 |
| `app/src/composables/useCommands.ts` | Palette entries for every `mindmap.*` action | 4 |
| `app/src/lib/mindmap-fence.ts`, `mindmap-readonly.ts` | Gate-aware codec; gate labels in preview | 8 |
| `app/src/i18n/en.ts` | New `mindmap.*` strings | 4, 5, 7, 9, 10 |

---

### Task 1: Export text core + dependency pin

**Files:**
- Create: `app/src/lib/mindmap-export.ts`
- Test: `app/src/lib/mindmap-export.test.ts`
- Commit: `app/package.json`, `app/pnpm-lock.yaml` (already pin `"@mind-elixir/export-mindmap": "0.1.11"`; confirm with `git diff app/package.json`)

**Interfaces:**
- Consumes: `sanitizeMindmapData(data: MindElixirData): MindElixirData` from `./mindmap-format.ts`.
- Produces:
  - `type MindmapTextFormat = 'html' | 'json' | 'markdown'` (Task 10 adds `'mermaid' | 'adjacency'`)
  - `type MindmapImageFormat = 'png' | 'svg'`
  - `type MindmapExportFormat = MindmapTextFormat | MindmapImageFormat`
  - `MINDMAP_EXPORT_SPECS: Record<MindmapExportFormat, { extension: string; filterName: string }>`
  - `isImageFormat(format: MindmapExportFormat): format is MindmapImageFormat`
  - `exportFileName(baseName: string, format: MindmapExportFormat): string`
  - `escapeScriptJson(json: string): string`
  - `buildHtmlExport(data: MindElixirData): string`
  - `buildTextExport(data: MindElixirData, format: MindmapTextFormat): string`

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/mindmap-export.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { buildHtmlExport, buildTextExport, escapeScriptJson, exportFileName, isImageFormat } from './mindmap-export.ts';

const BREAKOUT = '</script><script>window.__pwn=1</script>';
const data = (topic: string): MindElixirData => ({
  nodeData: { id: 'root', topic: 'שורש', children: [{ id: 'a', topic }, { id: 'b', topic: 'B', children: [{ id: 'c', topic: 'C' }] }] },
});
const embeddedJson = (html: string): string => {
  const match = /const data = (.*)\n/.exec(html);
  assert.ok(match, 'data assignment present');
  return match[1];
};

test('escapeScriptJson removes every char that can end a script block', () => {
  const out = escapeScriptJson(JSON.stringify({ t: '</script>&\u2028\u2029' }));
  assert.equal(/[<>&\u2028\u2029]/.test(out), false);
  assert.deepEqual(JSON.parse(out), { t: '</script>&\u2028\u2029' });
});

test('html export cannot be broken out of by a topic', () => {
  const html = buildHtmlExport(data(BREAKOUT));
  assert.equal(html.includes(BREAKOUT), false);
  assert.equal(JSON.parse(embeddedJson(html)).nodeData.children[0].topic, BREAKOUT);
});

test('html export survives "$&" replacement patterns in topics', () => {
  const html = buildHtmlExport(data('cost $& $1'));
  assert.equal(JSON.parse(embeddedJson(html)).nodeData.children[0].topic, 'cost $& $1');
});

test('html export drops dangerouslySetInnerHTML', () => {
  const unsafe = data('A');
  unsafe.nodeData.dangerouslySetInnerHTML = '<img src=x onerror=alert(1)>';
  assert.equal(buildHtmlExport(unsafe).includes('onerror'), false);
});

test('json export is pretty, sanitized MindElixirData', () => {
  const parsed = JSON.parse(buildTextExport(data('A'), 'json'));
  assert.equal(parsed.nodeData.children[1].children[0].topic, 'C');
});

test('markdown export is a nested bullet list from the root', () => {
  assert.equal(buildTextExport(data('A'), 'markdown'), '- שורש\n  - A\n  - B\n    - C\n');
});

test('file names and format kinds', () => {
  assert.equal(exportFileName('plan', 'png'), 'plan.png');
  assert.equal(exportFileName('plan', 'markdown'), 'plan.md');
  assert.equal(isImageFormat('svg'), true);
  assert.equal(isImageFormat('json'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-export.test.ts`
Expected: FAIL, `Cannot find module '.../mindmap-export.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/lib/mindmap-export.ts
import type { MindElixirData } from 'mind-elixir';
import { convertToHtml, convertToMd } from '@mind-elixir/export-mindmap';
import { sanitizeMindmapData } from './mindmap-format.ts';

export type MindmapTextFormat = 'html' | 'json' | 'markdown';
export type MindmapImageFormat = 'png' | 'svg';
export type MindmapExportFormat = MindmapTextFormat | MindmapImageFormat;

export const MINDMAP_EXPORT_SPECS: Record<MindmapExportFormat, { extension: string; filterName: string }> = {
  png: { extension: 'png', filterName: 'PNG Image' },
  svg: { extension: 'svg', filterName: 'SVG Image' },
  html: { extension: 'html', filterName: 'HTML' },
  json: { extension: 'json', filterName: 'JSON' },
  markdown: { extension: 'md', filterName: 'Markdown' },
};

const IMAGE_FORMATS: ReadonlySet<MindmapExportFormat> = new Set<MindmapExportFormat>(['png', 'svg']);
const JSON_INDENT = 2;
const DATA_ASSIGNMENT = 'const data = ';
const HTML_MARKER_MISSING = 'export-mindmap HTML layout changed: data assignment not found';
const SCRIPT_UNSAFE_CHARS = /[<>&\u2028\u2029]/g;

export function isImageFormat(format: MindmapExportFormat): format is MindmapImageFormat {
  return IMAGE_FORMATS.has(format);
}

export function exportFileName(baseName: string, format: MindmapExportFormat): string {
  return `${baseName}.${MINDMAP_EXPORT_SPECS[format].extension}`;
}

export function escapeScriptJson(json: string): string {
  return json.replace(SCRIPT_UNSAFE_CHARS, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function buildHtmlExport(data: MindElixirData): string {
  const safe = sanitizeMindmapData(data);
  const json = JSON.stringify(safe);
  const html = convertToHtml(safe);
  const marker = DATA_ASSIGNMENT + json;
  const at = html.indexOf(marker);
  if (at < 0) throw new Error(HTML_MARKER_MISSING);
  return html.slice(0, at) + DATA_ASSIGNMENT + escapeScriptJson(json) + html.slice(at + marker.length);
}

const TEXT_EXPORTERS: Record<MindmapTextFormat, (data: MindElixirData) => string> = {
  html: buildHtmlExport,
  json: (data) => JSON.stringify(sanitizeMindmapData(data), null, JSON_INDENT),
  markdown: (data) => convertToMd(sanitizeMindmapData(data).nodeData),
};

export function buildTextExport(data: MindElixirData, format: MindmapTextFormat): string {
  return TEXT_EXPORTERS[format](data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-export.test.ts`
Expected: PASS 7/7. If the `$&` test fails, you used `String.replace` with a string replacement; keep the slice form above.

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/pnpm-lock.yaml app/src/lib/mindmap-export.ts app/src/lib/mindmap-export.test.ts
git commit -m "feat(mindmap): text export core with escaped HTML data"
```

---

### Task 2: Image export + Tauri write glue

**Files:**
- Create: `app/src/lib/mindmap-export-image.ts`
- Create: `app/src/composables/useMindmapExport.ts`
- Modify: `app/src/composables/useExport.ts` (return object at the end of `useExport`, currently lines ~677-687: add `pickWritePath`)

**Interfaces:**
- Consumes (Task 1): `MindmapExportFormat`, `MINDMAP_EXPORT_SPECS`, `isImageFormat`, `exportFileName`, `buildTextExport`, `MindmapTextFormat`.
- Produces:
  - `buildPngExport(mind: MindElixirInstance): Promise<Uint8Array>`
  - `buildSvgExport(mind: MindElixirInstance): Promise<string>`
  - `useMindmapExport(): { exportMap(mind: MindElixirInstance, format: MindmapExportFormat, baseName: string): Promise<void> }`
  - `useExport()` also returns `pickWritePath(filename: string, filters: { name: string; extensions: string[] }[]): Promise<string | null>`

No node test: these need a DOM and Tauri. They are verified in the browser at Task 4 and in the desktop build at Task 11.

- [ ] **Step 1: Expose `pickWritePath`**

In `app/src/composables/useExport.ts`, add `pickWritePath,` to the object returned by `useExport()` (after `copyAsImage,`). No other change.

- [ ] **Step 2: Image builders**

```ts
// app/src/lib/mindmap-export-image.ts
import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import type { MindElixirInstance } from 'mind-elixir';
import { exportImageBlob } from '@mind-elixir/export-mindmap';

const XML_PROLOG = '<?xml version="1.0" encoding="UTF-8"?>\n';
const SVG_PURIFY_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true, html: true },
  ADD_TAGS: ['foreignObject'],
  HTML_INTEGRATION_POINTS: { foreignobject: true },
};

export async function buildPngExport(mind: MindElixirInstance): Promise<Uint8Array> {
  const blob = await exportImageBlob(mind, 'png', { watermarkEnabled: false });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function buildSvgExport(mind: MindElixirInstance): Promise<string> {
  const raw = await mind.exportSvg().text();
  return XML_PROLOG + String(DOMPurify.sanitize(raw, SVG_PURIFY_CONFIG));
}
```

If `vue-tsc` rejects `HTML_INTEGRATION_POINTS` on `Config`, check `node_modules/dompurify/dist/purify.es.d.mts` for the key's name; it exists in 3.3.x. Do not cast to `any`.

- [ ] **Step 3: Write composable**

```ts
// app/src/composables/useMindmapExport.ts
import { invoke } from '@tauri-apps/api/core';
import type { MindElixirInstance } from 'mind-elixir';
import { useExport } from './useExport';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import { buildTextExport, exportFileName, isImageFormat, MINDMAP_EXPORT_SPECS, type MindmapExportFormat } from '../lib/mindmap-export';
import { buildPngExport, buildSvgExport } from '../lib/mindmap-export-image';

type ExportPayload = { kind: 'text'; content: string } | { kind: 'binary'; bytes: Uint8Array };
const TEXT_ENCODING = 'UTF-8';

async function buildPayload(mind: MindElixirInstance, format: MindmapExportFormat): Promise<ExportPayload> {
  if (format === 'png') return { kind: 'binary', bytes: await buildPngExport(mind) };
  if (format === 'svg') return { kind: 'text', content: await buildSvgExport(mind) };
  return { kind: 'text', content: buildTextExport(mind.getData(), format) };
}

async function writePayload(path: string, payload: ExportPayload): Promise<void> {
  if (payload.kind === 'binary') {
    await invoke('write_binary_file', { path, data: Array.from(payload.bytes) });
    return;
  }
  await invoke('write_file', { path, content: payload.content, encoding: TEXT_ENCODING });
}

export function useMindmapExport() {
  const { pickWritePath } = useExport();
  const toasts = useToastsStore();
  const { t } = useI18n();

  async function exportMap(mind: MindElixirInstance, format: MindmapExportFormat, baseName: string): Promise<void> {
    const spec = MINDMAP_EXPORT_SPECS[format];
    const path = await pickWritePath(exportFileName(baseName, format), [{ name: spec.filterName, extensions: [spec.extension] }]);
    if (!path) return;
    try {
      await writePayload(path, await buildPayload(mind, format));
      toasts.success(t('mindmap.exportDone'));
    } catch (err) {
      toasts.error(`${t('mindmap.exportFailed')}: ${String(err)}`);
    }
  }

  return { exportMap };
}
```

`isImageFormat` is imported for Task 10's format menu. If `vue-tsc` flags it unused, drop the import here and keep the export in the lib.

- [ ] **Step 4: Add i18n keys**

In `app/src/i18n/en.ts`, inside `mindmap: { … }` after `fenceStale`, add:

```ts
    exportDone: 'Mind map exported',
    exportFailed: 'Mind map export failed',
```

- [ ] **Step 5: Build**

Run: `cd app && pnpm build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/mindmap-export-image.ts app/src/composables/useMindmapExport.ts app/src/composables/useExport.ts app/src/i18n/en.ts
git commit -m "feat(mindmap): PNG/SVG builders and Tauri export writer"
```

---

### Task 3: Map → markdown headings document

**Files:**
- Create: `app/src/lib/mindmap-headings.ts`
- Test: `app/src/lib/mindmap-headings.test.ts`

**Interfaces:**
- Produces: `mapToHeadingsMarkdown(data: MindElixirData): string`. Depth 0 (root) → `#`, depth d → `#`×(d+1) up to `######`, deeper nodes → nested `- ` bullets under the last heading. Newlines in topics become spaces. A blank line separates headings. Output ends with exactly one `\n`.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/mindmap-headings.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { mapToHeadingsMarkdown } from './mindmap-headings.ts';

const chain = (depth: number): NodeObj => {
  let node: NodeObj = { id: `n${depth}`, topic: `L${depth}` };
  for (let d = depth - 1; d >= 0; d -= 1) node = { id: `n${d}`, topic: `L${d}`, children: [node] };
  return node;
};

test('root and children become headings', () => {
  const data: MindElixirData = { nodeData: { id: 'r', topic: 'Plan', children: [{ id: 'a', topic: 'Goals', children: [{ id: 'b', topic: 'Ship' }] }, { id: 'c', topic: 'Risks' }] } };
  assert.equal(mapToHeadingsMarkdown(data), '# Plan\n\n## Goals\n\n### Ship\n\n## Risks\n');
});

test('levels past six become nested bullets', () => {
  const md = mapToHeadingsMarkdown({ nodeData: chain(7) });
  assert.ok(md.includes('###### L5\n\n- L6\n  - L7\n'));
});

test('multi-line topics are flattened', () => {
  assert.equal(mapToHeadingsMarkdown({ nodeData: { id: 'r', topic: 'a\nb' } }), '# a b\n');
});

test('hebrew topics pass through untouched', () => {
  assert.equal(mapToHeadingsMarkdown({ nodeData: { id: 'r', topic: 'תוכנית' } }), '# תוכנית\n');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-headings.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/lib/mindmap-headings.ts
import type { MindElixirData, NodeObj } from 'mind-elixir';

const MAX_HEADING_LEVEL = 6;
const BULLET_INDENT = '  ';
const LINE_BREAKS = /\s*\r?\n\s*/g;

type Block = { kind: 'heading' | 'bullet'; text: string };

function flatten(topic: string): string {
  return topic.replace(LINE_BREAKS, ' ').trim();
}

function blockFor(node: NodeObj, depth: number): Block {
  const level = depth + 1;
  if (level <= MAX_HEADING_LEVEL) return { kind: 'heading', text: `${'#'.repeat(level)} ${flatten(node.topic)}` };
  return { kind: 'bullet', text: `${BULLET_INDENT.repeat(level - MAX_HEADING_LEVEL - 1)}- ${flatten(node.topic)}` };
}

function collect(node: NodeObj, depth: number, out: Block[]): void {
  out.push(blockFor(node, depth));
  for (const child of node.children ?? []) collect(child, depth + 1, out);
}

export function mapToHeadingsMarkdown(data: MindElixirData): string {
  const blocks: Block[] = [];
  collect(data.nodeData, 0, blocks);
  const lines = blocks.map((b, i) => (i > 0 && (b.kind === 'heading' || blocks[i - 1].kind === 'heading') ? `\n${b.text}` : b.text));
  return `${lines.join('\n')}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-headings.test.ts`
Expected: PASS 4/4.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-headings.ts app/src/lib/mindmap-headings.test.ts
git commit -m "feat(mindmap): map to markdown headings converter"
```

---

### Task 4: Palette registry, canvas actions, read-only toggle

**Files:**
- Create: `app/src/lib/mindmap-active.ts`
- Test: `app/src/lib/mindmap-active.test.ts`
- Create: `app/src/composables/useMindmapCanvasActions.ts`
- Modify: `app/src/components/MindmapCanvas.vue`, `app/src/components/MindmapView.vue`, `app/src/components/MindmapFenceOverlay.vue`
- Modify: `app/src/lib/keybindings.ts` (mindmap block, lines ~180-184)
- Modify: `app/src/composables/useCommands.ts`
- Modify: `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: `useMindmapExport().exportMap` (Task 2), `mapToHeadingsMarkdown` (Task 3), `serializeMindmapFence(data)` from `../lib/mindmap-fence` (Task 8 makes it gate-aware; copy inherits that).
- Produces:
  - `interface MindmapHandle { run(actionId: string): boolean }`
  - `setActiveMindmap(handle: MindmapHandle): void`, `clearActiveMindmap(handle: MindmapHandle): void`, `runActiveMindmapAction(actionId: string): boolean`
  - `interface CanvasActionContext { getMind(): MindElixirInstance | null; exportName(): string; isReadOnly: Ref<boolean> }`
  - `useMindmapCanvasActions(ctx: CanvasActionContext): Record<string, () => void>`
  - `MindmapCanvas` prop `exportName?: string` (default `'mindmap'`)
  - Action ids: `mindmap.exportPng`, `mindmap.exportSvg`, `mindmap.exportHtml`, `mindmap.exportJson`, `mindmap.exportMarkdown`, `mindmap.copyPlaintext`, `mindmap.toHeadingsDocument`, `mindmap.toggleReadOnly`

- [ ] **Step 1: Write the failing registry test**

```ts
// app/src/lib/mindmap-active.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearActiveMindmap, runActiveMindmapAction, setActiveMindmap, type MindmapHandle } from './mindmap-active.ts';

const handle = (log: string[], known: string): MindmapHandle => ({
  run: (id) => { if (id !== known) return false; log.push(id); return true; },
});

test('no active map runs nothing', () => {
  assert.equal(runActiveMindmapAction('mindmap.fit'), false);
});

test('last activated map receives the action', () => {
  const a: string[] = []; const b: string[] = [];
  const ha = handle(a, 'mindmap.fit'); const hb = handle(b, 'mindmap.fit');
  setActiveMindmap(ha); setActiveMindmap(hb);
  assert.equal(runActiveMindmapAction('mindmap.fit'), true);
  assert.deepEqual([a, b], [[], ['mindmap.fit']]);
  clearActiveMindmap(hb);
});

test('clearing a non-active handle keeps the active one', () => {
  const a: string[] = [];
  const ha = handle(a, 'mindmap.fit');
  setActiveMindmap(ha);
  clearActiveMindmap(handle([], 'x'));
  assert.equal(runActiveMindmapAction('mindmap.fit'), true);
  clearActiveMindmap(ha);
  assert.equal(runActiveMindmapAction('mindmap.fit'), false);
});

test('unknown action reports false', () => {
  const ha = handle([], 'mindmap.fit');
  setActiveMindmap(ha);
  assert.equal(runActiveMindmapAction('mindmap.nope'), false);
  clearActiveMindmap(ha);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-active.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement registry**

```ts
// app/src/lib/mindmap-active.ts
export interface MindmapHandle { run(actionId: string): boolean }

let active: MindmapHandle | null = null;

export function setActiveMindmap(handle: MindmapHandle): void {
  active = handle;
}

export function clearActiveMindmap(handle: MindmapHandle): void {
  if (active === handle) active = null;
}

export function runActiveMindmapAction(actionId: string): boolean {
  return active?.run(actionId) ?? false;
}
```

Run the test again. Expected: PASS 4/4.

- [ ] **Step 4: Keybinding actions**

In `app/src/lib/keybindings.ts`, after the `mindmap.shortcutHelp` entry, add:

```ts
  { id: 'mindmap.exportPng', label: 'Mindmap: Export as PNG', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.exportSvg', label: 'Mindmap: Export as SVG', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.exportHtml', label: 'Mindmap: Export as HTML', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.exportJson', label: 'Mindmap: Export as JSON', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.exportMarkdown', label: 'Mindmap: Export as Markdown List', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.copyPlaintext', label: 'Mindmap: Copy as Plaintext', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.toHeadingsDocument', label: 'Mindmap: Open as Markdown Headings', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.toggleReadOnly', label: 'Mindmap: Toggle Read-Only', category: 'mindmap', scope: 'mindmap', defaults: ['Mod+Alt+R'] },
```

Then run the existing keymap test, which guards conflicts with Mind Elixir built-ins:
`cd app && node --test --experimental-strip-types src/lib/mindmap-keymap.test.ts`. Expected: PASS. If `Mod+Alt+R` collides with a global action (`grep -n "Mod+Alt+R" app/src/lib/keybindings.ts`), use `defaults: []` and record the deviation.

- [ ] **Step 5: Canvas actions composable**

```ts
// app/src/composables/useMindmapCanvasActions.ts
import type { Ref } from 'vue';
import type { MindElixirInstance } from 'mind-elixir';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useMindmapExport } from './useMindmapExport';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import type { MindmapExportFormat } from '../lib/mindmap-export';
import { mapToHeadingsMarkdown } from '../lib/mindmap-headings';
import { serializeMindmapFence } from '../lib/mindmap-fence';

export interface CanvasActionContext {
  getMind(): MindElixirInstance | null;
  exportName(): string;
  isReadOnly: Ref<boolean>;
}

const HEADINGS_SUFFIX = '-outline.md';
const EXPORT_ACTIONS: Record<string, MindmapExportFormat> = {
  'mindmap.exportPng': 'png',
  'mindmap.exportSvg': 'svg',
  'mindmap.exportHtml': 'html',
  'mindmap.exportJson': 'json',
  'mindmap.exportMarkdown': 'markdown',
};

export function useMindmapCanvasActions(ctx: CanvasActionContext): Record<string, () => void> {
  const { exportMap } = useMindmapExport();
  const tabs = useTabsStore();
  const toasts = useToastsStore();
  const { t } = useI18n();

  const exportAs = (format: MindmapExportFormat) => () => {
    const mind = ctx.getMind();
    if (mind) void exportMap(mind, format, ctx.exportName());
  };

  async function copyPlaintext(): Promise<void> {
    const mind = ctx.getMind();
    if (!mind) return;
    await writeText(serializeMindmapFence(mind.getData()));
    toasts.success(t('mindmap.copiedPlaintext'));
  }

  function openHeadingsDocument(): void {
    const mind = ctx.getMind();
    if (!mind) return;
    const tab = tabs.newTab({ fileName: ctx.exportName() + HEADINGS_SUFFIX });
    tabs.setContent(tab.id, mapToHeadingsMarkdown(mind.getData()));
  }

  function toggleReadOnly(): void {
    const mind = ctx.getMind();
    if (!mind) return;
    ctx.isReadOnly.value = !ctx.isReadOnly.value;
    if (ctx.isReadOnly.value) mind.disableEdit();
    else mind.enableEdit();
  }

  const exports = Object.fromEntries(Object.entries(EXPORT_ACTIONS).map(([id, format]) => [id, exportAs(format)]));
  return {
    ...exports,
    'mindmap.copyPlaintext': () => { void copyPlaintext().catch((e: unknown) => toasts.error(String(e))); },
    'mindmap.toHeadingsDocument': openHeadingsDocument,
    'mindmap.toggleReadOnly': toggleReadOnly,
  };
}
```

Note: `useMindmapCanvasActions` is ~30 lines because of the closures. The inner functions are each under 10, so it is acceptable; do not split it further.

- [ ] **Step 6: Wire into `MindmapCanvas.vue`**

Make exactly these edits:

1. Imports: add
   ```ts
   import { clearActiveMindmap, setActiveMindmap, type MindmapHandle } from '../lib/mindmap-active';
   import { useMindmapCanvasActions } from '../composables/useMindmapCanvasActions';
   ```
2. Props: `const props = withDefaults(defineProps<{ content: string; codec: MindmapCodec; exportName?: string }>(), { exportName: 'mindmap' });`
3. After `const isHelpOpen = ref(false);` add `const isReadOnly = ref(false);`
4. Replace the `const actions: Record<string, () => void> = { … };` block with:
   ```ts
   const canvasActions = useMindmapCanvasActions({ getMind: () => mind, exportName: () => props.exportName, isReadOnly });

   const actions: Record<string, () => void> = {
     [TOGGLE_NODE_ACTION]: toggleCurrentNode,
     'mindmap.fit': () => mind?.scaleFit(),
     'mindmap.focusRoot': selectRoot,
     'mindmap.shortcutHelp': () => { isHelpOpen.value = true; },
     ...canvasActions,
   };

   const handle: MindmapHandle = {
     run: (actionId) => {
       const run = actions[actionId];
       if (!run) return false;
       run();
       return true;
     },
   };

   function activate(): void {
     setActiveMindmap(handle);
   }
   ```
5. In `mount()`: change `editable: true,` to `editable: !isReadOnly.value,`, then at the end of `mount()` add `activate();`.
6. In `teardown()` add `clearActiveMindmap(handle);` as its first line.
7. Template root: `<div class="mindmap-view" @keydown="onKeydown" @focusin="activate" @pointerdown="activate">`, and add inside it, before `<MindmapShortcutHelp …>`:
   ```html
   <span v-if="isReadOnly" class="mindmap-view__badge">{{ t('mindmap.readOnlyBadge') }}</span>
   ```
8. Style: `.mindmap-view__badge { position: absolute; inset-block-start: 8px; inset-inline-end: 8px; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: var(--bg-secondary, #eee); opacity: 0.85; pointer-events: none; }`

`teardown()` runs on external parse errors too, so the handle is cleared whenever the map is gone.

- [ ] **Step 7: Pass export names**

- `MindmapView.vue`: add `const exportName = computed(() => props.tab.fileName.replace(/\.[^.]+$/u, ''));` and pass `:export-name="exportName"` to `MindmapCanvas`.
- `MindmapFenceOverlay.vue`: pass `export-name="mindmap"` (static) to its `MindmapCanvas`.

- [ ] **Step 8: Palette entries**

In `app/src/composables/useCommands.ts`:

1. Imports: `import { KEY_ACTIONS } from '../lib/keybindings';` (merge into the existing keybindings import if one exists) and `import { runActiveMindmapAction } from '../lib/mindmap-active';`. Reuse `useI18n` if it is already imported; otherwise add `import { useI18n } from '../i18n';` and `const { t } = useI18n();` beside the other store setup.
2. Inside `useCommands()`, before the `return [` that builds the list, add:
   ```ts
   const MINDMAP_CATEGORY = 'mindmap';
   const mindmapCommands: Command[] = KEY_ACTIONS.filter((a) => a.category === MINDMAP_CATEGORY).map((a) => ({
     id: a.id,
     title: a.label,
     shortcut: kb(a.id),
     run: () => { if (!runActiveMindmapAction(a.id)) toasts.info(t('mindmap.noActiveMap')); },
   }));
   ```
3. Spread `...mindmapCommands,` as the last element of the returned array.

This lists every current and future `mindmap.*` action. Later tasks only add `KEY_ACTIONS` rows.

- [ ] **Step 9: i18n**

Add to `en.ts` `mindmap`: `readOnlyBadge: 'Read-only'`, `noActiveMap: 'Click a mind map first'`, `copiedPlaintext: 'Mind map copied as plaintext'`.

- [ ] **Step 10: Run tests + build**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-active.test.ts src/lib/mindmap-keymap.test.ts && pnpm build`
Expected: PASS, build OK.

- [ ] **Step 11: Browser check**

Start `.claude/launch.json` → `solomd-web` (port 1420). Create a mindmap tab:

```js
const tabs = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('tabs');
const tab = tabs.newTab({ fileName: 'check.mmap' });
```

Click the map, open the palette, and confirm:

- 12 "Mindmap:" commands (4 existing + 8 new).
- "Toggle Read-Only" shows the badge, and Tab no longer adds a child.
- "Open as Markdown Headings" opens `check-outline.md` with `# ` lines.
- Export commands call `pickWritePath` (in the web build, Tauri `invoke` fails and a "Mind map export failed" toast appears; that proves the path ran).
- No console errors.

- [ ] **Step 12: Commit**

```bash
git add app/src/lib/mindmap-active.ts app/src/lib/mindmap-active.test.ts app/src/composables/useMindmapCanvasActions.ts app/src/components/MindmapCanvas.vue app/src/components/MindmapView.vue app/src/components/MindmapFenceOverlay.vue app/src/lib/keybindings.ts app/src/composables/useCommands.ts app/src/i18n/en.ts
git commit -m "feat(mindmap): palette commands, export/copy/headings actions, read-only toggle"
```

---

### Task 5: Jump to source

**Files:**
- Create: `app/src/lib/mindmap-source.ts`
- Test: `app/src/lib/mindmap-source.test.ts`
- Create: `app/src/composables/useMindmapJump.ts`
- Modify: `MindmapCanvas.vue`, `MindmapView.vue`, `MindmapFenceOverlay.vue`, `keybindings.ts`, `en.ts`

**Interfaces:**
- Consumes: `serializeMindmapFence` (`./mindmap-fence.ts`).
- Produces:
  - `interface MindmapSource { path?: string; line: number }` (1-based editor line; `path` absent = same tab)
  - `readNodeSource(node: NodeObj): MindmapSource | null`: reads `node.metadata.source` (written by Phase 5 conversion); requires an integer `line ≥ 1` and an optional string `path`
  - `plaintextNodeLines(plaintext: string): number[]`: 0-based indexes of node lines
  - `preorderIds(root: NodeObj): string[]`
  - `fenceNodeSource(data: MindElixirData, nodeId: string, fenceLine: number): MindmapSource | null`
  - Canvas prop `fenceLine?: number`; canvas emit `'jump-to-source': [source: MindmapSource]`
  - `useMindmapJump(): { jumpTo(source: MindmapSource, tabId: string): Promise<void> }`
  - Action id `mindmap.jumpToSource` (default `Mod+Alt+J`)

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/mindmap-source.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { fenceNodeSource, plaintextNodeLines, preorderIds, readNodeSource } from './mindmap-source.ts';
import { parseMindmapFence } from './mindmap-fence.ts';

const BODY = ['- Root', '  - Alpha [^a1]', '    - Child', '  - Beta', '    - B1', '    - B2', '    - }Sum', '  - Gamma [^b9]', '- > [^a1] <-lbl-> [^b9]'].join('\n');

test('node lines skip summary and arrow lines', () => {
  assert.deepEqual(plaintextNodeLines(BODY), [0, 1, 2, 3, 4, 5, 7]);
});

test('fence node source maps preorder index to editor line', () => {
  const parsed = parseMindmapFence(BODY);
  assert.ok(parsed.ok);
  const data: MindElixirData = parsed.data;
  const ids = preorderIds(data.nodeData);
  const gammaId = ids[ids.length - 1];
  const fenceLine = 10;
  assert.deepEqual(fenceNodeSource(data, gammaId, fenceLine), { line: fenceLine + 2 + 7 });
  assert.deepEqual(fenceNodeSource(data, data.nodeData.id, fenceLine), { line: fenceLine + 2 });
});

test('unknown node has no source', () => {
  const parsed = parseMindmapFence('- R\n  - A');
  assert.ok(parsed.ok);
  assert.equal(fenceNodeSource(parsed.data, 'missing', 0), null);
});

test('metadata source is validated', () => {
  assert.deepEqual(readNodeSource({ id: 'a', topic: 'A', metadata: { source: { path: '/n.md', line: 4 } } }), { path: '/n.md', line: 4 });
  assert.deepEqual(readNodeSource({ id: 'a', topic: 'A', metadata: { source: { line: 2 } } }), { line: 2 });
  assert.equal(readNodeSource({ id: 'a', topic: 'A', metadata: { source: { line: 0 } } }), null);
  assert.equal(readNodeSource({ id: 'a', topic: 'A', metadata: { source: { line: 2, path: 5 } } }), null);
  assert.equal(readNodeSource({ id: 'a', topic: 'A' }), null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-source.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/mindmap-source.ts
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { serializeMindmapFence } from './mindmap-fence.ts';

export interface MindmapSource { path?: string; line: number }

const NODE_LINE = /^\s*- /;
const NON_NODE_LINE = /^\s*- (?:\}|> )/;
const FENCE_BODY_OFFSET = 2;
const MIN_LINE = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readNodeSource(node: NodeObj): MindmapSource | null {
  const meta = node.metadata;
  const source = isRecord(meta) ? meta.source : undefined;
  if (!isRecord(source)) return null;
  const { line, path } = source;
  if (typeof line !== 'number' || !Number.isInteger(line) || line < MIN_LINE) return null;
  if (path !== undefined && typeof path !== 'string') return null;
  return path === undefined ? { line } : { path, line };
}

export function plaintextNodeLines(plaintext: string): number[] {
  return plaintext.split('\n').flatMap((line, i) => (NODE_LINE.test(line) && !NON_NODE_LINE.test(line) ? [i] : []));
}

export function preorderIds(root: NodeObj): string[] {
  return [root.id, ...(root.children ?? []).flatMap(preorderIds)];
}

export function fenceNodeSource(data: MindElixirData, nodeId: string, fenceLine: number): MindmapSource | null {
  const index = preorderIds(data.nodeData).indexOf(nodeId);
  const lines = plaintextNodeLines(serializeMindmapFence(data));
  if (index < 0 || index >= lines.length) return null;
  return { line: fenceLine + FENCE_BODY_OFFSET + lines[index] };
}
```

Known limitation (record it in the plan's Deviations if hit): a topic that itself starts with `}` or `> ` shifts the mapping.

Run the test again. Expected: PASS 4/4.

- [ ] **Step 4: Jump composable**

```ts
// app/src/composables/useMindmapJump.ts
import { nextTick } from 'vue';
import { useTabsStore } from '../stores/tabs';
import { useTilesStore } from '../stores/tiles';
import { useFiles } from './useFiles';
import type { MindmapSource } from '../lib/mindmap-source';

const GOTO_EVENT = 'solomd:outline-goto';

export function useMindmapJump() {
  const tabs = useTabsStore();
  const tiles = useTilesStore();
  const files = useFiles();

  async function jumpTo(source: MindmapSource, tabId: string): Promise<void> {
    if (source.path) await files.openPath(source.path);
    else tabs.activate(tabId);
    await nextTick();
    window.dispatchEvent(new CustomEvent(GOTO_EVENT, { detail: { line: source.line, paneId: tiles.focusedPaneId } }));
  }

  return { jumpTo };
}
```

Check the tiles store import path with `grep -rn "useTilesStore" app/src/App.vue`.

- [ ] **Step 5: Canvas action**

In `MindmapCanvas.vue`:

1. Import `fenceNodeSource, readNodeSource, type MindmapSource` from `../lib/mindmap-source`.
2. Props add `fenceLine?: number`. Emits add `'jump-to-source': [source: MindmapSource]`.
3. Add:
   ```ts
   function currentSource(): MindmapSource | null {
     const node = mind?.currentNode?.nodeObj;
     if (!mind || !node) return null;
     const stored = readNodeSource(node);
     if (stored) return stored;
     return props.fenceLine === undefined ? null : fenceNodeSource(mind.getData(), node.id, props.fenceLine);
   }

   function jumpToSource(): void {
     const source = currentSource();
     if (!source) return toasts.info(t('mindmap.noSource'));
     flushPendingSync();
     emit('jump-to-source', source);
   }
   ```
   Add `import { useToastsStore } from '../stores/toasts';` and `const toasts = useToastsStore();`.
4. Add `'mindmap.jumpToSource': jumpToSource,` to `actions`.

`flushPendingSync()` must run first: the fence line mapping assumes the note already holds the current map.

- [ ] **Step 6: Wrappers handle the jump**

- `MindmapFenceOverlay.vue`: import `useMindmapJump`, pass `:fence-line="target.line"` and `@jump-to-source="onJump"`:
  ```ts
  const { jumpTo } = useMindmapJump();
  function onJump(source: MindmapSource): void {
    const tabId = target.value?.tabId;
    if (!tabId) return;
    close();
    void jumpTo(source, tabId);
  }
  ```
- `MindmapView.vue`: `@jump-to-source="(s) => jumpTo(s, tab.id)"` with `const { jumpTo } = useMindmapJump();`. Only metadata sources reach it, since no `fenceLine` is passed.

- [ ] **Step 7: Keybinding + i18n**

`keybindings.ts`: `{ id: 'mindmap.jumpToSource', label: 'Mindmap: Jump to Source', category: 'mindmap', scope: 'mindmap', defaults: ['Mod+Alt+J'] },`
`en.ts`: `noSource: 'This node has no source location'`.

- [ ] **Step 8: Tests + build + browser check**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-source.test.ts src/lib/mindmap-fence.test.ts src/lib/mindmap-keymap.test.ts && pnpm build`

Browser:

1. Put a note with text above a ```` ```mindmap ```` fence.
2. Open fullscreen, select the third node, and run "Jump to Source" from the palette.
3. Expected: the overlay closes and the editor caret sits on that node's line.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/mindmap-source.ts app/src/lib/mindmap-source.test.ts app/src/composables/useMindmapJump.ts app/src/components/MindmapCanvas.vue app/src/components/MindmapView.vue app/src/components/MindmapFenceOverlay.vue app/src/lib/keybindings.ts app/src/i18n/en.ts
git commit -m "feat(mindmap): jump from node to source line"
```

---

### Task 6: Gate model (pure)

**Files:**
- Create: `app/src/lib/mindmap-gates.ts`
- Test: `app/src/lib/mindmap-gates.test.ts`

**Interfaces:**
- Produces:
  - `interface GateMeta { target: string; missingRef?: string }`
  - `GATE_LABEL_PREFIX = '⇒ '`
  - `readGate(node: NodeObj): GateMeta | null`: requires string `target` (may be `''` only when `missingRef` is a string)
  - `isGate(node: NodeObj): boolean`
  - `withGate(node: NodeObj, gate: GateMeta): NodeObj`: returns a copy with `metadata` merged (`refId` kept) and `children` removed
  - `makeGateNode(id: string, target: NodeObj): NodeObj`
  - `findNode(root: NodeObj, id: string): NodeObj | null`
  - `walkNodes(root: NodeObj): NodeObj[]` (preorder)
  - `gateLabel(gate: NodeObj, root: NodeObj, brokenLabel: string): string`
  - `isBrokenGate(gate: NodeObj, root: NodeObj): boolean`: target missing, or target is itself a gate
  - `canHoldChildren(node: NodeObj): boolean` (= `!isGate(node)`)
  - `canBeGateTarget(node: NodeObj): boolean` (= `!isGate(node)`)
  - `ancestorIds(root: NodeObj, id: string): string[] | null` (root first, excluding `id`; `null` if absent)
  - `withGateLabels(data: MindElixirData, brokenLabel: string): MindElixirData` (deep copy with gate topics set)

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/mindmap-gates.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData, NodeObj } from 'mind-elixir';
import {
  ancestorIds, canBeGateTarget, canHoldChildren, findNode, gateLabel, GATE_LABEL_PREFIX, isBrokenGate, isGate,
  makeGateNode, readGate, walkNodes, withGate, withGateLabels,
} from './mindmap-gates.ts';

const BROKEN = '⚠ broken';
const tree = (): NodeObj => ({
  id: 'r', topic: 'Root', children: [
    { id: 'a', topic: 'Alpha', metadata: { refId: 'a1' }, children: [{ id: 'a2', topic: 'Deep' }] },
    { id: 'g', topic: 'stale', metadata: { gate: { target: 'a2' } } },
  ],
});

test('readGate validates shape', () => {
  assert.deepEqual(readGate({ id: 'x', topic: '', metadata: { gate: { target: 'a' } } }), { target: 'a' });
  assert.deepEqual(readGate({ id: 'x', topic: '', metadata: { gate: { target: '', missingRef: 'q' } } }), { target: '', missingRef: 'q' });
  assert.equal(readGate({ id: 'x', topic: '', metadata: { gate: { target: 5 } } }), null);
  assert.equal(readGate({ id: 'x', topic: '', metadata: { gate: { target: '' } } }), null);
  assert.equal(readGate({ id: 'x', topic: '' }), null);
});

test('withGate merges metadata and drops children', () => {
  const node: NodeObj = { id: 'x', topic: 't', metadata: { refId: 'k' }, children: [{ id: 'c', topic: 'c' }] };
  const gate = withGate(node, { target: 'a' });
  assert.deepEqual(gate.metadata, { refId: 'k', gate: { target: 'a' } });
  assert.equal(gate.children, undefined);
  assert.equal(isGate(gate), true);
});

test('makeGateNode labels from target', () => {
  const g = makeGateNode('n1', { id: 'a', topic: 'Alpha' });
  assert.equal(g.topic, `${GATE_LABEL_PREFIX}Alpha`);
  assert.deepEqual(readGate(g), { target: 'a' });
});

test('find, walk, ancestors', () => {
  const root = tree();
  assert.equal(findNode(root, 'a2')?.topic, 'Deep');
  assert.equal(findNode(root, 'zz'), null);
  assert.deepEqual(walkNodes(root).map((n) => n.id), ['r', 'a', 'a2', 'g']);
  assert.deepEqual(ancestorIds(root, 'a2'), ['r', 'a']);
  assert.deepEqual(ancestorIds(root, 'r'), []);
  assert.equal(ancestorIds(root, 'zz'), null);
});

test('labels are live and broken gates are flagged', () => {
  const root = tree();
  const gate = findNode(root, 'g')!;
  assert.equal(gateLabel(gate, root, BROKEN), `${GATE_LABEL_PREFIX}Deep`);
  assert.equal(isBrokenGate(gate, root), false);
  root.children![0].children = [];
  assert.equal(gateLabel(gate, root, BROKEN), `${GATE_LABEL_PREFIX}${BROKEN}`);
  assert.equal(isBrokenGate(gate, root), true);
});

test('gate pointing at a gate is broken', () => {
  const root: NodeObj = { id: 'r', topic: 'R', children: [
    { id: 'g1', topic: '', metadata: { gate: { target: 'g2' } } },
    { id: 'g2', topic: '', metadata: { gate: { target: 'r' } } },
  ] };
  assert.equal(isBrokenGate(findNode(root, 'g1')!, root), true);
});

test('guards', () => {
  const root = tree();
  assert.equal(canHoldChildren(findNode(root, 'g')!), false);
  assert.equal(canHoldChildren(findNode(root, 'a')!), true);
  assert.equal(canBeGateTarget(findNode(root, 'g')!), false);
});

test('withGateLabels copies and labels', () => {
  const data: MindElixirData = { nodeData: tree() };
  const labelled = withGateLabels(data, BROKEN);
  assert.equal(findNode(labelled.nodeData, 'g')?.topic, `${GATE_LABEL_PREFIX}Deep`);
  assert.equal(findNode(data.nodeData, 'g')?.topic, 'stale');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-gates.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/mindmap-gates.ts
import type { MindElixirData, NodeObj } from 'mind-elixir';

export interface GateMeta { target: string; missingRef?: string }

export const GATE_LABEL_PREFIX = '⇒ ';

type Meta = Record<string, unknown>;

function isRecord(value: unknown): value is Meta {
  return typeof value === 'object' && value !== null;
}

function metaOf(node: NodeObj): Meta {
  return isRecord(node.metadata) ? node.metadata : {};
}

export function readGate(node: NodeObj): GateMeta | null {
  const gate = metaOf(node).gate;
  if (!isRecord(gate) || typeof gate.target !== 'string') return null;
  const missingRef = typeof gate.missingRef === 'string' ? gate.missingRef : undefined;
  if (gate.target === '' && missingRef === undefined) return null;
  return missingRef === undefined ? { target: gate.target } : { target: gate.target, missingRef };
}

export function isGate(node: NodeObj): boolean {
  return readGate(node) !== null;
}

export function withGate(node: NodeObj, gate: GateMeta): NodeObj {
  const { children: _dropped, ...rest } = node;
  return { ...rest, metadata: { ...metaOf(node), gate } };
}

export function makeGateNode(id: string, target: NodeObj): NodeObj {
  return withGate({ id, topic: GATE_LABEL_PREFIX + target.topic }, { target: target.id });
}

export function walkNodes(root: NodeObj): NodeObj[] {
  return [root, ...(root.children ?? []).flatMap(walkNodes)];
}

export function findNode(root: NodeObj, id: string): NodeObj | null {
  return walkNodes(root).find((n) => n.id === id) ?? null;
}

function liveTarget(gate: NodeObj, root: NodeObj): NodeObj | null {
  const meta = readGate(gate);
  const target = meta && meta.target !== '' ? findNode(root, meta.target) : null;
  return target && !isGate(target) ? target : null;
}

export function isBrokenGate(gate: NodeObj, root: NodeObj): boolean {
  return isGate(gate) && liveTarget(gate, root) === null;
}

export function gateLabel(gate: NodeObj, root: NodeObj, brokenLabel: string): string {
  return GATE_LABEL_PREFIX + (liveTarget(gate, root)?.topic ?? brokenLabel);
}

export function canHoldChildren(node: NodeObj): boolean {
  return !isGate(node);
}

export function canBeGateTarget(node: NodeObj): boolean {
  return !isGate(node);
}

export function ancestorIds(root: NodeObj, id: string): string[] | null {
  if (root.id === id) return [];
  for (const child of root.children ?? []) {
    const path = ancestorIds(child, id);
    if (path) return [root.id, ...path];
  }
  return null;
}

export function withGateLabels(data: MindElixirData, brokenLabel: string): MindElixirData {
  const copy: MindElixirData = structuredClone(data);
  for (const node of walkNodes(copy.nodeData)) if (isGate(node)) node.topic = gateLabel(node, copy.nodeData, brokenLabel);
  return copy;
}
```

`structuredClone` throws on `parent` back-references. Callers pass `getData()` output or parsed data, which never carries `parent`. If a reviewer worries, `JSON.parse(JSON.stringify(...))` is the equivalent fallback.

`_dropped` is the destructuring discard. If the project's lint flags unused vars, use `const rest = { ...node }; delete rest.children;` instead.

Run the test again. Expected: PASS 8/8.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/mindmap-gates.ts app/src/lib/mindmap-gates.test.ts
git commit -m "feat(mindmap): gate model with live labels and guards"
```

---

### Task 7: Gates on the live map

**Files:**
- Create: `app/src/lib/mindmap-gate-controller.ts`
- Modify: `app/src/components/MindmapCanvas.vue`, `app/src/lib/keybindings.ts`, `app/src/i18n/en.ts`

**Interfaces:**
- Consumes (Task 6): `readGate`, `isGate`, `withGate`, `makeGateNode`, `findNode`, `walkNodes`, `gateLabel`, `isBrokenGate`, `canHoldChildren`, `canBeGateTarget`, `ancestorIds`.
- Produces:
  - `interface GateControllerContext { getMind(): MindElixirInstance | null; isReadOnly(): boolean; brokenLabel(): string; notify(key: GateNotice): void; onChange(): void }`
  - `type GateNotice = 'gateMarked' | 'gateNoTarget' | 'gateTargetIsGate' | 'gateNotGate' | 'gateCannotHoldChildren'`
  - `createGateController(ctx: GateControllerContext): { actions: Record<string, () => void>; guards: Before; menu: ContextMenuItem[]; syncLabels(): void }`, where `ContextMenuItem = { name: string; onclick: () => void }` and `menu` is built from a `labels: Record<GateMenuAction, string>` argument (see Step 1)
  - Action ids: `mindmap.markGateTarget`, `mindmap.insertGate`, `mindmap.followGate` (`Alt+Enter`), `mindmap.gateBack` (`Alt+ArrowLeft`), `mindmap.repairGate`, `mindmap.removeGate`

Behavior (spec):

| Action | Rule |
|---|---|
| Mark target | Current node; rejects gates (`gateTargetIsGate`); stores id; `gateMarked` |
| Insert gate | Current node is the parent; rejects a gate parent (`gateCannotHoldChildren`); needs a live marked target (`gateNoTarget`); `mind.addChild(current, makeGateNode(newId, target))` |
| Follow | Current is a live gate → push gate id, expand collapsed ancestors of the target, select and scroll the target |
| Back | Pop id; select that node if it still exists |
| Repair | Current is a broken gate + live marked target → set `metadata.gate = { target }` |
| Remove | Current is a gate → `mind.removeNodes([current])` |
| Guards | `addChild`, `moveNodeIn`, `copyNode`, `copyNodes` return `false` when the destination is a gate |
| Live labels | After every operation and on mount, set each gate's topic to `gateLabel`; `mind.refresh()` only if any changed, then reselect the previous node |

- [ ] **Step 1: Implement the controller**

```ts
// app/src/lib/mindmap-gate-controller.ts
import type { MindElixirInstance, NodeObj, Topic } from 'mind-elixir';
import type { Before } from 'mind-elixir';
import {
  ancestorIds, canBeGateTarget, canHoldChildren, findNode, gateLabel, isBrokenGate, isGate, makeGateNode, readGate, walkNodes, withGate,
} from './mindmap-gates.ts';

export type GateNotice = 'gateMarked' | 'gateNoTarget' | 'gateTargetIsGate' | 'gateNotGate' | 'gateCannotHoldChildren';
export type GateMenuAction = 'mindmap.markGateTarget' | 'mindmap.insertGate' | 'mindmap.followGate' | 'mindmap.repairGate' | 'mindmap.removeGate';
export interface ContextMenuItem { name: string; onclick: () => void }
export interface GateControllerContext {
  getMind(): MindElixirInstance | null;
  isReadOnly(): boolean;
  brokenLabel(): string;
  notify(key: GateNotice): void;
  onChange(): void;
}

const GATE_ID_LENGTH = 16;
const MENU_ACTIONS: readonly GateMenuAction[] = ['mindmap.markGateTarget', 'mindmap.insertGate', 'mindmap.followGate', 'mindmap.repairGate', 'mindmap.removeGate'];

function newNodeId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, GATE_ID_LENGTH);
}

function isGateTopic(tpc: Topic | undefined): boolean {
  return tpc !== undefined && isGate(tpc.nodeObj);
}
```

Continue in the same file with the controller factory. Each inner function stays ≤ 20 lines:

```ts
export function createGateController(ctx: GateControllerContext, labels: Record<GateMenuAction, string>) {
  let markedId: string | null = null;
  const history: string[] = [];

  const mind = () => ctx.getMind();
  const current = (): NodeObj | null => mind()?.currentNode?.nodeObj ?? null;
  const root = (): NodeObj | null => mind()?.nodeData ?? null;
  const liveMarked = (): NodeObj | null => {
    const r = root();
    const node = r && markedId ? findNode(r, markedId) : null;
    return node && canBeGateTarget(node) ? node : null;
  };

  function select(id: string): void {
    const m = mind();
    const el = m?.findEle(id);
    if (!m || !el) return;
    m.selectNode(el);
    m.scrollIntoView(el, true);
  }

  function expandAncestors(id: string): void {
    const m = mind();
    const path = m ? ancestorIds(m.nodeData, id) : null;
    if (!m || !path) return;
    const collapsed = path.map((a) => findNode(m.nodeData, a)).filter((n): n is NodeObj => n?.expanded === false);
    if (collapsed.length === 0) return;
    for (const node of collapsed) node.expanded = true;
    m.refresh();
  }

  function markTarget(): void {
    const node = current();
    if (!node) return;
    if (!canBeGateTarget(node)) return ctx.notify('gateTargetIsGate');
    markedId = node.id;
    ctx.notify('gateMarked');
  }

  function insertGate(): void {
    const m = mind(); const parent = m?.currentNode;
    if (!m || !parent || ctx.isReadOnly()) return;
    if (!canHoldChildren(parent.nodeObj)) return ctx.notify('gateCannotHoldChildren');
    const target = liveMarked();
    if (!target) return ctx.notify('gateNoTarget');
    void m.addChild(parent, makeGateNode(newNodeId(), target));
  }

  function followGate(): void {
    const gate = current(); const r = root();
    if (!gate || !r || !isGate(gate)) return ctx.notify('gateNotGate');
    const meta = readGate(gate);
    if (!meta || isBrokenGate(gate, r)) return ctx.notify('gateNoTarget');
    history.push(gate.id);
    expandAncestors(meta.target);
    select(meta.target);
  }

  function gateBack(): void {
    const id = history.pop();
    if (id) select(id);
  }

  function repairGate(): void {
    const gate = current(); const r = root(); const target = liveMarked();
    if (!gate || !r || !isGate(gate) || ctx.isReadOnly()) return ctx.notify('gateNotGate');
    if (!target) return ctx.notify('gateNoTarget');
    Object.assign(gate, withGate(gate, { target: target.id }));
    syncLabels();
    ctx.onChange();
  }

  function removeGate(): void {
    const m = mind(); const tpc = m?.currentNode;
    if (!m || !tpc || ctx.isReadOnly()) return;
    if (!isGate(tpc.nodeObj)) return ctx.notify('gateNotGate');
    void m.removeNodes([tpc]);
  }

  function syncLabels(): void {
    const m = mind();
    if (!m) return;
    const stale = walkNodes(m.nodeData).filter((n) => isGate(n) && n.topic !== gateLabel(n, m.nodeData, ctx.brokenLabel()));
    if (stale.length === 0) return;
    for (const node of stale) node.topic = gateLabel(node, m.nodeData, ctx.brokenLabel());
    const selected = m.currentNode?.nodeObj.id;
    m.refresh();
    if (selected) select(selected);
  }

  const guards: Before = {
    addChild: (el) => canHoldChildren((el ?? mind()?.currentNode)?.nodeObj ?? { id: '', topic: '' }),
    moveNodeIn: (_from, to) => !isGateTopic(to),
    copyNode: (_node, to) => !isGateTopic(to),
    copyNodes: (_tpcs, to) => !isGateTopic(to),
  };

  const actions: Record<string, () => void> = {
    'mindmap.markGateTarget': markTarget,
    'mindmap.insertGate': insertGate,
    'mindmap.followGate': followGate,
    'mindmap.gateBack': gateBack,
    'mindmap.repairGate': repairGate,
    'mindmap.removeGate': removeGate,
  };
  const menu: ContextMenuItem[] = MENU_ACTIONS.map((id) => ({ name: labels[id], onclick: actions[id] }));
  return { actions, guards, menu, syncLabels };
}
```

`Object.assign(gate, withGate(...))` mutates the live node, so the map sees the new metadata; `withGate` drops `children`, and a gate never has any. `addChild`'s `Before` signature is `(el?: Topic, node?: NodeObj)`: when `el` is absent, core adds to `currentNode`.

- [ ] **Step 2: Wire into `MindmapCanvas.vue`**

1. Import `createGateController, type GateMenuAction, type GateNotice` from `../lib/mindmap-gate-controller`.
2. After `canvasActions`:
   ```ts
   const GATE_MENU_LABEL_KEYS: Record<GateMenuAction, string> = {
     'mindmap.markGateTarget': 'mindmap.gateMarkTarget',
     'mindmap.insertGate': 'mindmap.gateInsert',
     'mindmap.followGate': 'mindmap.gateFollow',
     'mindmap.repairGate': 'mindmap.gateRepair',
     'mindmap.removeGate': 'mindmap.gateRemove',
   };
   const gates = createGateController({
     getMind: () => mind,
     isReadOnly: () => isReadOnly.value,
     brokenLabel: () => t('mindmap.gateBroken'),
     notify: (key: GateNotice) => toasts.info(t(`mindmap.${key}`)),
     onChange: scheduleSync,
   }, Object.fromEntries(Object.entries(GATE_MENU_LABEL_KEYS).map(([id, key]) => [id, t(key)])) as Record<GateMenuAction, string>);
   ```
   If the `as Record<…>` cast bothers `vue-tsc` lint, build the record with an explicit loop over the five ids instead. No `any`.
3. Spread `...gates.actions,` into `actions`.
4. `mount()` options: `contextMenu: { extend: gates.menu },` and `before: gates.guards,`. After `mind.init(data);` call `gates.syncLabels();`.
5. `onOperation`: after the `BEGIN_EDIT_OPERATION` guard, call `gates.syncLabels();` before `scheduleSync();`.
6. `applyExternalContent()`: after `mind.refresh(data);` call `gates.syncLabels();`.

Note: `syncLabels()` → `refresh()` does not emit `operation`, so there is no loop.

- [ ] **Step 3: Read-only preview shows labels**

In `app/src/lib/mindmap-readonly.ts`, change `mind.init(parsed.data);` to `mind.init(withGateLabels(parsed.data, brokenLabel));`. Add a `brokenLabel: string` parameter after `isDark` and update the callers (`grep -rn "mountReadOnlyMindmap(" app/src`) to pass `t('mindmap.gateBroken')`. `cm-live-blocks.ts` gets its strings through `getMindmapStrings` (see Phase 3 plan), so add `gateBroken` to that strings object rather than importing i18n there.

- [ ] **Step 4: Keybindings + i18n**

`keybindings.ts`:

```ts
  { id: 'mindmap.markGateTarget', label: 'Mindmap: Mark Gate Target', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.insertGate', label: 'Mindmap: Insert Gate to Marked Node', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.followGate', label: 'Mindmap: Follow Gate', category: 'mindmap', scope: 'mindmap', defaults: ['Alt+Enter'] },
  { id: 'mindmap.gateBack', label: 'Mindmap: Back from Gate', category: 'mindmap', scope: 'mindmap', defaults: ['Alt+ArrowLeft'] },
  { id: 'mindmap.repairGate', label: 'Mindmap: Repair Gate to Marked Node', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.removeGate', label: 'Mindmap: Remove Gate', category: 'mindmap', scope: 'mindmap', defaults: [] },
```

`en.ts` `mindmap`:

```ts
    gateBroken: '⚠ missing target',
    gateMarked: 'Gate target marked',
    gateNoTarget: 'Mark a target node first (or the target is gone)',
    gateTargetIsGate: 'A gate cannot target another gate',
    gateNotGate: 'Select a gate first',
    gateCannotHoldChildren: 'Gates cannot have children',
    gateMarkTarget: 'Mark as gate target',
    gateInsert: 'Insert gate to marked node',
    gateFollow: 'Follow gate',
    gateRepair: 'Repair gate',
    gateRemove: 'Remove gate',
```

- [ ] **Step 5: Tests + build**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-gates.test.ts src/lib/mindmap-keymap.test.ts && pnpm build`
Expected: PASS, build OK.

- [ ] **Step 6: Browser check (`check.mmap` tab)**

1. Select "Alpha" → right-click → "Mark as gate target"; select root → "Insert gate to marked node". A `⇒ Alpha` leaf appears.
2. Rename Alpha to "Alef". The gate reads `⇒ Alef` with no reload.
3. Select the gate, press Tab. No child is added; toast "Gates cannot have children". Drag a node onto the gate; it is refused.
4. Collapse Alef's parent branch, select the gate, press Alt+Enter. The branch expands and Alef is selected. Alt+← reselects the gate.
5. Delete Alef. The gate shows `⇒ ⚠ missing target`. Mark another node → "Repair gate" → the label updates. "Remove gate" deletes it.
6. Reload (save first). The gate persists (`metadata.gate` in the `.mmap` JSON).

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/mindmap-gate-controller.ts app/src/components/MindmapCanvas.vue app/src/lib/mindmap-readonly.ts app/src/lib/cm-live-blocks.ts app/src/components/Preview.vue app/src/components/Editor.vue app/src/lib/keybindings.ts app/src/i18n/en.ts
git commit -m "feat(mindmap): same-map gates with follow/back, guards and live labels"
```

(Stage only the files you actually changed.)

---

### Task 8: Gate fence syntax `- => <ref>`

**Files:**
- Create: `app/src/lib/mindmap-gate-plaintext.ts`
- Test: `app/src/lib/mindmap-gate-plaintext.test.ts`
- Modify: `app/src/lib/mindmap-fence.ts` (`parseMindmapFence`, `serializeMindmapFence`)
- Modify: `app/src/lib/mindmap-fence.test.ts` (one round-trip case)

**Interfaces:**
- Consumes (Task 6): `readGate`, `withGate`, `walkNodes`, `findNode`.
- Produces:
  - `GATE_TOPIC_PATTERN = /^=>\s*([\w-]+)$/u`
  - `attachGatesFromTopics(data: MindElixirData): MindElixirData`: after core parse, every node whose topic matches becomes a gate. `refId` → node id; an unknown ref becomes `{ target: '', missingRef: ref }`.
  - `gatesToTopics(data: MindElixirData): MindElixirData`: before core serialize, on a deep copy, every gate's topic becomes `=> <ref>`. A live target gets `metadata.refId ??= target.id`; an unresolved gate uses `missingRef`.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/mindmap-gate-plaintext.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { mindElixirToPlaintext, plaintextToMindElixir } from 'mind-elixir/plaintextConverter';
import { attachGatesFromTopics, gatesToTopics } from './mindmap-gate-plaintext.ts';
import { findNode, readGate, walkNodes } from './mindmap-gates.ts';

const ROOT = 'Mind Map';
const parse = (text: string): MindElixirData => attachGatesFromTopics(plaintextToMindElixir(text, ROOT));

test('=> ref becomes a gate to the anchored node', () => {
  const data = parse('- Root\n  - Alpha [^a1]\n  - => a1');
  const alpha = walkNodes(data.nodeData).find((n) => n.topic === 'Alpha')!;
  const gate = data.nodeData.children![1];
  assert.deepEqual(readGate(gate), { target: alpha.id });
});

test('unknown ref keeps missingRef and round-trips', () => {
  const data = parse('- Root\n  - => ghost');
  assert.deepEqual(readGate(data.nodeData.children![0]), { target: '', missingRef: 'ghost' });
  assert.ok(mindElixirToPlaintext(gatesToTopics(data)).includes('- => ghost'));
});

test('serialize writes => ref and adds a refId to unanchored targets', () => {
  const data: MindElixirData = { nodeData: { id: 'r', topic: 'Root', children: [
    { id: 'abc123', topic: 'Alpha' },
    { id: 'g', topic: '⇒ Alpha', metadata: { gate: { target: 'abc123' } } },
  ] } };
  const text = mindElixirToPlaintext(gatesToTopics(data));
  assert.ok(text.includes('- Alpha [^abc123]'));
  assert.ok(text.includes('- => abc123'));
  assert.equal(findNode(data.nodeData, 'abc123')?.metadata, undefined, 'input not mutated');
});

test('existing refId is reused and survives a full round-trip', () => {
  const first = parse('- Root\n  - Alpha [^a1]\n  - => a1');
  const text = mindElixirToPlaintext(gatesToTopics(first));
  assert.ok(text.includes('[^a1]') && text.includes('- => a1'));
  const again = parse(text);
  const alpha = walkNodes(again.nodeData).find((n) => n.topic === 'Alpha')!;
  assert.equal(readGate(walkNodes(again.nodeData).find((n) => readGate(n) !== null)!)?.target, alpha.id);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-gate-plaintext.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/mindmap-gate-plaintext.ts
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { findNode, readGate, walkNodes, withGate } from './mindmap-gates.ts';

export const GATE_TOPIC_PATTERN = /^=>\s*([\w-]+)$/u;
const GATE_TOPIC_PREFIX = '=> ';

function refIdOf(node: NodeObj): string | undefined {
  const meta = node.metadata as { refId?: unknown } | undefined;
  return typeof meta?.refId === 'string' ? meta.refId : undefined;
}

function refIndex(root: NodeObj): Map<string, string> {
  const index = new Map<string, string>();
  for (const node of walkNodes(root)) {
    const ref = refIdOf(node);
    if (ref) index.set(ref, node.id);
  }
  return index;
}

export function attachGatesFromTopics(data: MindElixirData): MindElixirData {
  const copy: MindElixirData = structuredClone(data);
  const refs = refIndex(copy.nodeData);
  for (const node of walkNodes(copy.nodeData)) {
    const ref = GATE_TOPIC_PATTERN.exec(node.topic.trim())?.[1];
    if (!ref) continue;
    const target = refs.get(ref);
    Object.assign(node, withGate(node, target ? { target } : { target: '', missingRef: ref }));
  }
  return copy;
}

function ensureRef(target: NodeObj): string {
  const existing = refIdOf(target);
  if (existing) return existing;
  target.metadata = { ...(target.metadata as object | undefined), refId: target.id };
  return target.id;
}

export function gatesToTopics(data: MindElixirData): MindElixirData {
  const copy: MindElixirData = structuredClone(data);
  for (const node of walkNodes(copy.nodeData)) {
    const gate = readGate(node);
    if (!gate) continue;
    const target = gate.target ? findNode(copy.nodeData, gate.target) : null;
    const ref = target ? ensureRef(target) : gate.missingRef;
    if (ref) node.topic = GATE_TOPIC_PREFIX + ref;
  }
  return copy;
}
```

Type `metadata` access without `as` casts if `vue-tsc` allows it: `NodeObj<M>` defaults `M` to `unknown`, so narrow with the `isRecord` helper (copy it from `mindmap-gates.ts` or export it from there; exporting it is preferred, DRY).

Run the test. Expected: PASS 4/4.

- [ ] **Step 4: Use in the fence codec**

In `app/src/lib/mindmap-fence.ts`:

```ts
import { attachGatesFromTopics, gatesToTopics } from './mindmap-gate-plaintext.ts';
// parseMindmapFence success branch:
    return { ok: true, data: attachGatesFromTopics(sanitizeMindmapData(plaintextToMindElixir(text, MINDMAP_FENCE_ROOT_TOPIC))), isEmpty: false };
// serializeMindmapFence:
  return normalizeFenceBody(mindElixirToPlaintext(gatesToTopics(sanitizeMindmapData(data))));
```

Append to `app/src/lib/mindmap-fence.test.ts`:

```ts
test('gate lines round-trip through the fence codec', () => {
  const parsed = parseMindmapFence('- Root\n  - Alpha [^a1]\n  - => a1');
  assert.ok(parsed.ok);
  assert.equal(serializeMindmapFence(parsed.data), '- Root\n  - Alpha [^a1]\n  - => a1');
});
```

(Match the file's existing import names for `test`, `assert`, `parseMindmapFence`, `serializeMindmapFence`.)

- [ ] **Step 5: Run all mindmap lib tests**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-gate-plaintext.test.ts src/lib/mindmap-fence.test.ts src/lib/mindmap-source.test.ts src/lib/mindmap-gates.test.ts src/lib/fence-scan.test.ts`
Expected: all PASS.

- [ ] **Step 6: Build + browser check**

Run: `cd app && pnpm build`. Browser:

1. Write a note with the fence `- Root\n  - Alpha [^a1]\n  - => a1`.
2. Preview shows `⇒ Alpha`.
3. In fullscreen, follow the gate (Alt+Enter) and add a child to Alpha.
4. The note keeps `- => a1` and `[^a1]`.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/mindmap-gate-plaintext.ts app/src/lib/mindmap-gate-plaintext.test.ts app/src/lib/mindmap-fence.ts app/src/lib/mindmap-fence.test.ts app/src/lib/mindmap-gates.ts
git commit -m "feat(mindmap): '- => ref' gate syntax in mindmap fences"
```

---

### Task 9: Duplicate finder + Merge into gate

**Files:**
- Create: `app/src/lib/mindmap-duplicates.ts`
- Test: `app/src/lib/mindmap-duplicates.test.ts`
- Create: `app/src/components/MindmapDuplicates.vue`
- Modify: `MindmapCanvas.vue`, `keybindings.ts`, `en.ts`

**Interfaces:**
- Consumes (Task 6): `isGate`, `walkNodes`, `findNode`, `ancestorIds`, `makeGateNode`.
- Produces:
  - `normalizeTopic(topic: string): string` (trim, collapse whitespace, lowercase)
  - `subtreeHash(node: NodeObj): string`: FNV-1a 32-bit hex of the canonical `topic(child,child…)` string; a gate hashes as `=>target`
  - `interface DuplicateGroup { key: string; ids: string[] }`: nodes with equal normalized topic, excluding root and gates, ≥ 2 members, ≥ 1 member has children; groups ordered by first preorder position, ids in preorder
  - `mergeIntoGate(data: MindElixirData, keepId: string, dupId: string): MindElixirData | null`:
    - Returns a copy. The duplicate's children whose `subtreeHash` is absent from keep's children are appended to keep.
    - The duplicate is replaced in place by `makeGateNode(dupId, keep)`.
    - Arrows and summaries referencing ids no longer present are dropped.
    - Returns `null` when the ids are equal, either is missing, or one is an ancestor of the other.
  - `findDuplicateGroups(root: NodeObj): DuplicateGroup[]`
  - Action `mindmap.findDuplicates`

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/mindmap-duplicates.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { findDuplicateGroups, mergeIntoGate, normalizeTopic, subtreeHash } from './mindmap-duplicates.ts';
import { findNode, readGate } from './mindmap-gates.ts';

const data = (): MindElixirData => ({
  nodeData: { id: 'r', topic: 'Root', children: [
    { id: 'k', topic: 'Tasks', children: [{ id: 'k1', topic: 'A' }] },
    { id: 'x', topic: 'Other', children: [
      { id: 'd', topic: ' tasks ', children: [{ id: 'd1', topic: 'a' }, { id: 'd2', topic: 'B' }] },
    ] },
  ] },
  arrows: [{ id: 'ar', label: '', from: 'd1', to: 'x' }, { id: 'ok', label: '', from: 'd2', to: 'k' }],
});

test('normalizeTopic and hash ignore case and spacing', () => {
  assert.equal(normalizeTopic('  Hello   World '), 'hello world');
  assert.equal(subtreeHash({ id: '1', topic: 'A', children: [{ id: '2', topic: 'b' }] }), subtreeHash({ id: '3', topic: ' a', children: [{ id: '4', topic: 'B' }] }));
  assert.notEqual(subtreeHash({ id: '1', topic: 'A' }), subtreeHash({ id: '1', topic: 'B' }));
});

test('groups by normalized topic, needs a member with children', () => {
  assert.deepEqual(findDuplicateGroups(data().nodeData).map((g) => g.ids), [['k', 'd']]);
  assert.deepEqual(findDuplicateGroups({ id: 'r', topic: 'R', children: [{ id: 'a', topic: 'x' }, { id: 'b', topic: 'x' }] }), []);
});

test('merge unions children, replaces duplicate with a gate, drops dangling arrows', () => {
  const merged = mergeIntoGate(data(), 'k', 'd');
  assert.ok(merged);
  assert.deepEqual(findNode(merged.nodeData, 'k')!.children!.map((c) => c.id), ['k1', 'd2']);
  const gate = findNode(merged.nodeData, 'd')!;
  assert.deepEqual(readGate(gate), { target: 'k' });
  assert.equal(gate.children, undefined);
  assert.deepEqual(merged.arrows!.map((a) => a.id), ['ok']);
});

test('merge refuses ancestor pairs and missing ids', () => {
  const nested: MindElixirData = { nodeData: { id: 'r', topic: 'R', children: [{ id: 'p', topic: 'T', children: [{ id: 'c', topic: 'T' }] }] } };
  assert.equal(mergeIntoGate(nested, 'p', 'c'), null);
  assert.equal(mergeIntoGate(nested, 'c', 'p'), null);
  assert.equal(mergeIntoGate(nested, 'p', 'zz'), null);
  assert.equal(mergeIntoGate(nested, 'p', 'p'), null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-duplicates.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/mindmap-duplicates.ts
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { ancestorIds, findNode, isGate, makeGateNode, readGate, walkNodes } from './mindmap-gates.ts';

export interface DuplicateGroup { key: string; ids: string[] }

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX_RADIX = 16;
const MIN_GROUP_SIZE = 2;
const WHITESPACE = /\s+/g;

export function normalizeTopic(topic: string): string {
  return topic.trim().replace(WHITESPACE, ' ').toLowerCase();
}

function fnv1a(text: string): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), FNV_PRIME) >>> 0;
  return hash.toString(HEX_RADIX);
}

function canonical(node: NodeObj): string {
  const gate = readGate(node);
  if (gate) return `=>${gate.target || gate.missingRef}`;
  return `${normalizeTopic(node.topic)}(${(node.children ?? []).map(canonical).join(',')})`;
}

export function subtreeHash(node: NodeObj): string {
  return fnv1a(canonical(node));
}

export function findDuplicateGroups(root: NodeObj): DuplicateGroup[] {
  const groups = new Map<string, NodeObj[]>();
  for (const node of walkNodes(root).slice(1)) {
    if (isGate(node)) continue;
    const key = normalizeTopic(node.topic);
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }
  return [...groups.entries()]
    .filter(([, nodes]) => nodes.length >= MIN_GROUP_SIZE && nodes.some((n) => (n.children?.length ?? 0) > 0))
    .map(([key, nodes]) => ({ key, ids: nodes.map((n) => n.id) }));
}
```

Continue with merge (same file):

```ts
function isMergeable(root: NodeObj, keepId: string, dupId: string): boolean {
  if (keepId === dupId || !findNode(root, keepId) || !findNode(root, dupId)) return false;
  return !ancestorIds(root, dupId)!.includes(keepId) && !ancestorIds(root, keepId)!.includes(dupId);
}

function parentOf(root: NodeObj, id: string): NodeObj | null {
  return walkNodes(root).find((n) => n.children?.some((c) => c.id === id)) ?? null;
}

function unionChildren(keep: NodeObj, dup: NodeObj): void {
  const known = new Set((keep.children ?? []).map(subtreeHash));
  const extra = (dup.children ?? []).filter((c) => !known.has(subtreeHash(c)));
  if (extra.length > 0) keep.children = [...(keep.children ?? []), ...extra];
}

function pruneLinks(data: MindElixirData): void {
  const ids = new Set(walkNodes(data.nodeData).map((n) => n.id));
  if (data.arrows) data.arrows = data.arrows.filter((a) => ids.has(a.from) && ids.has(a.to));
  if (data.summaries) data.summaries = data.summaries.filter((s) => ids.has(s.parent));
}

export function mergeIntoGate(data: MindElixirData, keepId: string, dupId: string): MindElixirData | null {
  if (!isMergeable(data.nodeData, keepId, dupId)) return null;
  const copy: MindElixirData = structuredClone(data);
  const keep = findNode(copy.nodeData, keepId)!;
  const dup = findNode(copy.nodeData, dupId)!;
  const parent = parentOf(copy.nodeData, dupId)!;
  unionChildren(keep, dup);
  parent.children = parent.children!.map((c) => (c.id === dupId ? makeGateNode(dupId, keep) : c));
  pruneLinks(copy);
  return copy;
}
```

Summary `start`/`end` indexes under `dup` die with `dup`'s children; summaries whose `parent` is `dup` are pruned because `dup` survives only as a leaf. Extend `pruneLinks` with `&& s.parent !== dupId` (pass `dupId` in) and add one test case for it.

Run the test. Expected: PASS 4/4 (5/5 after the summary case).

- [ ] **Step 4: Dialog component**

```vue
<!-- app/src/components/MindmapDuplicates.vue -->
<script setup lang="ts">
import { useI18n } from '../i18n';
import type { DuplicateGroup } from '../lib/mindmap-duplicates';

defineProps<{ groups: DuplicateGroup[]; topicOf: (id: string) => string }>();
const emit = defineEmits<{ merge: [keepId: string, dupId: string]; close: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="mindmap-dups" role="dialog" :aria-label="t('mindmap.duplicatesTitle')" @keydown.escape.stop="emit('close')">
    <header>
      <h3>{{ t('mindmap.duplicatesTitle') }}</h3>
      <button type="button" @click="emit('close')">{{ t('mindmap.close') }}</button>
    </header>
    <p v-if="groups.length === 0">{{ t('mindmap.duplicatesEmpty') }}</p>
    <ul v-else>
      <li v-for="group in groups" :key="group.key">
        <strong>{{ topicOf(group.ids[0]) }}</strong> × {{ group.ids.length }}
        <button v-for="dupId in group.ids.slice(1)" :key="dupId" type="button" @click="emit('merge', group.ids[0], dupId)">
          {{ t('mindmap.mergeIntoGate') }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.mindmap-dups { position: absolute; inset-block-start: 40px; inset-inline-end: 16px; max-height: 60%; overflow: auto; padding: 12px 16px; border-radius: 8px; background: var(--bg-primary, #fff); box-shadow: 0 4px 16px rgb(0 0 0 / 0.2); z-index: 10; unicode-bidi: plaintext; }
.mindmap-dups header { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.mindmap-dups li { display: flex; gap: 8px; align-items: center; padding-block: 4px; }
</style>
```

- [ ] **Step 5: Canvas wiring**

In `MindmapCanvas.vue`:

```ts
import MindmapDuplicates from './MindmapDuplicates.vue';
import { findDuplicateGroups, mergeIntoGate, type DuplicateGroup } from '../lib/mindmap-duplicates';
import { findNode } from '../lib/mindmap-gates';

const duplicateGroups = ref<DuplicateGroup[] | null>(null);

function findDuplicates(): void {
  if (mind) duplicateGroups.value = findDuplicateGroups(mind.nodeData);
}

function topicOf(id: string): string {
  return (mind && findNode(mind.nodeData, id)?.topic) ?? '';
}

function mergeDuplicate(keepId: string, dupId: string): void {
  if (!mind || isReadOnly.value) return;
  const merged = mergeIntoGate(mind.getData(), keepId, dupId);
  if (!merged) return;
  mind.refresh(merged);
  gates.syncLabels();
  scheduleSync();
  findDuplicates();
}
```

Add `'mindmap.findDuplicates': findDuplicates,` to `actions`. In the template, before `<MindmapShortcutHelp …>`:

```html
<MindmapDuplicates v-if="duplicateGroups" :groups="duplicateGroups" :topic-of="topicOf" @merge="mergeDuplicate" @close="duplicateGroups = null" />
```

`mind.refresh(data)` is not undoable in Mind Elixir 5. That is acceptable for an explicit merge command. Note it in Deviations.

- [ ] **Step 6: Keybinding + i18n**

`keybindings.ts`: `{ id: 'mindmap.findDuplicates', label: 'Mindmap: Find Duplicates', category: 'mindmap', scope: 'mindmap', defaults: [] },`
`en.ts`: `duplicatesTitle: 'Duplicate nodes'`, `duplicatesEmpty: 'No duplicates found'`, `mergeIntoGate: 'Merge into gate'`.

- [ ] **Step 7: Tests + build + browser check**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-duplicates.test.ts && pnpm build`

Browser:

1. Build a map with two "Tasks" branches.
2. Palette → Find Duplicates → Merge into gate.
3. The second branch becomes `⇒ Tasks`, and its unique children move under the first.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/mindmap-duplicates.ts app/src/lib/mindmap-duplicates.test.ts app/src/components/MindmapDuplicates.vue app/src/components/MindmapCanvas.vue app/src/lib/keybindings.ts app/src/i18n/en.ts
git commit -m "feat(mindmap): duplicate finder with merge into gate"
```

---

### Task 10: Graph view + Mermaid / JSON adjacency export

**Files:**
- Create: `app/src/lib/mindmap-graph.ts`
- Test: `app/src/lib/mindmap-graph.test.ts`
- Modify: `app/src/lib/mindmap-export.ts` (+ its test), `useMindmapCanvasActions.ts`, `MindmapCanvas.vue`, `keybindings.ts`, `en.ts`

**Interfaces:**
- Consumes (Task 6): `walkNodes`, `readGate`, `isBrokenGate`.
- Produces:
  - `GATE_ARROW_PREFIX = 'gate-arrow-'`
  - `gateArrows(data: MindElixirData): Arrow[]`: one dashed arrow per live gate, `id = GATE_ARROW_PREFIX + gate.id`, `style: { strokeDasharray: '6 4' }`, `label: ''`
  - `withGateArrows(data: MindElixirData): MindElixirData`
  - `toMermaid(data: MindElixirData): string`: `graph LR`, nodes `n<i>["label"]` in preorder, tree edges `-->`, gate edges `-.->`
  - `toAdjacency(data: MindElixirData): { nodes: { id: string; topic: string; isGate: boolean }[]; edges: { from: string; to: string; kind: 'child' | 'gate' }[] }`
  - `MindmapTextFormat` gains `'mermaid' | 'adjacency'` (extensions `mmd`, `json` named `<base>-graph.json` via `exportFileName` special-case, see Step 4)
  - Actions `mindmap.toggleGraphView`, `mindmap.exportMermaid`, `mindmap.exportAdjacency`

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/mindmap-graph.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { gateArrows, GATE_ARROW_PREFIX, toAdjacency, toMermaid, withGateArrows } from './mindmap-graph.ts';

const data = (): MindElixirData => ({
  nodeData: { id: 'r', topic: 'Root "q"', children: [
    { id: 'a', topic: 'A <b>' },
    { id: 'g', topic: '⇒ A', metadata: { gate: { target: 'a' } } },
    { id: 'x', topic: 'broken', metadata: { gate: { target: 'gone' } } },
  ] },
  arrows: [{ id: 'user', label: 'l', from: 'a', to: 'r' }],
});

test('gate arrows only for live gates', () => {
  assert.deepEqual(gateArrows(data()).map((a) => [a.id, a.from, a.to]), [[`${GATE_ARROW_PREFIX}g`, 'g', 'a']]);
});

test('withGateArrows keeps user arrows and copies', () => {
  const src = data();
  const out = withGateArrows(src);
  assert.deepEqual(out.arrows!.map((a) => a.id), ['user', `${GATE_ARROW_PREFIX}g`]);
  assert.equal(src.arrows!.length, 1);
});

test('mermaid escapes labels and dashes gate edges', () => {
  const text = toMermaid(data());
  assert.equal(text.split('\n')[0], 'graph LR');
  assert.ok(text.includes('n0["Root #quot;q#quot;"]'));
  assert.ok(text.includes('n1["A #lt;b#gt;"]'));
  assert.ok(text.includes('n0 --> n1'));
  assert.ok(text.includes('n2 -.-> n1'));
  assert.equal(text.includes('n3 -.->'), false);
});

test('adjacency lists child and gate edges', () => {
  const adj = toAdjacency(data());
  assert.equal(adj.nodes.length, 4);
  assert.deepEqual(adj.nodes.find((n) => n.id === 'g'), { id: 'g', topic: '⇒ A', isGate: true });
  assert.deepEqual(adj.edges.filter((e) => e.kind === 'gate'), [{ from: 'g', to: 'a', kind: 'gate' }]);
  assert.equal(adj.edges.filter((e) => e.kind === 'child').length, 3);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-graph.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/mindmap-graph.ts
import type { Arrow, MindElixirData, NodeObj } from 'mind-elixir';
import { isBrokenGate, readGate, walkNodes } from './mindmap-gates.ts';

export const GATE_ARROW_PREFIX = 'gate-arrow-';
const GATE_DASH = '6 4';
const MERMAID_HEADER = 'graph LR';
const MERMAID_ESCAPES: Record<string, string> = { '"': '#quot;', '<': '#lt;', '>': '#gt;' };
const MERMAID_UNSAFE = /["<>]/g;
const LINE_BREAKS = /\s*\r?\n\s*/g;

type Edge = { from: string; to: string; kind: 'child' | 'gate' };

function liveGates(root: NodeObj): { gate: NodeObj; target: string }[] {
  return walkNodes(root)
    .filter((n) => readGate(n) !== null && !isBrokenGate(n, root))
    .map((gate) => ({ gate, target: readGate(gate)!.target }));
}

export function gateArrows(data: MindElixirData): Arrow[] {
  return liveGates(data.nodeData).map(({ gate, target }) => ({
    id: GATE_ARROW_PREFIX + gate.id, label: '', from: gate.id, to: target, style: { strokeDasharray: GATE_DASH },
  }));
}

export function withGateArrows(data: MindElixirData): MindElixirData {
  const copy: MindElixirData = structuredClone(data);
  copy.arrows = [...(copy.arrows ?? []), ...gateArrows(data)];
  return copy;
}

function edges(root: NodeObj): Edge[] {
  const tree = walkNodes(root).flatMap((n) => (n.children ?? []).map((c): Edge => ({ from: n.id, to: c.id, kind: 'child' })));
  const gates = liveGates(root).map(({ gate, target }): Edge => ({ from: gate.id, to: target, kind: 'gate' }));
  return [...tree, ...gates];
}

function mermaidLabel(topic: string): string {
  return topic.replace(LINE_BREAKS, ' ').replace(MERMAID_UNSAFE, (ch) => MERMAID_ESCAPES[ch]);
}

export function toMermaid(data: MindElixirData): string {
  const nodes = walkNodes(data.nodeData);
  const alias = new Map(nodes.map((n, i) => [n.id, `n${i}`]));
  const decls = nodes.map((n) => `  ${alias.get(n.id)}["${mermaidLabel(n.topic)}"]`);
  const links = edges(data.nodeData).map((e) => `  ${alias.get(e.from)} ${e.kind === 'gate' ? '-.->' : '-->'} ${alias.get(e.to)}`);
  return [MERMAID_HEADER, ...decls, ...links].join('\n') + '\n';
}

export function toAdjacency(data: MindElixirData) {
  return {
    nodes: walkNodes(data.nodeData).map((n) => ({ id: n.id, topic: n.topic, isGate: readGate(n) !== null })),
    edges: edges(data.nodeData),
  };
}
```

Give `toAdjacency` an explicit return type (`MindmapAdjacency` interface exported from this file); the project requires full signatures.

Note on the test: `mermaidLabel` replaces newlines in topics, but the declaration test asserts `text.split('\n')[0]`. Topics with newlines are flattened, so lines stay one-per-declaration.

Run the test. Expected: PASS 4/4.

- [ ] **Step 4: Register text formats**

In `mindmap-export.ts`:

1. `export type MindmapTextFormat = 'html' | 'json' | 'markdown' | 'mermaid' | 'adjacency';`
2. `MINDMAP_EXPORT_SPECS` add `mermaid: { extension: 'mmd', filterName: 'Mermaid' }`, `adjacency: { extension: 'graph.json', filterName: 'JSON' }`. The dialog filter uses `extensions: [spec.extension]`, so for adjacency pass `['json']`: add an optional `filterExtension?: string` to the spec type, set `filterExtension: 'json'` on adjacency, and in `useMindmapExport` use `spec.filterExtension ?? spec.extension`.
3. `TEXT_EXPORTERS` add `mermaid: (data) => toMermaid(sanitizeMindmapData(data))` and `adjacency: (data) => JSON.stringify(toAdjacency(sanitizeMindmapData(data)), null, JSON_INDENT)`; import from `./mindmap-graph.ts`.
4. Extend `mindmap-export.test.ts`:
   ```ts
   test('graph text formats', () => {
     assert.equal(exportFileName('plan', 'adjacency'), 'plan.graph.json');
     assert.ok(buildTextExport(data('A'), 'mermaid').startsWith('graph LR\n'));
     assert.equal(JSON.parse(buildTextExport(data('A'), 'adjacency')).nodes.length, 4);
   });
   ```

- [ ] **Step 5: Export actions**

In `useMindmapCanvasActions.ts`, `EXPORT_ACTIONS` add `'mindmap.exportMermaid': 'mermaid'` and `'mindmap.exportAdjacency': 'adjacency'`.

- [ ] **Step 6: Graph view toggle in `MindmapCanvas.vue`**

```ts
import { withGateArrows } from '../lib/mindmap-graph';

const isGraphView = ref(false);
let graphBaseline: MindElixirData | null = null;

function enterGraphView(instance: MindElixirInstance): void {
  flushPendingSync();
  graphBaseline = instance.getData();
  instance.disableEdit();
  instance.refresh(withGateArrows(graphBaseline));
  isGraphView.value = true;
}

function leaveGraphView(instance: MindElixirInstance): void {
  if (graphBaseline) instance.refresh(graphBaseline);
  graphBaseline = null;
  isGraphView.value = false;
  if (!isReadOnly.value) instance.enableEdit();
}

function toggleGraphView(): void {
  if (!mind) return;
  if (isGraphView.value) leaveGraphView(mind);
  else enterGraphView(mind);
}
```

Required guards:

1. `syncNow()`: add `if (isGraphView.value) return;` after the existing `!mind` guard, so temp arrows never reach disk.
2. `toggleReadOnly` (composable) must not re-enable edit while in graph view. Pass `isGraphView: Ref<boolean>` into `CanvasActionContext`, and in `toggleReadOnly` skip `enableEdit()` when `isGraphView.value`.
3. `applyExternalContent()`: when `isGraphView.value`, set `isGraphView.value = false; graphBaseline = null;` before `mind.refresh(data)` (external content wins).
4. `teardown()`: reset `isGraphView.value = false; graphBaseline = null;`.

Add `'mindmap.toggleGraphView': toggleGraphView,` to `actions`. Template badge beside the read-only badge: `<span v-if="isGraphView" class="mindmap-view__badge mindmap-view__badge--graph">{{ t('mindmap.graphViewBadge') }}</span>` with `.mindmap-view__badge--graph { inset-inline-end: 96px; }`.

- [ ] **Step 7: Keybindings + i18n**

```ts
  { id: 'mindmap.toggleGraphView', label: 'Mindmap: Toggle Graph View', category: 'mindmap', scope: 'mindmap', defaults: ['Mod+Alt+G'] },
  { id: 'mindmap.exportMermaid', label: 'Mindmap: Export Graph as Mermaid', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.exportAdjacency', label: 'Mindmap: Export Graph as JSON Adjacency', category: 'mindmap', scope: 'mindmap', defaults: [] },
```

`en.ts`: `graphViewBadge: 'Graph view'`.

- [ ] **Step 8: Tests + build + browser check**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-graph.test.ts src/lib/mindmap-export.test.ts src/lib/mindmap-keymap.test.ts && pnpm build`

Browser:

1. With a gate, press Mod+Alt+G. A dashed arrow runs gate → target, the badge shows, and editing is off.
2. Toggle back. The arrow is gone, and the `.mmap` content has no `gate-arrow-` ids (`tabs.activeTab.content.includes('gate-arrow-') === false`).

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/mindmap-graph.ts app/src/lib/mindmap-graph.test.ts app/src/lib/mindmap-export.ts app/src/lib/mindmap-export.test.ts app/src/composables/useMindmapCanvasActions.ts app/src/composables/useMindmapExport.ts app/src/components/MindmapCanvas.vue app/src/lib/keybindings.ts app/src/i18n/en.ts
git commit -m "feat(mindmap): graph view and Mermaid/JSON adjacency export"
```

---

### Task 11: Verification, docs, version bump, Phase 5 handoff

**Files:**
- Modify: `docs/design/mindmap/2026-10-11-mindmap-design.md` (Status table, Dependencies row, Phase 4 decisions)
- Modify: this plan (Status, Deviations, Open items)
- Modify: `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock` (`solomd` entry only), `app/src-tauri/tauri.conf.json`: `4.14.11` → `4.14.12`
- Create: `docs/plans/mindmap/2026-10-11-mindmap-phase5-handoff.md`

- [ ] **Step 1: Full mindmap test sweep**

Run:

```bash
cd app && node --test --experimental-strip-types src/lib/mindmap-*.test.ts src/lib/fence-scan.test.ts src/lib/fence-languages.test.ts
```

Expected: all PASS. Record counts per file.

- [ ] **Step 2: Build**

Run: `cd app && pnpm build`. Expected: success.

- [ ] **Step 3: Browser regression (web)**

Phases 1-3 smoke:

- Open `.mmap`; Hebrew map grows leftward.
- Preview fence renders.
- Fullscreen edit writes back.

Phase 4: every palette `Mindmap:` command runs on a focused map without console errors (exports end in the expected "export failed" toast in web).

Security:

- A topic `</script><script>window.__pwn=1</script>` produces `buildHtmlExport` output without that substring.
- `buildSvgExport` output has no `<script` and no `onerror`.

Check both by calling the functions in the console via `await import('/src/lib/mindmap-export.ts')` and `'/src/lib/mindmap-export-image.ts'`.

- [ ] **Step 4: Desktop check (Tauri)**

Run `cd app && pnpm tauri dev` (or the repo's desktop build command, see `app/package.json` scripts). Then:

1. Export PNG, SVG, HTML, JSON, Markdown, Mermaid and adjacency to a temp folder through the native save dialog.
2. Open each file: PNG/SVG show the map with Hebrew labels; HTML opens in a browser and renders the map read-only; JSON parses.
3. Copy as plaintext → paste into a note.

If the desktop build is unavailable in this session, record "desktop check pending" in Open items. Do not claim it passed.

- [ ] **Step 5: Version bump**

Set `4.14.12` in the four files. In `Cargo.lock` change only the `version` line under `name = "solomd"`. Verify: `grep -n "4.14.1[12]" app/package.json app/src-tauri/Cargo.toml app/src-tauri/tauri.conf.json app/src-tauri/Cargo.lock`.

- [ ] **Step 6: Docs**

- Spec Status table:
  ```
  | 4 Map UI | ✅ Done <DD-MM-YY> (`4.14.12`) — plan `docs/plans/mindmap/2026-10-11-mindmap-phase4-map-ui.md` |
  ```
- Spec Dependencies row: `@mind-elixir/export-mindmap` → `0.1.11`; "PNG, HTML (escaped), JSON, Markdown; SVG via core `exportSvg` + DOMPurify".
- Spec, add `### Decisions` under Phase 4: gate storage `metadata.gate`; HTML data re-escape; SVG sanitize; palette via `mindmap-active` registry; merge not undoable.
- Plan Status: table of tasks → commit ranges, test counts, browser/desktop results, Deviations, Open items (same shape as Phase 3's Status section).

- [ ] **Step 7: Phase 5 handoff**

Write `docs/plans/mindmap/2026-10-11-mindmap-phase5-handoff.md`:

- Context: branch, version, phases done.
- Reuse list: `metadata.source` contract (`{ path?, line }` 1-based, read by `readNodeSource`), so Phase 5 converters must stamp it; `mapToHeadingsMarkdown` (inverse direction); gate syntax; `mindmap-active` registry for new palette commands; `useMindmapExport`.
- Phase 5 scope copied from the spec.
- Process steps (brainstorm open decisions → plan → subagent-driven → bump).
- Constraints block identical to this plan's Global Constraints.

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers app/package.json app/src-tauri/Cargo.toml app/src-tauri/Cargo.lock app/src-tauri/tauri.conf.json
git commit -m "chore(release): mindmap phase 4 docs and bump version to 4.14.12"
```
