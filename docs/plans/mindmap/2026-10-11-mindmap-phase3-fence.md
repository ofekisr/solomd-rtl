# Mindmap Phase 3 — Markdown `mindmap` Fence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ```` ```mindmap ```` fence in a Markdown note renders as a read-only interactive map, both in Preview and in the live editor. Its fullscreen editor writes edits back into that fence.

**Architecture:** Mind Elixir core does the work: `mind-elixir/plaintextConverter` parses and prints the fence body, and `MindElixir` draws it. Our code is glue only:

- `fence-scan.ts` finds fenced blocks.
- `mindmap-fence.ts` provides the codec and a guarded body splice.
- `mindmap-readonly.ts` mounts the read-only map.
- Phase 1's `MindmapView.vue` is split into a codec-driven `MindmapCanvas.vue`, which both the tab view and a new `MindmapFenceOverlay.vue` reuse.

Every payload passes through `sanitizeMindmapData`.

**Tech Stack:** Vue 3.5 + Pinia, TypeScript 5.6, CodeMirror 6, markdown-it 14, `mind-elixir@5.15.1` (already installed; no new dependencies), `node:test`.

**Spec:** `docs/design/mindmap/2026-10-11-mindmap-design.md` (Phase 3 section, Guiding rule).

## Status

COMPLETE. 12-10-26, version 4.14.11. Branch `feat/mindmap`, unpushed.

| Task | Commits | Notes |
|---|---|---|
| 1 Fence scanner + codec | `0decaf2..6205600` | Spike-verified round-trip incl. sanitize |
| 2 Language registration | `6205600..3be5d97` (`3be5d97`, `725e642`) | `725e642` added `fenceEmpty` against the pre-flight ruling; removed in the Task 3 fix |
| 3 Preview read-only map | `3be5d97..0144e3d` (`9a5b3d3`, fix `0144e3d`) | Fix: overlapping-pass leak, unguarded mount, ResizeObserver fit, `fenceEmpty` removed |
| 4 `MindmapCanvas` extraction | `0144e3d..b753e9e` | Pure move; `MindmapView` is a thin wrapper |
| 5 Fullscreen fence editor | `b753e9e..f645d4f` | Guarded debounced writeback |
| 6 Live widget | `f645d4f..c79de95` (`f59af68`, fix `c79de95`) | Fix: map leaked when widget destroyed before async mount resolved |
| 7 Verification, docs, bump | `068691b`, `4922959` | Version bump kept from `068691b` |
| Final review (Opus) | `80fca61` | Fence identity by source line (wrong-fence write with equal bodies), live widget body dedent, DOM-keyed widget teardown, CM mount try/catch |

**Tests:** 79/79 pass at `4922959`; `80fca61` adds 7 fence tests (fence-scan + mindmap-fence 26/26) (fence-scan 7, mindmap-fence 11, mindmap-format 34, fence-languages 19, mindmap-direction 3, mindmap-keymap 5). `pnpm build` OK.

**Browser check:** Hebrew fence grows leftward in Preview and live widget; fullscreen add-child writes back into the fence and survives reload. Security fence renders as text, 0 `javascript:` in `href`/`style` (Preview and live).

### Deviations

- `fence-scan`: `\r?` added to the regex so CRLF sources scan correctly.
- Preview: "Open fullscreen" button instead of a whole-map click (drag pans; a click would open on pan).
- Preview: `ResizeObserver` fit, because the container is 0-size at mount.
- Overlay canvas carries a `:key` so each opened fence gets a fresh instance.
- Ruling: `fenceEmpty` i18n key unused, dropped (YAGNI).
- Ruling: Task 6 also touches `Editor.vue` (`getMindmapStrings` wiring); Step text wins over the Files header.
- Ruling: no worktree; work stays on `feat/mindmap`.
- Ruling: ResizeObserver fit promoted into the Task 3 fix round (plan's own 0-size fallback condition was hit; Task 6 reuses this mount).
- Ruling: Task 6 (`f59af68`) was written out-of-band; reviewed as the candidate, not redone.
- Ruling: `f645d4f`/`f59af68`/`068691b` carry "Sonnet 4.6" trailers; history left as-is (cosmetic).
- Ruling: Task 7 (`068691b`) written out-of-band; version bump kept, docs corrected here.
- Ruling (final review): fence identity = opening-fence source line + body (supersedes document-order index); live widget sources fences from `findMindmapFences`.

### Open items

- `Editor.vue` plain-mode block render (fences stay as code there).
- Slash-command insert.
- Native Tauri check (Phases 1-3 verified in the web build only).
- Deferred minors:
  - CRLF source gets an LF body on writeback; fence-scan test gaps (tilde close, nesting, 4-space indent, CRLF open line, replace on no-fence source); `closes()` builds a RegExp per line; `(err as Error).message` assumes `Error`.
  - `markdown.ts` appended comment exceeds the ~80-col wrap.
  - Preview: two theme watchers; open button unstyled; inline height constant; `mountReadOnlyMindmap` does not destroy on init throw; observer callback `scaleFit`/`toCenter` uncaught.
  - `MindmapCanvas`: codec prop swaps not reactive; `openAsText` mutates the tab prop (pre-existing).
  - Overlay: silent drop when the owning tab closes while open; hand-written `CanvasHandle` type; window-level Esc may close stacked overlays.
  - Live widget: failure path drops the open button; `cm-relayout` literal; widget `setDark` unused.

## Decisions (brainstorm 12-10-26)

| Topic | Decision | Why |
|---|---|---|
| Plugin fit | Adopt neither `remark-mindmap` 0.2.0 nor `rehype-mind-elixir` 1.0.0-beta.1 | Both are unified (mdast/hast) plugins, not markdown-it. Both need `mind-elixir@6.0.0-next`; we pin 5.15.1. `remark-mindmap` renders `[x](javascript:…)` into `href` unsanitized. `rehype-mind-elixir` pins deps to `latest`. |
| Core used | `mind-elixir/plaintextConverter` (5.15.1) | Spike: hierarchy, `[^ref]` anchors, summaries, arrows, safe `{style}` and Hebrew survive `sanitizeMindmapData`. Second round-trip is byte-stable. |
| Fence ↔ editor match | Document order **plus body guard** | Spec keeps order matching. The guard stores the body as last written. On write: use the fence at that index if its body still matches; else the only fence with that body; else abort and show a toast. |
| Write timing | Debounced live (300 ms, `MindmapCanvas` `SYNC_DEBOUNCE_MS`) | Same as tldraw overlay; no unsaved state. |
| "Fences keep ids" | Means `[^ref]` anchors | Node ids are regenerated on every parse; only refs are stable. |
| Live editor reveal | Mermaid model: cursor inside fence → source; outside → map | The body is hand-editable plaintext, unlike tldraw JSON. |
| Preview open | "Open fullscreen" button on the map (and Enter on the focused block), not a whole-map click | Drag pans the map, so a plain click on it would open the editor whenever the user pans. |

## Global Constraints

- pnpm in `app/`; exact pins; no new runtime dependency in this phase.
- No `any`, no zod. Named constants for every literal value. Functions ≤ ~20 lines. No comments unless the "why" is non-obvious.
- Lib tests: `cd app && node --test --experimental-strip-types src/lib/<file>.test.ts`; `src/lib` imports use the `.ts` extension.
- Build: `cd app && pnpm build`.
- Out of scope / pre-existing failures: 12 failing `src/lib/*.test.ts` files (extensionless imports); Rust `.rs` assertion in `detect_language_from_extension`.
- Every Mind Elixir payload passes `sanitizeMindmapData` (or `sanitizeNodeObj`).
- Browser check: `.claude/launch.json` → `solomd-web` (port 1420). Tabs store: `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('tabs')`.
- Commit trailer: `Co-Authored-By: Claude <model> 5.5 <noreply@anthropic.com>`.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `app/src/lib/fence-scan.ts` | Create | Find every fenced block (CommonMark open/close rules) with offsets and a dedented body |
| `app/src/lib/fence-scan.test.ts` | Create | Tests |
| `app/src/lib/mindmap-format.ts` | Modify | Add `MindmapCodec` interface + `mmapCodec(fileName)` |
| `app/src/lib/mindmap-fence.ts` | Create | Fence codec, `findMindmapFences`, guarded `replaceMindmapFence`, open-event type |
| `app/src/lib/mindmap-fence.test.ts` | Create | Tests |
| `app/src/lib/fence-languages.ts` (+ test) | Modify | `mindmap` in `SPECIAL_FENCES` |
| `app/src/lib/markdown.ts` | Modify | Skip `mindmap` in the fence line-number wrapper |
| `app/src/i18n/en.ts` | Modify | `mindmap.fence*` keys |
| `app/src/lib/mindmap-readonly.ts` | Create | Mount a read-only Mind Elixir map on an element; theme switch; destroy |
| `app/src/components/Preview.vue` | Modify | `processMindmaps()` at its 3 call sites; theme watch; teardown |
| `app/src/components/MindmapCanvas.vue` | Create | Body of today's `MindmapView.vue`, driven by `content` + `codec` |
| `app/src/components/MindmapView.vue` | Modify | Thin tab wrapper around `MindmapCanvas` |
| `app/src/components/MindmapFenceOverlay.vue` | Create | Fullscreen editor for one fence; guarded debounced writeback |
| `app/src/App.vue` | Modify | Mount `<MindmapFenceOverlay />` |
| `app/src/lib/cm-live-blocks.ts` | Modify | `MindmapWidget` + build-loop branch |

Out of scope (record as open items): `Editor.vue` plain-mode block render (fences stay as code there), slash-command insert, export.

---

### Task 1: Fence scanner + mindmap fence codec

**Files:**
- Create: `app/src/lib/fence-scan.ts`, `app/src/lib/fence-scan.test.ts`
- Create: `app/src/lib/mindmap-fence.ts`, `app/src/lib/mindmap-fence.test.ts`
- Modify: `app/src/lib/mindmap-format.ts` (add codec type + `mmapCodec`)

**Interfaces:**
- Produces (`fence-scan.ts`):
  ```ts
  export interface FencedBlock {
    info: string;      // text after the opening run, trimmed
    indent: string;    // leading spaces of the opening line (0–3)
    from: number;      // offset of opening line start
    to: number;        // offset just past closing line (excl. its '\n')
    bodyFrom: number;  // offset of first body line start
    bodyTo: number;    // offset of closing line start
    body: string;      // body lines, dedented by indent, joined with '\n', no trailing '\n'
  }
  export function scanFencedBlocks(source: string): FencedBlock[];
  ```
- Produces (`mindmap-format.ts`):
  ```ts
  export interface MindmapCodec {
    parse(text: string): MindmapParseResult;
    serialize(data: MindElixirData): string;
  }
  export function mmapCodec(fileName: string): MindmapCodec;
  ```
- Produces (`mindmap-fence.ts`):
  ```ts
  export const MINDMAP_FENCE_LANG = 'mindmap';
  export const MINDMAP_FENCE_ROOT_TOPIC = 'Mind Map';
  export const MAX_MINDMAP_FENCE_CHARS = 200_000;
  export const MINDMAP_OPEN_EVENT = 'solomd:mindmap-open';
  export interface MindmapFenceTarget { index: number; body: string }
  export interface MindmapOpenDetail extends MindmapFenceTarget { tabId: string }
  export interface MindmapFence extends FencedBlock { index: number }
  export type FenceReplaceResult = { ok: true; source: string } | { ok: false };
  export function isMindmapFenceInfo(info: string): boolean;
  export function findMindmapFences(source: string): MindmapFence[];
  export function parseMindmapFence(body: string): MindmapParseResult;
  export function serializeMindmapFence(data: MindElixirData): string;
  export const mindmapFenceCodec: MindmapCodec;
  export function normalizeFenceBody(body: string): string; // CRLF→LF, trimEnd
  export function replaceMindmapFence(source: string, target: MindmapFenceTarget, nextBody: string): FenceReplaceResult;
  ```

- [ ] **Step 1: Write failing `fence-scan.test.ts`**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanFencedBlocks } from './fence-scan.ts';

test('finds backtick and tilde fences in order with info strings', () => {
  const src = 'a\n```mindmap\n- R\n```\n~~~js x\ncode\n~~~\n';
  const blocks = scanFencedBlocks(src);
  assert.deepEqual(blocks.map((b) => b.info), ['mindmap', 'js x']);
  assert.equal(blocks[0].body, '- R');
});

test('offsets slice the source exactly', () => {
  const src = 'x\n```mindmap\n- R\n  - A\n```\ny';
  const [b] = scanFencedBlocks(src);
  assert.equal(src.slice(b.from, b.to), '```mindmap\n- R\n  - A\n```');
  assert.equal(src.slice(b.bodyFrom, b.bodyTo), '- R\n  - A\n');
});

test('closing run must be the same char and at least as long', () => {
  const src = '````mindmap\n```\n- R\n````\n';
  const [b] = scanFencedBlocks(src);
  assert.equal(b.body, '```\n- R');
});

test('indented fence body is dedented by the opening indent', () => {
  const src = '  ```mindmap\n  - R\n    - A\n  ```\n';
  const [b] = scanFencedBlocks(src);
  assert.equal(b.indent, '  ');
  assert.equal(b.body, '- R\n  - A');
});

test('empty body has bodyFrom === bodyTo', () => {
  const [b] = scanFencedBlocks('```mindmap\n```\n');
  assert.equal(b.body, '');
  assert.equal(b.bodyFrom, b.bodyTo);
});

test('unclosed fence is not returned', () => {
  assert.deepEqual(scanFencedBlocks('```mindmap\n- R\n'), []);
});

test('backtick info containing a backtick is not a fence', () => {
  assert.deepEqual(scanFencedBlocks('```a`b\nx\n```\n').length, 0);
});
```

- [ ] **Step 2: Run** `cd app && node --test --experimental-strip-types src/lib/fence-scan.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `fence-scan.ts`**

```ts
const OPEN_PATTERN = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const BACKTICK = '`';
const NEWLINE = '\n';

export interface FencedBlock {
  info: string;
  indent: string;
  from: number;
  to: number;
  bodyFrom: number;
  bodyTo: number;
  body: string;
}

interface Opening { indent: string; run: string; info: string }

function lineStarts(lines: string[]): number[] {
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + NEWLINE.length;
  }
  return starts;
}

function parseOpening(line: string): Opening | null {
  const match = OPEN_PATTERN.exec(line);
  if (!match) return null;
  const [, indent, run, rest] = match;
  if (run[0] === BACKTICK && rest.includes(BACKTICK)) return null;
  return { indent, run, info: rest.trim() };
}

function closes(line: string, run: string): boolean {
  const pattern = new RegExp(`^ {0,3}\\${run[0]}{${run.length},}\\s*$`);
  return pattern.test(line);
}

function dedent(line: string, indent: string): string {
  let cut = 0;
  while (cut < indent.length && line[cut] === ' ') cut += 1;
  return line.slice(cut);
}

function findClose(lines: string[], start: number, run: string): number {
  for (let i = start; i < lines.length; i += 1) if (closes(lines[i], run)) return i;
  return -1;
}

export function scanFencedBlocks(source: string): FencedBlock[] {
  const lines = source.split(NEWLINE);
  const starts = lineStarts(lines);
  const blocks: FencedBlock[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const open = parseOpening(lines[i]);
    if (!open) continue;
    const close = findClose(lines, i + 1, open.run);
    if (close < 0) return blocks;
    const body = lines.slice(i + 1, close).map((l) => dedent(l, open.indent)).join(NEWLINE);
    blocks.push({ info: open.info, indent: open.indent, from: starts[i], to: starts[close] + lines[close].length, bodyFrom: starts[i + 1], bodyTo: starts[close], body });
    i = close;
  }
  return blocks;
}
```

- [ ] **Step 4: Run** the same command — Expected: 7/7 PASS.

- [ ] **Step 5: Add codec to `mindmap-format.ts`** (append after `parseMindmap`):

```ts
export interface MindmapCodec {
  parse(text: string): MindmapParseResult;
  serialize(data: MindElixirData): string;
}

export function mmapCodec(fileName: string): MindmapCodec {
  const fallbackTopic = rootTopicFromFileName(fileName);
  return { parse: (text) => parseMindmap(text, fallbackTopic), serialize: serializeMindmap };
}
```

Add one test to `mindmap-format.test.ts`:

```ts
test('mmapCodec round-trips through parse and serialize', () => {
  const codec = mmapCodec('plan.mmap');
  const parsed = codec.parse('');
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.data.nodeData.topic, 'plan');
  assert.ok(codec.parse(codec.serialize(parsed.data)).ok);
});
```

- [ ] **Step 6: Write failing `mindmap-fence.test.ts`**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findMindmapFences, isMindmapFenceInfo, MAX_MINDMAP_FENCE_CHARS, MINDMAP_FENCE_ROOT_TOPIC,
  parseMindmapFence, replaceMindmapFence, serializeMindmapFence,
} from './mindmap-fence.ts';

const OUTLINE = '- Root\n  - A [^a1]\n    - A1\n  - }:1 Group A\n  - B [^b1]\n  - > [^a1] <-relates-> [^b1]\n  - עברית';
const DOC = `# T\n\n\`\`\`mindmap\n${OUTLINE}\n\`\`\`\n\ntext\n\n\`\`\`js\nx\n\`\`\`\n\n\`\`\`mindmap\n- Second\n\`\`\`\n`;

test('info matcher is case-insensitive and ignores attributes', () => {
  assert.ok(isMindmapFenceInfo('MindMap height=300'));
  assert.ok(!isMindmapFenceInfo('mindmapx'));
});

test('finds only mindmap fences, indexed in document order', () => {
  const fences = findMindmapFences(DOC);
  assert.deepEqual(fences.map((f) => f.index), [0, 1]);
  assert.equal(fences[1].body, '- Second');
});

test('parse keeps hierarchy, refs, summaries, arrows and Hebrew', () => {
  const parsed = parseMindmapFence(OUTLINE);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.data.nodeData.topic, 'Root');
  assert.equal(parsed.data.summaries?.length, 1);
  assert.equal(parsed.data.arrows?.length, 1);
  assert.equal(serializeMindmapFence(parsed.data), OUTLINE);
});

test('parse drops unsafe styles', () => {
  const parsed = parseMindmapFence('- R {"color":"#f00","background":"url(javascript:x)"}');
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(serializeMindmapFence(parsed.data), '- R {"color":"#f00"}');
});

test('empty body yields an empty map with the default root', () => {
  const parsed = parseMindmapFence('  \n');
  assert.ok(parsed.ok && parsed.isEmpty && parsed.data.nodeData.topic === MINDMAP_FENCE_ROOT_TOPIC);
});

test('oversized body is rejected', () => {
  const parsed = parseMindmapFence('- x'.repeat(MAX_MINDMAP_FENCE_CHARS));
  assert.equal(parsed.ok, false);
});

test('replace writes the fence at the index when its body still matches', () => {
  const result = replaceMindmapFence(DOC, { index: 1, body: '- Second' }, '- Second\n  - child');
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(findMindmapFences(result.source)[1].body, '- Second\n  - child');
  assert.equal(findMindmapFences(result.source)[0].body, OUTLINE);
});

test('replace falls back to the unique body match when the index shifted', () => {
  const shifted = `\`\`\`mindmap\n- New first\n\`\`\`\n${DOC}`;
  const result = replaceMindmapFence(shifted, { index: 1, body: '- Second' }, '- Changed');
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(findMindmapFences(result.source).map((f) => f.body), ['- New first', OUTLINE, '- Changed']);
});

test('replace aborts when the body is gone or ambiguous', () => {
  assert.equal(replaceMindmapFence(DOC, { index: 0, body: '- Missing' }, '- X').ok, false);
  const twin = `${DOC}\n\`\`\`mindmap\n- Second\n\`\`\`\n`;
  assert.equal(replaceMindmapFence(twin, { index: 5, body: '- Second' }, '- X').ok, false);
});

test('replace re-indents the body of an indented fence and fills an empty one', () => {
  const indented = '- item\n\n  ```mindmap\n  - R\n  ```\n';
  const result = replaceMindmapFence(indented, { index: 0, body: '- R' }, '- R\n  - A');
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.source, '- item\n\n  ```mindmap\n  - R\n    - A\n  ```\n');
  const empty = replaceMindmapFence('```mindmap\n```\n', { index: 0, body: '' }, '- R');
  assert.ok(empty.ok && empty.source === '```mindmap\n- R\n```\n');
});

test('body comparison ignores CRLF and trailing whitespace', () => {
  const crlf = '```mindmap\r\n- R  \r\n```\r\n';
  assert.ok(replaceMindmapFence(crlf, { index: 0, body: '- R\n' }, '- S').ok);
});
```

- [ ] **Step 7: Run** `cd app && node --test --experimental-strip-types src/lib/mindmap-fence.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 8: Implement `mindmap-fence.ts`**

```ts
import type { MindElixirData } from 'mind-elixir';
import { mindElixirToPlaintext, plaintextToMindElixir } from 'mind-elixir/plaintextConverter';
import { scanFencedBlocks, type FencedBlock } from './fence-scan.ts';
import { createEmptyMindmap, sanitizeMindmapData, type MindmapCodec, type MindmapParseResult } from './mindmap-format.ts';

export const MINDMAP_FENCE_LANG = 'mindmap';
export const MINDMAP_FENCE_ROOT_TOPIC = 'Mind Map';
export const MAX_MINDMAP_FENCE_CHARS = 200_000;
export const MINDMAP_OPEN_EVENT = 'solomd:mindmap-open';
const NEWLINE = '\n';
const CRLF_PATTERN = /\r\n?/g;

export interface MindmapFenceTarget { index: number; body: string }
export interface MindmapOpenDetail extends MindmapFenceTarget { tabId: string }
export interface MindmapFence extends FencedBlock { index: number }
export type FenceReplaceResult = { ok: true; source: string } | { ok: false };

export function isMindmapFenceInfo(info: string): boolean {
  const [language = ''] = info.trim().split(/\s+/u);
  return language.toLowerCase() === MINDMAP_FENCE_LANG;
}

export function findMindmapFences(source: string): MindmapFence[] {
  return scanFencedBlocks(source)
    .filter((block) => isMindmapFenceInfo(block.info))
    .map((block, index) => ({ ...block, index }));
}

export function normalizeFenceBody(body: string): string {
  return body.replace(CRLF_PATTERN, NEWLINE).split(NEWLINE).map((l) => l.trimEnd()).join(NEWLINE).trimEnd();
}

export function parseMindmapFence(body: string): MindmapParseResult {
  if (body.length > MAX_MINDMAP_FENCE_CHARS) return { ok: false, error: `Mindmap fence exceeds ${MAX_MINDMAP_FENCE_CHARS} characters` };
  const text = normalizeFenceBody(body);
  if (text === '') return { ok: true, data: createEmptyMindmap(MINDMAP_FENCE_ROOT_TOPIC), isEmpty: true };
  try {
    return { ok: true, data: sanitizeMindmapData(plaintextToMindElixir(text, MINDMAP_FENCE_ROOT_TOPIC)), isEmpty: false };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function serializeMindmapFence(data: MindElixirData): string {
  return normalizeFenceBody(mindElixirToPlaintext(sanitizeMindmapData(data)));
}

export const mindmapFenceCodec: MindmapCodec = { parse: parseMindmapFence, serialize: serializeMindmapFence };

function locate(fences: MindmapFence[], target: MindmapFenceTarget): MindmapFence | null {
  const wanted = normalizeFenceBody(target.body);
  const atIndex = fences[target.index];
  if (atIndex && normalizeFenceBody(atIndex.body) === wanted) return atIndex;
  const matches = fences.filter((f) => normalizeFenceBody(f.body) === wanted);
  return matches.length === 1 ? matches[0] : null;
}

function indentBody(body: string, indent: string): string {
  return body.split(NEWLINE).map((line) => (line === '' ? line : indent + line)).join(NEWLINE);
}

export function replaceMindmapFence(source: string, target: MindmapFenceTarget, nextBody: string): FenceReplaceResult {
  const fence = locate(findMindmapFences(source), target);
  if (!fence) return { ok: false };
  const text = indentBody(normalizeFenceBody(nextBody), fence.indent);
  const replacement = text === '' ? '' : text + NEWLINE;
  return { ok: true, source: source.slice(0, fence.bodyFrom) + replacement + source.slice(fence.bodyTo) };
}
```

Note: with CRLF sources the replacement uses LF lines; acceptable (SoloMD normalizes on save). If the CRLF test shows `bodyFrom` landing after `\r`, keep it: the scan splits on `\n`, so `\r` stays at line ends and `normalizeFenceBody` strips it for comparison.

- [ ] **Step 9: Run** both test files — Expected: all PASS. Then `cd app && npx vue-tsc --noEmit -p tsconfig.json` (or the type-check script in `package.json`) — Expected: no new errors.

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/fence-scan.ts app/src/lib/fence-scan.test.ts app/src/lib/mindmap-fence.ts app/src/lib/mindmap-fence.test.ts app/src/lib/mindmap-format.ts app/src/lib/mindmap-format.test.ts
git commit -m "feat(mindmap): fence scanner and plaintext fence codec with guarded writeback"
```

---

### Task 2: Register the fence (language list, markdown-it, i18n)

**Files:**
- Modify: `app/src/lib/fence-languages.ts:41-64`, `app/src/lib/fence-languages.test.ts:57-62`
- Modify: `app/src/lib/markdown.ts:224`
- Modify: `app/src/i18n/en.ts:1355-1362`

**Interfaces:**
- Consumes: `MINDMAP_FENCE_LANG` (Task 1).
- Produces: i18n keys `mindmap.fenceOpenFull`, `mindmap.fenceEditorTitle`, `mindmap.fenceParseError`, `mindmap.fenceStale`, `mindmap.fenceEmpty`; preview HTML keeps `<pre><code class="language-mindmap">` with no `.cb-line` wrapping.

- [ ] **Step 1: Update the order test first** (`fence-languages.test.ts`):

```ts
test('the SoloMD-specific fences come first, before anything is typed', () => {
  assert.deepEqual(
    filterFenceLanguages('').slice(0, 4).map((l) => l.name),
    ['mermaid', 'tldraw', 'mindmap', 'plantuml'],
  );
});

test('mind map keywords find the mindmap fence', () => {
  assert.equal(filterFenceLanguages('mind')[0]?.name, 'mindmap');
});
```

- [ ] **Step 2: Run** `cd app && node --test --experimental-strip-types src/lib/fence-languages.test.ts` — Expected: FAIL. (If the file is one of the 12 pre-existing extensionless-import failures, fall back to `pnpm build` + the browser check in Task 7 and note it.)

- [ ] **Step 3: Add the entry** after `tldraw` in `SPECIAL_FENCES`:

```ts
  {
    name: 'mindmap',
    aliases: [],
    hint: 'mind map',
    special: true,
    keywords: ['mind', 'map', 'outline', 'tree', 'brainstorm'],
  },
```

- [ ] **Step 4: Skip line-number wrapping** in `markdown.ts:224`:

```ts
  if (lang === 'mermaid' || lang === 'tldraw' || lang === 'mindmap') return html;
```

Extend the comment above it with: `Skip mindmap the same way — Preview.vue mounts a read-only map.`

- [ ] **Step 5: i18n** — add inside `mindmap:` in `en.ts` (other locales fall back to `en`, since `mindmap` is optional in `I18n`):

```ts
    fenceOpenFull: 'Open fullscreen',
    fenceEditorTitle: 'Mind map',
    fenceParseError: 'Mind map could not be read',
    fenceStale: 'The mind map block changed in the note; edits are no longer saved. Close and reopen it.',
    fenceEmpty: 'Empty mind map',
```

- [ ] **Step 6: Run** the test from Step 2 and `pnpm build` — Expected: PASS / build OK.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/fence-languages.ts app/src/lib/fence-languages.test.ts app/src/lib/markdown.ts app/src/i18n/en.ts
git commit -m "feat(mindmap): register mindmap fence language and strings"
```

---

### Task 3: Read-only map mount + Preview pass

**Files:**
- Create: `app/src/lib/mindmap-readonly.ts`
- Modify: `app/src/components/Preview.vue` (new `processMindmaps()` after `processWhiteboards()` at lines ~430, ~447, ~538; theme watch; `onBeforeUnmount` teardown; CSS)

**Interfaces:**
- Consumes: `parseMindmapFence`, `MINDMAP_OPEN_EVENT`, `MindmapOpenDetail` (Task 1); `layoutDirectionFor` (`mindmap-direction.ts`); i18n keys (Task 2).
- Produces (`mindmap-readonly.ts`):
  ```ts
  export interface ReadOnlyMindmap { setDark(isDark: boolean): void; destroy(): void }
  export type ReadOnlyMountResult = { ok: true; map: ReadOnlyMindmap } | { ok: false; error: string };
  export const MINDMAP_BLOCK_HEIGHT_PX = 360;
  export function mountReadOnlyMindmap(el: HTMLElement, body: string, isDark: boolean): Promise<ReadOnlyMountResult>;
  ```

- [ ] **Step 1: Implement `mindmap-readonly.ts`** (DOM-only; covered by build + browser check):

```ts
import type { MindElixirInstance } from 'mind-elixir';
import { layoutDirectionFor } from './mindmap-direction.ts';
import { parseMindmapFence } from './mindmap-fence.ts';

export const MINDMAP_BLOCK_HEIGHT_PX = 360;

export interface ReadOnlyMindmap { setDark(isDark: boolean): void; destroy(): void }
export type ReadOnlyMountResult = { ok: true; map: ReadOnlyMindmap } | { ok: false; error: string };

type MindElixirModule = typeof import('mind-elixir');

function themeOf(module: MindElixirModule, isDark: boolean) {
  return isDark ? module.default.DARK_THEME : module.default.THEME;
}

function wrap(mind: MindElixirInstance, module: MindElixirModule): ReadOnlyMindmap {
  return {
    setDark: (isDark) => mind.changeTheme(themeOf(module, isDark)),
    destroy: () => mind.destroy(),
  };
}

export async function mountReadOnlyMindmap(el: HTMLElement, body: string, isDark: boolean): Promise<ReadOnlyMountResult> {
  const parsed = parseMindmapFence(body);
  if (!parsed.ok) return parsed;
  const [module] = await Promise.all([import('mind-elixir'), import('mind-elixir/style.css')]);
  el.style.height = `${MINDMAP_BLOCK_HEIGHT_PX}px`;
  const mind = new module.default({
    el, direction: layoutDirectionFor(parsed.data), editable: false, contextMenu: false,
    keypress: false, toolBar: true, theme: themeOf(module, isDark),
  });
  mind.init(parsed.data);
  mind.scaleFit();
  mind.toCenter();
  return { ok: true, map: wrap(mind, module) };
}
```

If `scaleFit()` runs before layout (zero-size element), copy `centerOnceLaidOut` from `MindmapView.vue` (ResizeObserver, then `scaleFit` + `toCenter`) into this file as a helper.

- [ ] **Step 2: Add `processMindmaps()` to `Preview.vue`** next to `processWhiteboards()`:

```ts
const mindmapMounts: ReadOnlyMindmap[] = [];

function destroyMindmaps(): void {
  for (const map of mindmapMounts.splice(0)) map.destroy();
}

function isDarkTheme(): boolean {
  return themeFamily(settings.theme) === 'dark';
}

function openMindmapButton(detail: MindmapOpenDetail): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mindmap-block__open';
  button.textContent = t('mindmap.fenceOpenFull');
  button.addEventListener('click', () => window.dispatchEvent(new CustomEvent(MINDMAP_OPEN_EVENT, { detail })));
  return button;
}

async function renderMindmapBlock(pre: HTMLElement, body: string, index: number): Promise<void> {
  const wrap = document.createElement('div');
  wrap.className = 'mindmap-block';
  const canvas = document.createElement('div');
  canvas.className = 'mindmap-block__canvas';
  wrap.append(canvas);
  pre.replaceWith(wrap);
  const result = await mountReadOnlyMindmap(canvas, body, isDarkTheme());
  if (!result.ok) {
    wrap.classList.add('mindmap-block--broken');
    wrap.textContent = `${t('mindmap.fenceParseError')}: ${result.error}`;
    return;
  }
  mindmapMounts.push(result.map);
  if (props.tabId) wrap.append(openMindmapButton({ tabId: props.tabId, index, body }));
}

async function processMindmaps(): Promise<void> {
  if (!host.value) return;
  destroyMindmaps();
  const blocks = Array.from(host.value.querySelectorAll('pre > code.language-mindmap'));
  for (const [index, block] of blocks.entries()) {
    const pre = block.parentElement;
    if (!pre || pre.dataset.rendered === '1') continue;
    pre.dataset.rendered = '1';
    await renderMindmapBlock(pre, block.textContent ?? '', index);
  }
}
```

Imports: `mountReadOnlyMindmap`, `type ReadOnlyMindmap` from `../lib/mindmap-readonly` (dynamic `import()` inside `processMindmaps` is preferred if the chunk analysis shows mind-elixir pulled into the main bundle; check `pnpm build` output). Also import `MINDMAP_OPEN_EVENT` and `type MindmapOpenDetail` from `../lib/mindmap-fence`, plus `themeFamily` from `../lib/themes`.

Index note: `index` counts `code.language-mindmap` blocks in DOM order, which matches `findMindmapFences` order except for fences markdown-it finds inside blockquotes. The body guard in `replaceMindmapFence` covers that mismatch.

`destroyMindmaps()` at the start of the pass is safe: each pass runs after `v-html` has replaced the DOM, so old maps are detached.

- [ ] **Step 3: Call sites** — add `await processMindmaps();` right after each of the three `await processWhiteboards();` lines. Add `destroyMindmaps();` to the existing `onBeforeUnmount`. Add a theme watcher:

```ts
watch(() => settings.theme, () => {
  for (const map of mindmapMounts) map.setDark(isDarkTheme());
});
```

- [ ] **Step 4: CSS** (in `Preview.vue` style block, next to `.whiteboard-block`):

```css
.mindmap-block { position: relative; margin: 1em 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.mindmap-block__canvas { width: 100%; }
.mindmap-block__open { position: absolute; inset-block-start: 8px; inset-inline-end: 8px; z-index: 2; }
.mindmap-block--broken { padding: 12px; color: var(--text-muted, var(--text)); }
.mindmap-block :deep(me-tpc) { unicode-bidi: plaintext; text-align: start; }
```

(Drop `:deep` if the style block is not scoped.)

- [ ] **Step 5: Verify** `cd app && pnpm build` — Expected: OK. Start `solomd-web` and set a tab's content to `DOC` from Task 1. Expected in Preview: two maps, the Hebrew topic renders, a JS code block keeps line numbers, no console errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/mindmap-readonly.ts app/src/components/Preview.vue
git commit -m "feat(mindmap): render mindmap fences as read-only maps in preview"
```

---

### Task 4: Extract `MindmapCanvas.vue` (codec-driven) from `MindmapView.vue`

**Files:**
- Create: `app/src/components/MindmapCanvas.vue`
- Modify: `app/src/components/MindmapView.vue` (becomes a wrapper)

**Interfaces:**
- Consumes: `MindmapCodec`, `mmapCodec` (Task 1).
- Produces:
  ```ts
  // MindmapCanvas.vue
  props: { content: string; codec: MindmapCodec }
  emits: { 'update:content': [text: string]; 'open-as-text': [] }
  defineExpose({ flush: () => void })   // flushes a pending debounced sync
  ```

- [ ] **Step 1: Create `MindmapCanvas.vue`** by moving the whole of today's `MindmapView.vue` and making these mechanical replacements:

| In MindmapView today | In MindmapCanvas |
|---|---|
| `defineProps<{ tab: Tab }>()` | `defineProps<{ content: string; codec: MindmapCodec }>()` + `const emit = defineEmits<{ 'update:content': [text: string]; 'open-as-text': [] }>()` |
| `props.tab.content` | `props.content` |
| `parseMindmap(props.tab.content, rootTopicFromFileName(props.tab.fileName))` | `props.codec.parse(props.content)` |
| `serializeMindmap(...)` (both uses) | `props.codec.serialize(...)` |
| `tabs.setContent(props.tab.id, lastSynced)` | `emit('update:content', lastSynced)` |
| `openAsText()` body | `emit('open-as-text')` |
| `watch(() => props.tab.content, …)` | `watch(() => props.content, …)` |
| `useTabsStore` import/const, `Tab` import | removed |
| — | `defineExpose({ flush: flushPendingSync })` |

Everything else (keymap, `sanitizeCopiedNodes`, history hooks, `centerOnceLaidOut`, styles, `solomd:flush-content-sync`) moves unchanged.

- [ ] **Step 2: Rewrite `MindmapView.vue`** as a wrapper:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { Tab } from '../types';
import { useTabsStore } from '../stores/tabs';
import { mmapCodec } from '../lib/mindmap-format';
import MindmapCanvas from './MindmapCanvas.vue';

const props = defineProps<{ tab: Tab }>();
const tabs = useTabsStore();
const codec = computed(() => mmapCodec(props.tab.fileName));

function onUpdate(text: string): void {
  tabs.setContent(props.tab.id, text);
}

function openAsText(): void {
  props.tab.language = 'plaintext';
}
</script>

<template>
  <MindmapCanvas :content="tab.content" :codec="codec" @update:content="onUpdate" @open-as-text="openAsText" />
</template>
```

- [ ] **Step 3: Regression check (Phase 1 behaviour)** — `pnpm build`, then in `solomd-web`:
  1. Open a new `.mmap` tab → empty map, no write until the first edit (pristine guard).
  2. Add a child (Tab) → after ~300 ms the tabs store content is a valid `.mmap` envelope.
  3. Undo (Mod+Z) → content syncs.
  4. Switch theme → the map recolors.
  5. Corrupt the JSON via the store → the error panel appears; "Open as text" switches the language.

  Expected: all 5 pass, no console errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/MindmapCanvas.vue app/src/components/MindmapView.vue
git commit -m "refactor(mindmap): extract codec-driven MindmapCanvas from MindmapView"
```

---

### Task 5: Fullscreen fence editor with guarded writeback

**Files:**
- Create: `app/src/components/MindmapFenceOverlay.vue`
- Modify: `app/src/App.vue` (import + `<MindmapFenceOverlay />` next to `<WhiteboardOverlay />` at ~2099)

**Interfaces:**
- Consumes: `MINDMAP_OPEN_EVENT`, `MindmapOpenDetail`, `mindmapFenceCodec`, `replaceMindmapFence` (Task 1); `MindmapCanvas` (Task 4); i18n keys (Task 2); `useToastsStore`.
- Produces: listens to `solomd:mindmap-open`. Writes the owning tab's content only through `replaceMindmapFence`.

- [ ] **Step 1: Implement**

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from '../i18n';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { MINDMAP_OPEN_EVENT, mindmapFenceCodec, replaceMindmapFence, type MindmapOpenDetail } from '../lib/mindmap-fence';
import MindmapCanvas from './MindmapCanvas.vue';

const ESCAPE_KEY = 'Escape';
const TOPIC_EDITOR_ID = 'input-box';

const { t } = useI18n();
const tabs = useTabsStore();
const toasts = useToastsStore();
const target = ref<MindmapOpenDetail | null>(null);
const isStale = ref(false);
const canvas = ref<InstanceType<typeof MindmapCanvas> | null>(null);

function onOpen(e: Event): void {
  const detail = (e as CustomEvent<MindmapOpenDetail>).detail;
  if (!detail) return;
  close();
  isStale.value = false;
  target.value = { ...detail };
}

function markStale(): void {
  isStale.value = true;
  toasts.error(t('mindmap.fenceStale'));
}

function onUpdate(nextBody: string): void {
  const current = target.value;
  const tab = current && tabs.tabs.find((x) => x.id === current.tabId);
  if (!current || !tab || isStale.value) return;
  const result = replaceMindmapFence(tab.content ?? '', current, nextBody);
  if (!result.ok) return markStale();
  target.value = { ...current, body: nextBody };
  if (result.source !== tab.content) tabs.setContent(current.tabId, result.source);
}

function close(): void {
  canvas.value?.flush();
  target.value = null;
}

function onKeydown(e: KeyboardEvent): void {
  if (!target.value || e.key !== ESCAPE_KEY) return;
  if (e.target instanceof HTMLElement && e.target.id === TOPIC_EDITOR_ID) return;
  e.preventDefault();
  close();
}

onMounted(() => {
  window.addEventListener(MINDMAP_OPEN_EVENT, onOpen);
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener(MINDMAP_OPEN_EVENT, onOpen);
  window.removeEventListener('keydown', onKeydown);
  close();
});
</script>

<template>
  <div v-if="target" class="mm-overlay">
    <div class="mm-overlay__bar">
      <span class="mm-overlay__title">{{ t('mindmap.fenceEditorTitle') }}</span>
      <button type="button" class="mm-overlay__close" @click="close">{{ t('mindmap.close') }}</button>
    </div>
    <div class="mm-overlay__surface">
      <MindmapCanvas ref="canvas" :content="target.body" :codec="mindmapFenceCodec" @update:content="onUpdate" />
    </div>
  </div>
</template>
```

Styles: copy `.wb-overlay*` rules from `WhiteboardOverlay.vue`, renamed to `.mm-overlay*`.

Why `target.body` doubles as both the canvas `content` and the guard body: after each write the canvas's `lastSynced` equals the new body, so its `content` watcher sees no change and does not refresh.

Re-open while already open: `close()` flushes the old canvas before the new target mounts (`:key` is not needed because `v-if` remounts when `target` goes `null` → value in the same tick. If it does not remount, add `:key="target.tabId + ':' + target.index"`.)

- [ ] **Step 2: Mount in `App.vue`** — `import MindmapFenceOverlay from './components/MindmapFenceOverlay.vue';` and `<MindmapFenceOverlay />` directly after `<WhiteboardOverlay />`. Consider `defineAsyncComponent` to keep mind-elixir out of the main chunk (match how `PaneContent.vue` loads `MindmapView`).

- [ ] **Step 3: Verify** — `pnpm build`; in `solomd-web` with `DOC` loaded:
  1. Preview → "Open fullscreen" on the second map → the overlay shows `Second`.
  2. Add a child → within ~300 ms the second fence body in the store is `- Second\n  - <new>`; the first fence is byte-identical.
  3. While the overlay is open, prepend a new fence via the store, then edit again → the write lands on the right fence (body fallback).
  4. Delete that fence's body via the store, then edit → stale toast; no further writes.
  5. Esc while editing a topic cancels the edit only; a second Esc closes the overlay.

  Expected: all 5 pass.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/MindmapFenceOverlay.vue app/src/App.vue
git commit -m "feat(mindmap): fullscreen fence editor with guarded debounced writeback"
```

---

### Task 6: Live editor widget (`cm-live-blocks.ts`)

**Files:**
- Modify: `app/src/lib/cm-live-blocks.ts` (new `MindmapWidget` class near `MermaidWidget` ~405; build-loop branch before the mermaid branch ~907; CSS in `liveBlocksTheme` near the tldraw card ~1256)

**Interfaces:**
- Consumes: `mountReadOnlyMindmap`, `ReadOnlyMindmap` (Task 3); `isMindmapFenceInfo`, `MINDMAP_OPEN_EVENT`, `MindmapOpenDetail` (Task 1); existing `BlockOptions.getTabId`, `getMermaidTheme` (returns `'dark' | 'default'`), and `getBoardStrings` pattern.
- Produces: `BlockOptions.getMindmapStrings?: () => { openFull: string; parseError: string }` (optional; English fallback). Wire it in `Editor.vue` next to `getBoardStrings`, using `t('mindmap.fenceOpenFull')` / `t('mindmap.fenceParseError')`.

- [ ] **Step 1: Widget class**

```ts
const MINDMAP_FALLBACK_STRINGS = { openFull: 'Open fullscreen', parseError: 'Mind map could not be read' };

class MindmapWidget extends WidgetType {
  private map: ReadOnlyMindmap | null = null;

  constructor(
    private readonly body: string,
    private readonly index: number,
    private readonly isDark: boolean,
    private readonly opts: BlockOptions,
  ) {
    super();
  }

  eq(other: MindmapWidget): boolean {
    return other.body === this.body && other.index === this.index && other.isDark === this.isDark;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-live-block cm-live-block--mindmap';
    const canvas = document.createElement('div');
    wrap.append(canvas, this.openButton());
    void this.mount(wrap, canvas);
    return wrap;
  }

  private strings() {
    return this.opts.getMindmapStrings?.() ?? MINDMAP_FALLBACK_STRINGS;
  }

  private openButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cm-mindmap-open';
    button.textContent = this.strings().openFull;
    button.addEventListener('click', () => this.open());
    return button;
  }

  private open(): void {
    const tabId = this.opts.getTabId?.();
    if (!tabId) return;
    const detail: MindmapOpenDetail = { tabId, index: this.index, body: this.body };
    window.dispatchEvent(new CustomEvent(MINDMAP_OPEN_EVENT, { detail }));
  }

  private async mount(wrap: HTMLElement, canvas: HTMLElement): Promise<void> {
    const result = await mountReadOnlyMindmap(canvas, this.body, this.isDark);
    if (result.ok) {
      this.map = result.map;
      window.dispatchEvent(new CustomEvent('solomd:cm-relayout'));
      return;
    }
    wrap.classList.add('cm-live-block--broken');
    wrap.textContent = `${this.strings().parseError}: ${result.error}`;
  }

  destroy(): void {
    this.map?.destroy();
    this.map = null;
  }

  ignoreEvent(): boolean {
    return true;
  }
}
```

`ignoreEvent → true` lets the map pan and zoom without CodeMirror moving the cursor. Users reach the source with the keyboard (arrow into the block), which reveals it (cursor-inside rule).

- [ ] **Step 2: Build-loop branch** — insert before the mermaid branch. Keep a counter `let mindmapIndex = 0;` declared next to the loop's other per-build state, and increment it for every mindmap fence, revealed or not:

```ts
          const mindmapOpen = /^\s{0,3}(`{3,}|~{3,})\s*(\S*)/.exec(line.text);
          if (mindmapOpen && isMindmapFenceInfo(mindmapOpen[2])) {
            const run = mindmapOpen[1];
            const closeRe = new RegExp(`^\\s{0,3}\\${run[0]}{${run.length},}\\s*$`);
            let endI = i + 1;
            while (endI <= lastLine && !closeRe.test(doc.line(endI).text)) endI += 1;
            if (endI <= lastLine) {
              const index = mindmapIndex++;
              const cursorInside = keepSource || (cursorLine >= i && cursorLine <= endI);
              const cursorInsideEnd = cursorLineEnd >= i && cursorLineEnd <= endI;
              if (!cursorInside && !cursorInsideEnd) {
                const body = doc.sliceString(doc.line(i + 1).from, doc.line(endI).from).replace(/\n$/, '');
                const isDark = opts.getMermaidTheme?.() === 'dark';
                builder.add(doc.line(i).from, doc.line(endI).to, Decoration.replace({
                  widget: new MindmapWidget(body, index, isDark, opts),
                  block: true,
                }));
              }
              i = endI + 1;
              continue;
            }
          }
```

If `endI === i + 1` (empty body), `doc.line(i + 1)` is the closing line, so the slice is `''`; that is correct.

The CM index counts only top-level-scanned fences and so can differ from `findMindmapFences` for fences in blockquotes. The body guard covers this.

Before the CSS step, confirm the mindmap branch sits before any generic fenced-code branch that would otherwise claim the block.

- [ ] **Step 3: CSS** in `liveBlocksTheme`:

```ts
  '.cm-live-block--mindmap': { position: 'relative', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' },
  '.cm-mindmap-open': { position: 'absolute', insetBlockStart: '8px', insetInlineEnd: '8px', zIndex: '2' },
  '.cm-live-block--mindmap me-tpc': { unicodeBidi: 'plaintext', textAlign: 'start' },
```

- [ ] **Step 4: Wire strings in `Editor.vue`** next to `getBoardStrings`:

```ts
        getMindmapStrings: () => ({ openFull: t('mindmap.fenceOpenFull'), parseError: t('mindmap.fenceParseError') }),
```

- [ ] **Step 5: Verify** — `pnpm build`; in `solomd-web` live mode with `DOC`:
  1. Cursor outside → both fences show maps; dragging pans and does not move the cursor.
  2. Arrow into the first fence → source appears; type `  - C` under Root; arrow out → the map shows C.
  3. "Open fullscreen" in the live widget → the overlay edits the right fence (same checks as Task 5 step 3 #2).
  4. Typing elsewhere in the doc does not remount the maps (no flicker; `eq` holds).
  5. Theme switch → maps re-render dark.

  Expected: all 5 pass, no console errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/cm-live-blocks.ts app/src/components/Editor.vue
git commit -m "feat(mindmap): live-editor mindmap fence widget"
```

---

### Task 7: Verification, docs, version bump, Phase 4 handoff

**Files:**
- Modify: `docs/design/mindmap/2026-10-11-mindmap-design.md` (phase table: Phase 3 complete; Phase 3 section: decisions table summary + "ids → `[^ref]` anchors")
- Modify: this plan's `## Status`
- Modify: `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock` (`solomd` entry), `app/src-tauri/tauri.conf.json` — patch bump `4.14.10` → `4.14.11`

- [ ] **Step 1: Full checks** — run every new or touched lib test (`fence-scan`, `mindmap-fence`, `mindmap-format`, `fence-languages`, `mindmap-direction`, `mindmap-keymap`) and `pnpm build`. Expected: all pass; the 12 pre-existing failures are unchanged (compare with `git stash` if unsure).
- [ ] **Step 2: Browser end-to-end** with a Hebrew-root fence (`- תוכנית\n  - שלב א`): it renders leftward in Preview and in the live widget; a fullscreen edit writes back; reload keeps the content. Take a screenshot as proof.
- [ ] **Step 3: Security spot-check** — fence `- [x](javascript:alert(1)) {"background":"url(javascript:x)"}` renders as text, with no `href`/`style` containing `javascript:` in the DOM (`document.querySelectorAll('.mindmap-block [href*="javascript"], .mindmap-block [style*="javascript"]').length === 0`).
- [ ] **Step 4: Docs** — update the spec phase table + Phase 3 section; fill this plan's Status (date, commits per task, deviations, open items: `Editor.vue` plain mode, slash insert, native Tauri check).
- [ ] **Step 5: Version bump** — the four files above; run `cd app/src-tauri && cargo metadata --format-version 1 >/dev/null` (or `cargo check -q`) to confirm the lockfile is consistent.
- [ ] **Step 6: Commit**

```bash
git add docs app/package.json app/src-tauri/Cargo.toml app/src-tauri/Cargo.lock app/src-tauri/tauri.conf.json
git commit -m "chore(release): mindmap phase 3 docs and bump version to 4.14.11"
```

- [ ] **Step 7: Phase 4 handoff prompt** — write it in chat, in the shape of the Phase 3 prompt: context, what Phases 1–3 built (`MindmapCanvas` + codec, fence codec, overlay), the Phase 4 scope from the spec (export, copy plaintext, jump to source, read-only toggle, palette, gates incl. fence syntax `- => <id>`), constraints, process.
