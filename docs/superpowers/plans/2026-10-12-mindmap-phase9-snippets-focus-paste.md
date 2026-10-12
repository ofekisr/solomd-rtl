# Mindmap Phase 9 — Snippets, Freeze + Focus, Paste Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `.mmap` holds Markdown / Mermaid / nested-map snippets beside the map. A frozen strip keeps the root and level 2 visible while any node acts as the canvas root. Cmd+V imports structured text as a subtree. Phase 8's deferred minors are fixed.

**Architecture:** Pure logic lives in focused `src/lib` modules, each unit-tested with `node:test`:
- `mindmap-snippets.ts`: snippet type, sanitize, ids, outline Markdown.
- `mindmap-focus.ts`: strip model and per-tab in-memory focus store.
- `mindmap-paste.ts`: clipboard text → nodes, arrows and summaries.
- `mindmap-paste-remap.ts`: old → new id map after Mind Elixir regenerates ids.

`MindmapCanvas.vue` carries snippets like it carries `displayOverride`: it loads them on parse, keeps them across syncs, and exposes get/set. It also owns focus (wrapping `focusNode`/`cancelFocus`), the frozen strip, and the `pasteHandler`. `MindmapView.vue` renders a snippet panel under the canvas.

**Tech Stack:** Vue 3.5 (`useId` available), Pinia, TypeScript, `mind-elixir` 5.15.1, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-12-mindmap-phase9-snippets-focus-design.md`. Parent: `docs/superpowers/specs/2026-10-11-mindmap-design.md`. Previous: `docs/superpowers/plans/2026-10-12-mindmap-phase8-lens.md`.

## Global Constraints

- Branch `feat/mindmap-phase9` off `feat/mindmap-phase8` (or `main` after Phase 8 merges); no worktree; never push.
- pnpm in `app/`. Phase 9 adds no npm dependency.
- TypeScript: no `any`, no zod (plain type guards), constants for every literal value, functions ≤ ~20 lines, early returns, no comments except non-obvious "why".
- `src/lib` imports between lib files use the `.ts` extension (node test runner requirement). Components, stores and composables import without extension.
- Lookups by an untrusted string key use `Object.hasOwn` (never `key in obj`).
- Unit tests: `cd app && node --test --experimental-strip-types src/lib/<file>.test.ts`.
- Build: `cd app && pnpm build` must pass at the end of every task that touches `.vue`, stores or composables.
- Browser checks: `preview_start` with name `solomd-web` (`.claude/launch.json`, port 1420). Use a workspace `.mmap` with ≥ 4 levels, one Hebrew topic, one gate, one arrow between two nodes of the same subtree.
- Known pre-existing failures, out of scope: 12 `src/lib/*.test.ts` files with extensionless imports; one Rust assertion in `detect_language_from_extension`.
- Every map payload passes a sanitizer (`sanitizeMindmapData` / `sanitizeNodeObj`) before it is rendered or inserted.
- File version stays `1`. A file without snippets serializes byte-identical to Phase 8.
- New user-facing strings go in `app/src/i18n/en.ts` only (the `mindmap:` block). `t` supports `{name}` substitution only — no plural rules.
- Layout uses logical properties (`inset-inline-*`, `margin-inline-*`, `padding-inline-*`) so RTL mirrors. User text uses `dir="auto"` / `unicode-bidi: plaintext`.
- Colors use the app tokens `--bg`, `--bg-elev`, `--text`, `--text-faint`, `--border`, `--accent`.
- No new default key bindings.
- Commit trailer: `Co-Authored-By: Claude <model> 5.5 <noreply@anthropic.com>` (use the implementer's model name).

## Spec deltas (decided while planning)

| Spec says | Plan does | Why |
|---|---|---|
| Card edit toggles to "a code editor" | `<textarea dir="auto">` with monospace font | The only CodeMirror surface is the full `Editor.vue`, bound to a `Tab`. A small wrapper is out of scope |
| Snippet edits "go through undo" | Not in Mind Elixir's undo history. Textarea has native undo while editing; delete needs a second click to confirm | Mind Elixir history only covers `nodeData`; snippets live outside it |
| `mmap` snippet: small canvas "with an expand button" | Rendered by `Preview` as a read-only mindmap fence (360 px). No expand button | `Preview` already renders `mindmap` fences; a `Preview` with no `tabId` adds no "Open" button, so no fence side effects |
| Markdown and HTML exports include snippets | Markdown export and "Open as Markdown headings" append `## Snippets`. HTML export unchanged | The HTML export is the package's interactive player with embedded map JSON; adding rendered Markdown needs a new renderer |
| Outline preview: snippets as fences | Outline **text** uses fences for every kind; outline **preview** inlines `md` bodies raw so they render as Markdown | A `markdown` fence would render as code in preview |
| Strip in "map renderer cells" | Strip in `MindmapView` map cells only. Reading's wide map shows the whole map without a strip | Reading is a view, not a work surface; keeps `MindmapReading` unchanged |
| Focus entry points incl. "side panel button" | Palette, node context menu (the package's "Focus" item), strip chips | The context menu already has Focus; a panel button duplicates it |
| Gates/arrows/summaries remapped by the Phase 5 merge rewriter | Remapped by walking pasted and inserted trees in parallel (`mindmap-paste-remap.ts`) | `copyNodes` regenerates every id itself (`we()`), so prefixing before insert is useless |
| Pasted arrows and summaries in the same undo step | Inserted via `createArrowFrom` / `createSummaryFrom`: one extra undo step each | Those are the package's only public APIs that keep the operation bus in sync |
| Snippet panel "remembers collapsed state per tab" | Component state: kept while the cell stays mounted, reset when the cell changes | Avoids a new `Tab` field for a cosmetic toggle |
| Carry-over §4 #6 (`duplicateCount` reset in teardown) | Dropped: already fixed (`teardown()` sets it to 0) | Found during planning |
| Carry-over §4 #8 (read-only toggle pressed during lock) | Dropped: `aria-pressed` reads the canvas toggle only; the button is disabled while locked | Found during planning |

## File Map

| File | Change | Task |
|---|---|---|
| `app/src/lib/mindmap-snippets.ts` (+ test) | Create | 1 |
| `app/src/lib/mindmap-format.ts` (+ test) | `snippets` in parse result and serialize | 1 |
| `app/src/lib/mindmap-fence.ts` | Parse result gets `snippets: []` | 1 |
| `app/src/lib/mindmap-outline.ts` (+ test) | Snippets section, `mode` param | 2 |
| `app/src/lib/mindmap-export.ts` (+ test) | Markdown export appends snippets | 2 |
| `app/src/composables/useMindmapExport.ts`, `useMindmapCanvasActions.ts` | Pass snippets | 2, 3 |
| `app/src/lib/mindmap-active.ts` | `getSnippets` / `setSnippets` on `MindmapCanvasApi` | 3 |
| `app/src/components/MindmapCanvas.vue` | Snippets (3), focus + strip (6), paste (8), carry-over (9) | 3, 6, 8, 9 |
| `app/src/components/MindmapSnippets.vue`, `MindmapSnippetCard.vue` | Create | 4 |
| `app/src/components/MindmapView.vue` | Snippet panel (4), focus key (6), carry-over (9) | 4, 6, 9 |
| `app/src/components/MindmapReading.vue` | Read-only snippet panel (4), invalid state (9) | 4, 9 |
| `app/src/lib/mindmap-focus.ts` (+ test) | Create | 5 |
| `app/src/components/MindmapFreezeStrip.vue` | Create | 6 |
| `app/src/lib/mindmap-paste.ts` (+ test) | Create | 7 |
| `app/src/lib/mindmap-paste-remap.ts` (+ test) | Create | 8 |
| `app/src/components/MindmapMapFields.vue` | `useId` label | 9 |
| `app/src/components/MindmapOutlineInvalid.vue` | Create | 9 |
| `app/src/i18n/en.ts` | New strings | 4, 6, 8, 9 |

---

### Task 1: Snippet model and file format

**Files:**
- Create: `app/src/lib/mindmap-snippets.ts`, `app/src/lib/mindmap-snippets.test.ts`
- Modify: `app/src/lib/mindmap-format.ts` (envelope, `MindmapParseResult`, `serializeMindmap`, `parseMindmap`, `MindmapCodec`)
- Modify: `app/src/lib/mindmap-fence.ts:36,38` (add `snippets: []`)
- Test: `app/src/lib/mindmap-format.test.ts`

**Interfaces:**
- Produces:
  - `export type SnippetKind = 'md' | 'mermaid' | 'mmap'`
  - `export interface Snippet { id: string; kind: SnippetKind; title: string; body: string }`
  - `export const SNIPPET_KINDS: readonly SnippetKind[]`
  - `export function sanitizeSnippets(value: unknown): Snippet[]`
  - `export function nextSnippetId(existing: readonly Snippet[]): string` → `s1`, `s2`, …
  - `export function createSnippet(kind: SnippetKind, existing: readonly Snippet[], title: string): Snippet`
  - `MindmapParseResult` ok-branch gains `snippets: Snippet[]`
  - `serializeMindmap(data, display = {}, snippets: readonly Snippet[] = [])`
  - `MindmapCodec.serialize(data, display?, snippets?)`

- [ ] **Step 1: Write the failing snippet tests**

```ts
// app/src/lib/mindmap-snippets.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSnippet, nextSnippetId, sanitizeSnippets } from './mindmap-snippets.ts';

test('sanitizeSnippets keeps valid entries in order', () => {
  const input = [{ id: 's1', kind: 'md', title: 'Intro', body: '# Hi' }, { id: 's2', kind: 'mermaid', title: 'Flow', body: 'graph LR; A-->B' }];
  assert.deepEqual(sanitizeSnippets(input), input);
});

test('sanitizeSnippets drops unknown kinds and non-string fields', () => {
  const input = [{ id: 's1', kind: 'html', title: 'x', body: '<b>' }, { id: 's2', kind: 'md', title: 3, body: 'x' }, 'junk', null];
  assert.deepEqual(sanitizeSnippets(input), []);
});

test('sanitizeSnippets regenerates invalid and duplicate ids', () => {
  const out = sanitizeSnippets([
    { id: 's1', kind: 'md', title: 'a', body: '' },
    { id: 's1', kind: 'md', title: 'b', body: '' },
    { id: 'bad id!', kind: 'mmap', title: 'c', body: '- R' },
  ]);
  assert.deepEqual(out.map((s) => s.id), ['s1', 's2', 's3']);
});

test('sanitizeSnippets returns [] for non-arrays', () => {
  assert.deepEqual(sanitizeSnippets(undefined), []);
  assert.deepEqual(sanitizeSnippets({}), []);
});

test('nextSnippetId continues after the highest s<n>', () => {
  assert.equal(nextSnippetId([]), 's1');
  assert.equal(nextSnippetId([{ id: 's4', kind: 'md', title: '', body: '' }, { id: 'x', kind: 'md', title: '', body: '' }]), 's5');
});

test('createSnippet builds an empty snippet with a fresh id', () => {
  assert.deepEqual(createSnippet('mermaid', [], 'Untitled'), { id: 's1', kind: 'mermaid', title: 'Untitled', body: '' });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-snippets.test.ts`
Expected: FAIL — cannot find module `./mindmap-snippets.ts`.

- [ ] **Step 3: Implement `mindmap-snippets.ts`**

```ts
// app/src/lib/mindmap-snippets.ts
export type SnippetKind = 'md' | 'mermaid' | 'mmap';
export interface Snippet { id: string; kind: SnippetKind; title: string; body: string }

export const SNIPPET_KINDS: readonly SnippetKind[] = ['md', 'mermaid', 'mmap'];
const ID_PREFIX = 's';
const ID_PATTERN = /^[\w-]+$/u;
const NUMBERED_ID_PATTERN = /^s(\d+)$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSnippetKind(value: unknown): value is SnippetKind {
  return typeof value === 'string' && (SNIPPET_KINDS as readonly string[]).includes(value);
}

function toSnippet(value: unknown): Snippet | null {
  if (!isRecord(value) || !isSnippetKind(value.kind)) return null;
  const { id, title, body } = value;
  if (typeof id !== 'string' || typeof title !== 'string' || typeof body !== 'string') return null;
  return { id, kind: value.kind, title, body };
}

export function nextSnippetId(existing: readonly Snippet[]): string {
  const numbers = existing.map((s) => NUMBERED_ID_PATTERN.exec(s.id)?.[1]).filter((n): n is string => n !== undefined).map(Number);
  return `${ID_PREFIX}${Math.max(0, ...numbers) + 1}`;
}

function withUniqueIds(snippets: Snippet[]): Snippet[] {
  const out: Snippet[] = [];
  for (const snippet of snippets) {
    const isTaken = !ID_PATTERN.test(snippet.id) || out.some((s) => s.id === snippet.id);
    out.push(isTaken ? { ...snippet, id: nextSnippetId([...out, ...snippets]) } : snippet);
  }
  return out;
}

export function sanitizeSnippets(value: unknown): Snippet[] {
  if (!Array.isArray(value)) return [];
  return withUniqueIds(value.map(toSnippet).filter((s): s is Snippet => s !== null));
}

export function createSnippet(kind: SnippetKind, existing: readonly Snippet[], title: string): Snippet {
  return { id: nextSnippetId(existing), kind, title, body: '' };
}
```

Note on `withUniqueIds`: the regenerated id counts both already-accepted and incoming snippets so it never collides with a later valid id. In the duplicate test the incoming list holds `s1, s1, bad id!`, so the second `s1` becomes `s2` and `bad id!` becomes `s3`.

- [ ] **Step 4: Run snippet tests**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-snippets.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Write the failing format tests** (append to `app/src/lib/mindmap-format.test.ts`)

```ts
import { serializeMindmap, parseMindmap } from './mindmap-format.ts';

const BASE = { nodeData: { id: 'root', topic: 'Root', children: [] } };
const SNIPPETS = [{ id: 's1', kind: 'md' as const, title: 'Intro', body: '# שלום' }];

test('serializeMindmap omits snippets when the list is empty', () => {
  assert.equal(serializeMindmap(BASE, {}, []), serializeMindmap(BASE));
  assert.ok(!serializeMindmap(BASE).includes('snippets'));
});

test('snippets round-trip through serialize and parse', () => {
  const parsed = parseMindmap(serializeMindmap(BASE, {}, SNIPPETS), 'x');
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.snippets, SNIPPETS);
});

test('parseMindmap sanitizes snippets and tolerates a missing key', () => {
  const text = JSON.stringify({ format: 'solomd-mindmap', version: 1, data: BASE, snippets: [{ id: 's1', kind: 'exe', title: '', body: '' }] });
  const parsed = parseMindmap(text, 'x');
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.snippets, []);
  const empty = parseMindmap('', 'x');
  assert.ok(empty.ok);
  assert.deepEqual(empty.snippets, []);
});
```

If `test`/`assert` are already imported at the top of the file, do not import them again.

- [ ] **Step 6: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-format.test.ts`
Expected: FAIL — `parsed.snippets` is `undefined`.

- [ ] **Step 7: Extend `mindmap-format.ts`**

```ts
import { sanitizeSnippets, type Snippet } from './mindmap-snippets.ts';

interface MindmapEnvelope {
  format: typeof FORMAT_ID;
  version: typeof FORMAT_VERSION;
  data: MindElixirData;
  display?: MapDisplay;
  snippets?: Snippet[];
}

export type MindmapParseResult =
  | { ok: true; data: MindElixirData; isEmpty: boolean; display: MapDisplay; snippets: Snippet[] }
  | { ok: false; error: string };

export function serializeMindmap(data: MindElixirData, display: MapDisplay = {}, snippets: readonly Snippet[] = []): string {
  const envelope: MindmapEnvelope = { format: FORMAT_ID, version: FORMAT_VERSION, data: documentFields(data) };
  if (Object.keys(display).length > 0) envelope.display = display;
  if (snippets.length > 0) envelope.snippets = [...snippets];
  return `${JSON.stringify(envelope, null, JSON_INDENT)}\n`;
}
```

In `parseMindmap`: the empty branch returns `snippets: []`; the final return adds `snippets: sanitizeSnippets(envelope.snippets)`.

Codec:

```ts
export interface MindmapCodec {
  parse(text: string): MindmapParseResult;
  serialize(data: MindElixirData, display?: MapDisplay, snippets?: readonly Snippet[]): string;
}

export function mmapCodec(fileName: string): MindmapCodec {
  const fallbackTopic = rootTopicFromFileName(fileName);
  return {
    parse: (text) => parseMindmap(text, fallbackTopic),
    serialize: (data, display, snippets) => serializeMindmap(data, display, snippets),
  };
}
```

In `mindmap-fence.ts` lines 36 and 38 add `snippets: []` to both ok results. `serializeMindmapFence` keeps its signature (fences never carry snippets).

- [ ] **Step 8: Run tests and build**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-snippets.test.ts src/lib/mindmap-format.test.ts src/lib/mindmap-fence.test.ts && pnpm build`
Expected: all pass; build succeeds (fix any other `ok: true` constructors that `vue-tsc` reports by adding `snippets: []`).

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/mindmap-snippets.ts app/src/lib/mindmap-snippets.test.ts app/src/lib/mindmap-format.ts app/src/lib/mindmap-format.test.ts app/src/lib/mindmap-fence.ts
git commit -m "feat(mindmap): snippets key in .mmap with sanitize and stable ids"
```

---

### Task 2: Snippets in outline Markdown and exports

**Files:**
- Modify: `app/src/lib/mindmap-snippets.ts` (Markdown section)
- Modify: `app/src/lib/mindmap-outline.ts`, `app/src/lib/mindmap-export.ts`, `app/src/composables/useMindmapExport.ts`
- Test: `app/src/lib/mindmap-snippets.test.ts`, `app/src/lib/mindmap-outline.test.ts`, `app/src/lib/mindmap-export.test.ts`

**Interfaces:**
- Consumes: `Snippet` (Task 1), `MindmapParseResult.snippets` (Task 1).
- Produces:
  - `export type SnippetMarkdownMode = 'source' | 'rendered'`
  - `export function snippetsMarkdown(snippets: readonly Snippet[], mode: SnippetMarkdownMode): string` → `''` for no snippets
  - `export function snippetPreviewSource(snippet: Snippet): string` (used by Task 4 cards)
  - `outlineMarkdownOf(parsed: ParsedMap, mode: SnippetMarkdownMode = 'source'): string`
  - `buildTextExport(data, format, snippets: readonly Snippet[] = [])`
  - `exportMap(mind, format, baseName, snippets: readonly Snippet[] = [])`

- [ ] **Step 1: Write failing tests** (append to `mindmap-snippets.test.ts`)

```ts
import { snippetPreviewSource, snippetsMarkdown } from './mindmap-snippets.ts';

const ALL = [
  { id: 's1', kind: 'md' as const, title: 'Intro', body: '**bold**' },
  { id: 's2', kind: 'mermaid' as const, title: 'Flow', body: 'graph LR\n  A-->B' },
  { id: 's3', kind: 'mmap' as const, title: 'Sub', body: '- Root\n  - A' },
];

test('snippetsMarkdown is empty for no snippets', () => {
  assert.equal(snippetsMarkdown([], 'source'), '');
});

test('snippetsMarkdown source mode fences every kind', () => {
  const md = snippetsMarkdown(ALL, 'source');
  assert.match(md, /^## Snippets$/m);
  assert.match(md, /^### Intro\n\n```markdown\n\*\*bold\*\*\n```$/m);
  assert.match(md, /^```mermaid\ngraph LR\n {2}A-->B\n```$/m);
  assert.match(md, /^```mindmap\n- Root\n {2}- A\n```$/m);
});

test('snippetsMarkdown rendered mode inlines md bodies', () => {
  const md = snippetsMarkdown(ALL, 'rendered');
  assert.match(md, /^### Intro\n\n\*\*bold\*\*$/m);
  assert.ok(!md.includes('```markdown'));
});

test('fences grow past backtick runs inside the body', () => {
  const md = snippetsMarkdown([{ id: 's1', kind: 'md', title: 'T', body: 'a\n```js\nx\n```' }], 'source');
  assert.match(md, /^````markdown$/m);
});

test('untitled snippets get a placeholder heading', () => {
  assert.match(snippetsMarkdown([{ id: 's1', kind: 'md', title: '  ', body: 'x' }], 'source'), /^### s1$/m);
});

test('snippetPreviewSource renders md raw and others as fences', () => {
  assert.equal(snippetPreviewSource(ALL[0]), '**bold**');
  assert.equal(snippetPreviewSource(ALL[1]), '```mermaid\ngraph LR\n  A-->B\n```');
});
```

Append to `mindmap-outline.test.ts`:

```ts
test('outlineMarkdownOf appends the snippets section after the map', () => {
  const text = codec.serialize(DATA, {}, [{ id: 's1', kind: 'md', title: 'Notes', body: 'hello' }]);
  const md = outlineMarkdownOf(codec.parse(text), 'rendered');
  assert.ok(md.indexOf('## Child') < md.indexOf('## Snippets'));
  assert.match(md, /^hello$/m);
});
```

Append to `mindmap-export.test.ts`:

```ts
test('markdown export appends snippets', () => {
  const md = buildTextExport({ nodeData: { id: 'root', topic: 'R', children: [] } }, 'markdown', [{ id: 's1', kind: 'mermaid', title: 'F', body: 'graph LR' }]);
  assert.match(md, /```mermaid\ngraph LR\n```/);
});
```

(Import `buildTextExport` if the test file does not already.)

- [ ] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-snippets.test.ts src/lib/mindmap-outline.test.ts src/lib/mindmap-export.test.ts`
Expected: FAIL — `snippetsMarkdown` not exported.

- [ ] **Step 3: Implement in `mindmap-snippets.ts`**

```ts
export type SnippetMarkdownMode = 'source' | 'rendered';

const SECTION_HEADING = '## Snippets';
const TITLE_MARK = '### ';
const MIN_FENCE = 3;
const BACKTICK = '`';
const BACKTICK_RUN = /`+/g;
const FENCE_LANG: Record<SnippetKind, string> = { md: 'markdown', mermaid: 'mermaid', mmap: 'mindmap' };
const BLOCK_SEPARATOR = '\n\n';

function fenceOf(body: string, lang: string): string {
  const longest = Math.max(0, ...(body.match(BACKTICK_RUN) ?? []).map((run) => run.length));
  const fence = BACKTICK.repeat(Math.max(MIN_FENCE, longest + 1));
  return `${fence}${lang}\n${body}\n${fence}`;
}

function bodyBlock(snippet: Snippet, mode: SnippetMarkdownMode): string {
  if (snippet.kind === 'md' && mode === 'rendered') return snippet.body;
  return fenceOf(snippet.body, FENCE_LANG[snippet.kind]);
}

function titleOf(snippet: Snippet): string {
  return snippet.title.trim() || snippet.id;
}

export function snippetPreviewSource(snippet: Snippet): string {
  return bodyBlock(snippet, 'rendered');
}

export function snippetsMarkdown(snippets: readonly Snippet[], mode: SnippetMarkdownMode): string {
  if (snippets.length === 0) return '';
  const blocks = snippets.map((s) => `${TITLE_MARK}${titleOf(s)}${BLOCK_SEPARATOR}${bodyBlock(s, mode)}`);
  return `${[SECTION_HEADING, ...blocks].join(BLOCK_SEPARATOR)}\n`;
}
```

- [ ] **Step 4: Outline**

```ts
// app/src/lib/mindmap-outline.ts
import { snippetsMarkdown, type SnippetMarkdownMode } from './mindmap-snippets.ts';

const SECTION_GAP = '\n';

export function outlineMarkdownOf(parsed: ParsedMap, mode: SnippetMarkdownMode = 'source'): string {
  if (!parsed.ok) return '';
  const map = mapToHeadingsMarkdown(withoutGateArrows(parsed.data));
  const snippets = snippetsMarkdown(parsed.snippets, mode);
  return snippets === '' ? map : `${map}${SECTION_GAP}${snippets}`;
}
```

- [ ] **Step 5: Export**

In `mindmap-export.ts`, give `buildTextExport` a third parameter and append for Markdown only:

```ts
export function buildTextExport(data: MindElixirData, format: MindmapTextFormat, snippets: readonly Snippet[] = []): string {
  const text = TEXT_BUILDERS[format](data);
  if (format !== 'markdown' || snippets.length === 0) return text;
  return `${text.trimEnd()}\n\n${snippetsMarkdown(snippets, 'source')}`;
}
```

Keep the existing builder table name (read the file; the table at line ~48 maps formats to builders). Import `snippetsMarkdown` and `type Snippet` with `.ts` extensions.

In `useMindmapExport.ts`, add `snippets: readonly Snippet[] = []` as the last parameter of `exportMap` and pass it into `buildTextExport(mind.getData(), format, snippets)`.

- [ ] **Step 6: Run tests and build**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-snippets.test.ts src/lib/mindmap-outline.test.ts src/lib/mindmap-export.test.ts && pnpm build`
Expected: PASS; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/mindmap-snippets.ts app/src/lib/mindmap-snippets.test.ts app/src/lib/mindmap-outline.ts app/src/lib/mindmap-outline.test.ts app/src/lib/mindmap-export.ts app/src/lib/mindmap-export.test.ts app/src/composables/useMindmapExport.ts
git commit -m "feat(mindmap): snippets section in outline Markdown and Markdown export"
```

---

### Task 3: Canvas carries snippets

**Files:**
- Modify: `app/src/components/MindmapCanvas.vue` (`loadData`, `syncNow`, `pristineSerialized`, `defineExpose`)
- Modify: `app/src/lib/mindmap-active.ts` (`MindmapCanvasApi`)
- Modify: `app/src/composables/useMindmapCanvasActions.ts` (context + exports + headings doc)

**Interfaces:**
- Consumes: `Snippet`, codec `serialize(data, display, snippets)`, `snippetsMarkdown`, `exportMap(..., snippets)`.
- Produces on `MindmapCanvasApi`: `getSnippets(): Snippet[]`, `setSnippets(next: readonly Snippet[]): void`.
- `CanvasActionContext` gains `getSnippets(): readonly Snippet[]`.

- [ ] **Step 1: Hold snippets in the canvas**

```ts
let snippetsOverride: Snippet[] = [];

function loadData(): MindElixirData | null {
  const parsed = props.codec.parse(props.content);
  if (!parsed.ok) {
    parseError.value = parsed.error;
    return null;
  }
  parseError.value = null;
  displayOverride = parsed.display;
  snippetsOverride = parsed.snippets;
  return parsed.data;
}
```

Replace both `props.codec.serialize(mind.getData(), displayOverride)` calls (in `syncNow` and the `pristineSerialized` line in `mount`) with `props.codec.serialize(mind.getData(), displayOverride, snippetsOverride)`.

```ts
function setSnippets(next: readonly Snippet[]): void {
  if (isEditBlocked() || isGraphView.value) return;
  snippetsOverride = [...next];
  scheduleSync();
}
```

Add to `defineExpose`: `getSnippets: () => snippetsOverride, setSnippets,`.

- [ ] **Step 2: Extend the API type**

```ts
// app/src/lib/mindmap-active.ts
import type { Snippet } from './mindmap-snippets.ts';
// inside MindmapCanvasApi
  getSnippets(): Snippet[];
  setSnippets(next: readonly Snippet[]): void;
```

- [ ] **Step 3: Exports and headings document use snippets**

In `useMindmapCanvasActions.ts`:
- `CanvasActionContext` gets `getSnippets(): readonly Snippet[];`.
- `exportAs`: `void exportMap(mind, format, ctx.exportName(), ctx.getSnippets());`.
- `openHeadingsDocument`:

```ts
const markdown = mapToHeadingsMarkdown(withoutGateArrows(mind.getData()));
const snippets = snippetsMarkdown(ctx.getSnippets(), 'source');
tabs.setContent(tab.id, snippets === '' ? markdown : `${markdown}\n${snippets}`);
```

In `MindmapCanvas.vue`, pass `getSnippets: () => snippetsOverride` in the `useMindmapCanvasActions({...})` call.

- [ ] **Step 4: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 5: Browser check**

1. Open a `.mmap`, Data lens · Edit. Add `"snippets": [{"id":"s1","kind":"md","title":"T","body":"hi"}]` at the top level, switch to Map · Live edit, rename a node.
2. Switch to Data: the `snippets` key is still there after the map sync.
3. Remove the key, edit the map: the file has no `snippets` key.
4. Export → Markdown: the saved file ends with `## Snippets`.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/MindmapCanvas.vue app/src/lib/mindmap-active.ts app/src/composables/useMindmapCanvasActions.ts
git commit -m "feat(mindmap): canvas keeps snippets across syncs; exports include them"
```

---

### Task 4: Snippet panel

**Files:**
- Create: `app/src/components/MindmapSnippetCard.vue`, `app/src/components/MindmapSnippets.vue`
- Modify: `app/src/components/MindmapView.vue` (map part wrapper, snippet state), `app/src/components/MindmapReading.vue` (read-only panel under the wide map), `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: `Snippet`, `SnippetKind`, `SNIPPET_KINDS`, `createSnippet`, `snippetPreviewSource`, `MindmapCanvasApi.getSnippets/setSnippets`.
- Produces:
  - `MindmapSnippets.vue` props `{ snippets: readonly Snippet[]; editable: boolean }`, emit `change: [next: Snippet[]]`.
  - `MindmapSnippetCard.vue` props `{ snippet: Snippet; editable: boolean; isFirst: boolean; isLast: boolean }`, emits `update: [next: Snippet]`, `remove: []`, `move: [delta: -1 | 1]`.

- [ ] **Step 1: i18n** (inside `mindmap:` in `en.ts`)

```ts
    snippetsTitle: 'Snippets',
    snippetsEmpty: 'No snippets yet',
    snippetsCollapse: 'Hide snippets',
    snippetsExpand: 'Show snippets',
    snippetAddMd: '+ Markdown',
    snippetAddMermaid: '+ Mermaid',
    snippetAddMmap: '+ Map',
    snippetKindMd: 'Markdown',
    snippetKindMermaid: 'Mermaid',
    snippetKindMmap: 'Map',
    snippetUntitled: 'Untitled',
    snippetTitleLabel: 'Snippet title',
    snippetBodyLabel: 'Snippet source',
    snippetEdit: 'Edit',
    snippetDone: 'Done',
    snippetDelete: 'Delete',
    snippetDeleteConfirm: 'Click again to delete',
    snippetMoveUp: 'Move up',
    snippetMoveDown: 'Move down',
```

- [ ] **Step 2: Card**

```vue
<!-- app/src/components/MindmapSnippetCard.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Snippet, SnippetKind } from '../lib/mindmap-snippets';
import { snippetPreviewSource } from '../lib/mindmap-snippets';
import { useI18n } from '../i18n';
import Preview from './Preview.vue';

const CONFIRM_WINDOW_MS = 3000;
const KIND_LABEL_KEYS: Record<SnippetKind, string> = { md: 'mindmap.snippetKindMd', mermaid: 'mindmap.snippetKindMermaid', mmap: 'mindmap.snippetKindMmap' };

const props = defineProps<{ snippet: Snippet; editable: boolean; isFirst: boolean; isLast: boolean }>();
const emit = defineEmits<{ update: [next: Snippet]; remove: []; move: [delta: -1 | 1] }>();
const { t } = useI18n();
const isEditing = ref(false);
const isConfirmingDelete = ref(false);
let confirmTimer: number | null = null;
const previewSource = computed(() => snippetPreviewSource(props.snippet));

function patch(fields: Partial<Pick<Snippet, 'title' | 'body'>>): void {
  emit('update', { ...props.snippet, ...fields });
}

function onInput(field: 'title' | 'body', e: Event): void {
  patch({ [field]: (e.target as HTMLInputElement | HTMLTextAreaElement).value });
}

function requestDelete(): void {
  if (isConfirmingDelete.value) {
    emit('remove');
    return;
  }
  isConfirmingDelete.value = true;
  confirmTimer = window.setTimeout(() => { isConfirmingDelete.value = false; }, CONFIRM_WINDOW_MS);
}

function stopEditing(): void {
  isEditing.value = false;
  if (confirmTimer !== null) window.clearTimeout(confirmTimer);
}
</script>

<template>
  <article class="mm-snippet" :data-kind="snippet.kind">
    <header class="mm-snippet__head">
      <span class="mm-snippet__kind">{{ t(KIND_LABEL_KEYS[snippet.kind]) }}</span>
      <input
        v-if="isEditing"
        class="mm-snippet__title-input"
        dir="auto"
        :aria-label="t('mindmap.snippetTitleLabel')"
        :value="snippet.title"
        @input="onInput('title', $event)"
      />
      <h4 v-else class="mm-snippet__title" dir="auto">{{ snippet.title || snippet.id }}</h4>
      <div v-if="editable" class="mm-snippet__actions">
        <button type="button" :disabled="isFirst" :aria-label="t('mindmap.snippetMoveUp')" :title="t('mindmap.snippetMoveUp')" @click="emit('move', -1)">↑</button>
        <button type="button" :disabled="isLast" :aria-label="t('mindmap.snippetMoveDown')" :title="t('mindmap.snippetMoveDown')" @click="emit('move', 1)">↓</button>
        <button type="button" @click="isEditing ? stopEditing() : (isEditing = true)">{{ t(isEditing ? 'mindmap.snippetDone' : 'mindmap.snippetEdit') }}</button>
        <button type="button" @click="requestDelete">{{ t(isConfirmingDelete ? 'mindmap.snippetDeleteConfirm' : 'mindmap.snippetDelete') }}</button>
      </div>
    </header>
    <textarea
      v-if="isEditing"
      class="mm-snippet__body"
      dir="auto"
      spellcheck="false"
      :aria-label="t('mindmap.snippetBodyLabel')"
      :value="snippet.body"
      @input="onInput('body', $event)"
      @keydown.esc.stop="stopEditing"
    />
    <Preview v-else :source="previewSource" class="mm-snippet__preview" />
  </article>
</template>

<style scoped>
.mm-snippet { border: 1px solid var(--border); border-radius: 6px; background: var(--bg); }
.mm-snippet__head { display: flex; align-items: center; gap: 8px; padding-block: 4px; padding-inline: 8px; border-block-end: 1px solid var(--border); }
.mm-snippet__kind { font-size: 11px; padding-inline: 6px; border-radius: 999px; border: 1px solid var(--accent); color: var(--text); }
.mm-snippet__title { flex: 1; margin: 0; font-size: 13px; unicode-bidi: plaintext; text-align: start; color: var(--text); }
.mm-snippet__title-input { flex: 1; font-size: 13px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); }
.mm-snippet__actions { display: flex; gap: 4px; }
.mm-snippet__actions button { font-size: 12px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; }
.mm-snippet__body { display: block; width: 100%; min-height: 8em; box-sizing: border-box; font-family: var(--font-mono, monospace); font-size: 13px; background: var(--bg-elev); color: var(--text); border: 0; padding: 8px; resize: vertical; unicode-bidi: plaintext; }
.mm-snippet__preview { max-height: 420px; overflow: auto; }
</style>
```

- [ ] **Step 3: Panel**

```vue
<!-- app/src/components/MindmapSnippets.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { createSnippet, SNIPPET_KINDS, type Snippet, type SnippetKind } from '../lib/mindmap-snippets';
import { useI18n } from '../i18n';
import MindmapSnippetCard from './MindmapSnippetCard.vue';

const ADD_LABEL_KEYS: Record<SnippetKind, string> = { md: 'mindmap.snippetAddMd', mermaid: 'mindmap.snippetAddMermaid', mmap: 'mindmap.snippetAddMmap' };

const props = defineProps<{ snippets: readonly Snippet[]; editable: boolean }>();
const emit = defineEmits<{ change: [next: Snippet[]] }>();
const { t } = useI18n();
const isCollapsed = ref(false);

function add(kind: SnippetKind): void {
  emit('change', [...props.snippets, createSnippet(kind, props.snippets, t('mindmap.snippetUntitled'))]);
}

function update(index: number, next: Snippet): void {
  emit('change', props.snippets.map((s, i) => (i === index ? next : s)));
}

function remove(index: number): void {
  emit('change', props.snippets.filter((_, i) => i !== index));
}

function move(index: number, delta: -1 | 1): void {
  const next = [...props.snippets];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item);
  emit('change', next);
}
</script>

<template>
  <section v-if="snippets.length > 0 || editable" class="mm-snippets" :aria-label="t('mindmap.snippetsTitle')">
    <header class="mm-snippets__head">
      <button type="button" class="mm-snippets__toggle" :aria-expanded="!isCollapsed" @click="isCollapsed = !isCollapsed">
        {{ isCollapsed ? '▸' : '▾' }} {{ t('mindmap.snippetsTitle') }} ({{ snippets.length }})
      </button>
      <div v-if="editable && !isCollapsed" class="mm-snippets__add">
        <button v-for="kind in SNIPPET_KINDS" :key="kind" type="button" @click="add(kind)">{{ t(ADD_LABEL_KEYS[kind]) }}</button>
      </div>
    </header>
    <div v-if="!isCollapsed" class="mm-snippets__list">
      <p v-if="snippets.length === 0" class="mm-snippets__empty">{{ t('mindmap.snippetsEmpty') }}</p>
      <MindmapSnippetCard
        v-for="(snippet, index) in snippets"
        :key="snippet.id"
        :snippet="snippet"
        :editable="editable"
        :is-first="index === 0"
        :is-last="index === snippets.length - 1"
        @update="(next) => update(index, next)"
        @remove="remove(index)"
        @move="(delta) => move(index, delta)"
      />
    </div>
  </section>
</template>

<style scoped>
.mm-snippets { display: flex; flex-direction: column; max-height: 45%; min-height: 0; border-block-start: 1px solid var(--border); background: var(--bg-elev); }
.mm-snippets__head { display: flex; align-items: center; gap: 8px; padding-block: 4px; padding-inline: 8px; }
.mm-snippets__toggle { background: none; border: 0; color: var(--text); cursor: pointer; font-size: 13px; }
.mm-snippets__add { display: flex; gap: 4px; margin-inline-start: auto; }
.mm-snippets__add button { font-size: 12px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; }
.mm-snippets__list { overflow: auto; display: flex; flex-direction: column; gap: 8px; padding: 8px; }
.mm-snippets__empty { margin: 0; font-size: 12px; color: var(--text-faint); }
</style>
```

- [ ] **Step 4: Wire into `MindmapView.vue`**

State and handlers:

```ts
import type { Snippet } from '../lib/mindmap-snippets';
import MindmapSnippets from './MindmapSnippets.vue';

const LIVE_EDIT_VIEW: ViewMode = 'liveEdit';
const snippets = ref<Snippet[]>([]);
const canEditSnippets = computed(() => settings.viewMode === LIVE_EDIT_VIEW && isPanelEditable.value);

function setSnippets(next: Snippet[]): void {
  if (!canEditSnippets.value) return;
  snippets.value = next;
  canvas.value?.setSnippets(next);
}
```

In `onCanvasReady` add `snippets.value = canvas.value?.getSnippets() ?? [];`.

Template: wrap the canvas so the panel sits under it and both share the map part's `order`:

```vue
<div v-if="has('map')" class="mindmap-shell__map" :style="{ order: partOrder('map') }">
  <MindmapCanvas
    ref="canvas"
    class="mindmap-shell__canvas"
    :content="mapContent"
    ...existing props and listeners unchanged, minus v-if and :style...
  />
  <MindmapSnippets :snippets="snippets" :editable="canEditSnippets" @change="setSnippets" />
</div>
```

Styles:

```css
.mindmap-shell__map { display: flex; flex-direction: column; min-height: 0; }
.mindmap-shell__canvas { flex: 1; min-height: 0; }
```

- [ ] **Step 5: Read-only panel in Reading's wide map**

In `MindmapReading.vue`, wrap the wide-map branch:

```vue
<div v-if="isWideMap" class="mindmap-reading__wide">
  <MindmapCanvas ref="canvas" class="mindmap-reading__map" ...unchanged... />
  <MindmapSnippets :snippets="readingSnippets" :editable="false" />
</div>
```

```ts
const readingSnippets = computed(() => {
  const parsed = codec.value.parse(props.tab.content);
  return parsed.ok ? parsed.snippets : [];
});
```

Change the outline branch to `outlineMarkdownOf(codec.value.parse(props.tab.content), 'rendered')`. Style `.mindmap-reading__wide { display: flex; flex-direction: column; height: 100%; } .mindmap-reading__map { flex: 1; min-height: 0; }`.

In `MindmapView.vue`, the outline preview uses rendered mode and the outline text keeps source mode:

```ts
const outlineText = computed(() => (has('outlineText') ? outlineMarkdownOf(parsedContent.value, 'source') : ''));
const outlinePreview = computed(() => (has('outlinePreview') ? outlineMarkdownOf(parsedContent.value, 'rendered') : ''));
```

Replace the single `outlineMarkdown` computed and its two template uses accordingly.

- [ ] **Step 6: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 7: Browser verification**

1. Map · Live edit: panel shows "Snippets (0)" with the three add buttons. Add one of each kind.
2. Edit the Markdown card: type `**bold** שלום`, click Done → renders bold; Hebrew aligns right.
3. Mermaid card: `graph LR\n A-->B` renders a diagram. Map card: `- Root\n  - A` renders a read-only map, no "Open" button.
4. Reorder with ↑/↓, rename, delete (two clicks). After 300 ms, Data lens shows the `snippets` array matching.
5. Map · Split and Data · Split: panel visible, no edit buttons. Preview: outline ends with "Snippets", Markdown rendered. Doc · Edit: fences shown.
6. Read-only toggle on in Live edit: no edit buttons. Reading (Map lens): wide map with read-only panel.
7. A file without snippets: Map · Split shows no panel at all.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/MindmapSnippetCard.vue app/src/components/MindmapSnippets.vue app/src/components/MindmapView.vue app/src/components/MindmapReading.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): snippet panel under the map, editable in Live edit"
```

---

### Task 5: Freeze strip model and focus store

**Files:**
- Create: `app/src/lib/mindmap-focus.ts`, `app/src/lib/mindmap-focus.test.ts`

**Interfaces:**
- Produces:
  - `export interface StripChip { id: string; topic: string; icons: string[]; tags: string[]; color?: string; background?: string }`
  - `export interface FreezeStrip { root: StripChip; level2: StripChip[]; activeLevel2Id: string | null; breadcrumb: StripChip[] }`
  - `export function buildFreezeStrip(root: NodeObj, focusId: string | null): FreezeStrip | null` → `null` when the root has no children
  - `export function pathTo(root: NodeObj, id: string): NodeObj[] | null` (root first, target last)
  - `export function getTabFocus(key: string): string | null`, `export function setTabFocus(key: string, id: string | null): void`

- [ ] **Step 1: Write failing tests**

```ts
// app/src/lib/mindmap-focus.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { buildFreezeStrip, getTabFocus, pathTo, setTabFocus } from './mindmap-focus.ts';

const MAP: NodeObj = {
  id: 'root', topic: 'Root', children: [
    { id: 'a', topic: 'Phase 8', icons: ['🚀'], tags: ['x', { text: 'y' }] as NodeObj['tags'], style: { color: '#f00' }, children: [
      { id: 'a1', topic: 'Lens', children: [{ id: 'a1x', topic: 'Matrix' }] },
    ] },
    { id: 'b', topic: 'שלב 9' },
  ],
} as NodeObj;

test('buildFreezeStrip returns null for a map with no level 2', () => {
  assert.equal(buildFreezeStrip({ id: 'root', topic: 'R' } as NodeObj, null), null);
});

test('without focus: root + every level-2 chip, nothing active, no breadcrumb', () => {
  const strip = buildFreezeStrip(MAP, null);
  assert.equal(strip?.root.topic, 'Root');
  assert.deepEqual(strip?.level2.map((c) => c.id), ['a', 'b']);
  assert.equal(strip?.activeLevel2Id, null);
  assert.deepEqual(strip?.breadcrumb, []);
});

test('chips carry icons, tag text and colors', () => {
  const chip = buildFreezeStrip(MAP, null)?.level2[0];
  assert.deepEqual(chip?.icons, ['🚀']);
  assert.deepEqual(chip?.tags, ['x', 'y']);
  assert.equal(chip?.color, '#f00');
});

test('deep focus highlights its level-2 ancestor and lists level 3 down to the focus', () => {
  const strip = buildFreezeStrip(MAP, 'a1x');
  assert.equal(strip?.activeLevel2Id, 'a');
  assert.deepEqual(strip?.breadcrumb.map((c) => c.topic), ['Lens', 'Matrix']);
});

test('focus on a level-2 node has no breadcrumb', () => {
  const strip = buildFreezeStrip(MAP, 'b');
  assert.equal(strip?.activeLevel2Id, 'b');
  assert.deepEqual(strip?.breadcrumb, []);
});

test('unknown focus id behaves like no focus', () => {
  assert.equal(buildFreezeStrip(MAP, 'gone')?.activeLevel2Id, null);
});

test('pathTo walks root to target', () => {
  assert.deepEqual(pathTo(MAP, 'a1x')?.map((n) => n.id), ['root', 'a', 'a1', 'a1x']);
  assert.equal(pathTo(MAP, 'gone'), null);
});

test('tab focus store is keyed and clearable', () => {
  setTabFocus('t1', 'a');
  assert.equal(getTabFocus('t1'), 'a');
  assert.equal(getTabFocus('t2'), null);
  setTabFocus('t1', null);
  assert.equal(getTabFocus('t1'), null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-focus.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/mindmap-focus.ts
import type { NodeObj } from 'mind-elixir';

export interface StripChip { id: string; topic: string; icons: string[]; tags: string[]; color?: string; background?: string }
export interface FreezeStrip { root: StripChip; level2: StripChip[]; activeLevel2Id: string | null; breadcrumb: StripChip[] }

const LEVEL2_DEPTH = 1;
const BREADCRUMB_START = 2;
const focusByTab = new Map<string, string>();

function tagText(tag: NonNullable<NodeObj['tags']>[number]): string {
  return typeof tag === 'string' ? tag : tag.text;
}

function chipOf(node: NodeObj): StripChip {
  return {
    id: node.id,
    topic: node.topic,
    icons: node.icons ?? [],
    tags: (node.tags ?? []).map(tagText),
    color: node.style?.color,
    background: node.style?.background,
  };
}

export function pathTo(root: NodeObj, id: string): NodeObj[] | null {
  if (root.id === id) return [root];
  for (const child of root.children ?? []) {
    const rest = pathTo(child, id);
    if (rest) return [root, ...rest];
  }
  return null;
}

export function buildFreezeStrip(root: NodeObj, focusId: string | null): FreezeStrip | null {
  const children = root.children ?? [];
  if (children.length === 0) return null;
  const path = focusId === null ? null : pathTo(root, focusId);
  return {
    root: chipOf(root),
    level2: children.map(chipOf),
    activeLevel2Id: path?.[LEVEL2_DEPTH]?.id ?? null,
    breadcrumb: (path ?? []).slice(BREADCRUMB_START).map(chipOf),
  };
}

export function getTabFocus(key: string): string | null {
  return focusByTab.get(key) ?? null;
}

export function setTabFocus(key: string, id: string | null): void {
  if (id === null) focusByTab.delete(key);
  else focusByTab.set(key, id);
}
```

- [ ] **Step 4: Run tests**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-focus.test.ts`
Expected: PASS (8/8).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-focus.ts app/src/lib/mindmap-focus.test.ts
git commit -m "feat(mindmap): freeze strip model and per-tab focus store"
```

---

### Task 6: Focus in the canvas and the frozen strip

Mind Elixir focus facts (from `MindElixir.js` ~774/776, `types/index.d.ts:60-61`):
- `focusNode(topic)` ignores the root (needs `nodeObj.parent`). It sets `isFocusMode = true`, keeps the full tree in `nodeDataBackup`, and sets `nodeData` to the subtree.
- `cancelFocus()` restores the tree and calls `refresh()`.
- `getData()` returns the full tree while focused, so syncing is safe.
- `findEle(id)` only finds rendered nodes, so focusing a node outside the current subtree needs `cancelFocus()` first.
- The package's context-menu "Focus" item calls `instance.focusNode` directly. Wrapping the instance method catches it.
- No bus event fires. The canvas tracks focus itself.

**Files:**
- Create: `app/src/components/MindmapFreezeStrip.vue`
- Modify: `app/src/components/MindmapCanvas.vue` (prop `focusKey`, wrappers, refresh paths, template)
- Modify: `app/src/components/MindmapView.vue` (pass `:focus-key="tab.id"`)
- Modify: `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: `buildFreezeStrip`, `pathTo`, `getTabFocus`, `setTabFocus` (Task 5).
- Produces: `MindmapCanvas` prop `focusKey?: string` (strip and focus persistence only when set). `MindmapFreezeStrip.vue` props `{ strip: FreezeStrip; focusId: string | null }`, emit `focus: [id: string | null]` (null = whole map).

- [ ] **Step 1: i18n**

```ts
    focusStripLabel: 'Map path',
    focusWholeMap: 'Show whole map',
```

- [ ] **Step 2: Strip component**

```vue
<!-- app/src/components/MindmapFreezeStrip.vue -->
<script setup lang="ts">
import type { FreezeStrip, StripChip } from '../lib/mindmap-focus';
import { useI18n } from '../i18n';

defineProps<{ strip: FreezeStrip; focusId: string | null }>();
const emit = defineEmits<{ focus: [id: string | null] }>();
const { t } = useI18n();

function chipStyle(chip: StripChip): Record<string, string> {
  const style: Record<string, string> = {};
  if (chip.color) style.color = chip.color;
  if (chip.background) style.background = chip.background;
  return style;
}
</script>

<template>
  <nav class="mm-strip" :aria-label="t('mindmap.focusStripLabel')">
    <div class="mm-strip__row">
      <button type="button" class="mm-strip__chip mm-strip__chip--root" dir="auto" :title="t('mindmap.focusWholeMap')" :aria-current="focusId === null ? 'true' : undefined" @click="emit('focus', null)">
        {{ strip.root.topic }}
      </button>
    </div>
    <div class="mm-strip__row">
      <button
        v-for="chip in strip.level2"
        :key="chip.id"
        type="button"
        class="mm-strip__chip"
        :class="{ 'mm-strip__chip--active': chip.id === strip.activeLevel2Id }"
        dir="auto"
        :style="chipStyle(chip)"
        :aria-current="chip.id === focusId ? 'true' : undefined"
        @click="emit('focus', chip.id)"
      >
        <span v-for="icon in chip.icons" :key="icon">{{ icon }}</span>
        {{ chip.topic }}
        <span v-for="tag in chip.tags" :key="tag" class="mm-strip__tag">{{ tag }}</span>
      </button>
    </div>
    <ol v-if="strip.breadcrumb.length > 0" class="mm-strip__row mm-strip__crumbs">
      <li v-for="chip in strip.breadcrumb" :key="chip.id">
        <button type="button" class="mm-strip__crumb" dir="auto" :aria-current="chip.id === focusId ? 'true' : undefined" @click="emit('focus', chip.id)">{{ chip.topic }}</button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.mm-strip { display: flex; flex-direction: column; gap: 4px; padding-block: 6px; padding-inline: 8px; background: var(--bg-elev); border-block-end: 1px solid var(--border); }
.mm-strip__row { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.mm-strip__chip { padding-block: 2px; padding-inline: 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 12px; cursor: pointer; unicode-bidi: plaintext; }
.mm-strip__chip--root { font-weight: 600; }
.mm-strip__chip--active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.mm-strip__tag { margin-inline-start: 4px; font-size: 10px; color: var(--text-faint); }
.mm-strip__crumbs li { display: flex; align-items: center; }
.mm-strip__crumbs li + li::before { content: '›'; margin-inline-end: 6px; color: var(--text-faint); }
.mm-strip__crumb { background: none; border: 0; color: var(--text); font-size: 12px; cursor: pointer; unicode-bidi: plaintext; }
:global([dir='rtl']) .mm-strip__crumbs li + li::before { content: '‹'; }
</style>
```

- [ ] **Step 3: Canvas focus state and wrappers**

Prop: add `focusKey?: string` to the props type (no default).

```ts
import { buildFreezeStrip, getTabFocus, pathTo, setTabFocus, type FreezeStrip } from '../lib/mindmap-focus';
import MindmapFreezeStrip from './MindmapFreezeStrip.vue';

const focusId = ref<string | null>(props.focusKey ? getTabFocus(props.focusKey) : null);
const strip = ref<FreezeStrip | null>(null);
let isApplyingFocus = false;

function fullRoot(instance: MindElixirInstance): NodeObj {
  return instance.getData().nodeData;
}

function rememberFocus(id: string | null): void {
  focusId.value = id;
  if (props.focusKey) setTabFocus(props.focusKey, id);
}

function refreshStrip(): void {
  strip.value = mind && props.focusKey ? buildFreezeStrip(fullRoot(mind), focusId.value) : null;
}

function wrapFocus(instance: MindElixirInstance): void {
  const { focusNode, cancelFocus } = instance;
  instance.focusNode = (tpc) => {
    focusNode.call(instance, tpc);
    if (!isApplyingFocus) rememberFocus(tpc.nodeObj.id);
    refreshStrip();
  };
  instance.cancelFocus = () => {
    cancelFocus.call(instance);
    if (!isApplyingFocus) rememberFocus(null);
    refreshStrip();
  };
}

function focusById(id: string | null): void {
  if (!mind) return;
  if (mind.isFocusMode) mind.cancelFocus();
  if (id === null || id === mind.nodeData.id) {
    rememberFocus(null);
    refreshStrip();
    return;
  }
  const el = findLiveTopic(mind, id);
  if (el) mind.focusNode(el);
}

function findLiveTopic(instance: MindElixirInstance, id: string): Topic | null {
  try {
    return instance.findEle(id) ?? null;
  } catch {
    return null;
  }
}

function reapplyFocus(): void {
  if (!mind) return;
  const id = focusId.value;
  if (id === null || !pathTo(fullRoot(mind), id)) {
    rememberFocus(null);
    refreshStrip();
    return;
  }
  isApplyingFocus = true;
  const el = findLiveTopic(mind, id);
  if (el) mind.focusNode(el);
  isApplyingFocus = false;
  refreshStrip();
}

function leaveFocusQuietly(): void {
  if (!mind?.isFocusMode) return;
  isApplyingFocus = true;
  mind.cancelFocus();
  isApplyingFocus = false;
}
```

Wire it up:
- `mount()`: call `wrapFocus(mind)` after `guardRemovedNodes(mind)`, then `reapplyFocus()` before `activate()`.
- `onOperation`: after `scheduleDuplicateCount()`, add `if (focusId.value !== null && mind && !pathTo(fullRoot(mind), focusId.value)) focusById(null); else refreshStrip();` (deleted focus cancels; topic edits update labels).
- Undo/redo wrappers: add `refreshStrip();` after `emitSelection();`.
- `applyExternalContent()`: in the `if (mind)` branch, call `leaveFocusQuietly()` before `mind.refresh(data)` and `reapplyFocus()` after `gates.syncLabels()`.
- `mergeDuplicate()`: `leaveFocusQuietly()` before `mind.refresh(merged)`, `reapplyFocus()` after `gates.syncLabels()`.
- `enterGraphView()`: `leaveFocusQuietly()` first. `leaveGraphView()`: `reapplyFocus()` last.
- `countDuplicates()`: use `findDuplicateGroups(fullRoot(mind))` so a focused view still counts the whole map.
- `actions`: `'mindmap.focusNode'` stays (it goes through the wrapper). `'mindmap.cancelFocus': () => focusById(null)`.
- `teardown()`: set `strip.value = null` (keep `focusId`; the store keeps it for the next mount).

Template: put the strip above the host, inside the non-error branch.

```vue
<template v-else>
  <MindmapFreezeStrip v-if="strip && !isGraphView" :strip="strip" :focus-id="focusId" @focus="focusById" />
  <div ref="host" class="mindmap-view__canvas" />
</template>
```

CSS: `.mindmap-view { display: flex; flex-direction: column; }` and `.mindmap-view__canvas { flex: 1; min-height: 0; width: 100%; }` (replace `height: 100%`).

- [ ] **Step 4: Pass the key from the view**

In `MindmapView.vue` add `:focus-key="tab.id"` to `<MindmapCanvas>`. Fences (`MindmapFenceOverlay`) and Reading pass nothing, so they show no strip.

- [ ] **Step 5: Build**

Run: `cd app && pnpm build` → success. If `vue-tsc` rejects assigning `instance.focusNode`, match the declared method type from `node_modules/mind-elixir/dist/types/index.d.ts` as `copyNodes` wrapping does.

- [ ] **Step 6: Browser verification**

1. Map · Live edit: strip shows root and every level-2 chip; Hebrew chip right-aligned.
2. Right-click a level-4 node → Focus: canvas shows its subtree; its level-2 chip is highlighted; breadcrumb shows level 3 › level 4.
3. Click another level-2 chip: canvas focuses that branch. Click the root chip: whole map.
4. Palette "Mindmap: Focus Node" / "Cancel Focus" behave the same.
5. While focused on X, rename X: the breadcrumb label updates. Then switch to Data · Edit, delete X's object from the JSON, switch back to Map · Live edit: the whole map shows, no chip is highlighted, and the console has no errors.
6. Focused, switch lens Map → Data · Split → Map: focus restored. Edit the JSON (rename a level-2 topic): strip label updates and focus stays.
7. Focused, edit a topic and wait 300 ms: Data lens shows the full map (not just the subtree).
8. Graph view hides the strip; leaving restores focus. Reading shows no strip.
9. RTL: with Hebrew level-3/4 topics, breadcrumb separator reads `‹`.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/MindmapFreezeStrip.vue app/src/components/MindmapCanvas.vue app/src/components/MindmapView.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): frozen root/level-2 strip with focus as root"
```

---

### Task 7: Paste parsing

**Files:**
- Create: `app/src/lib/mindmap-paste.ts`, `app/src/lib/mindmap-paste.test.ts`

**Interfaces:**
- Consumes: `parseMindmap`, `sanitizeMindmapData`, `sanitizeNodeObj` (`mindmap-format.ts`); `parseMindmapFence`, `MINDMAP_FENCE_ROOT_TOPIC`, `MAX_MINDMAP_FENCE_CHARS` (`mindmap-fence.ts`); `markdownToMindmap`, `SELECTION_ROOT_TOPIC` (`mindmap-convert.ts`).
- Produces:
  - `export type PasteFormat = 'mmap' | 'json' | 'plaintext' | 'markdown' | 'outline' | 'line'`
  - `export interface PastePayload { format: PasteFormat; nodes: NodeObj[]; arrows: Arrow[]; summaries: Summary[] }`
  - `export type PasteResult = { ok: true; payload: PastePayload } | { ok: false; reason: 'empty' | 'tooLarge' | 'unrecognized' }`
  - `export function parsePaste(text: string): PasteResult`
  - `export function outlineToPlaintext(lines: readonly string[]): string`

Detection order (spec §3): mmap envelope → map/node JSON → mindmap plaintext → Markdown → indented outline → single line. Root rule: the parsed root becomes one inserted node, unless its topic is synthetic (`MINDMAP_FENCE_ROOT_TOPIC`, `SELECTION_ROOT_TOPIC`, `PASTE_ROOT_TOPIC`), in which case its children are inserted.

- [ ] **Step 1: Write failing tests**

```ts
// app/src/lib/mindmap-paste.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outlineToPlaintext, parsePaste } from './mindmap-paste.ts';
import { MAX_MINDMAP_FENCE_CHARS } from './mindmap-fence.ts';

function ok(text: string) {
  const result = parsePaste(text);
  assert.ok(result.ok, `expected ok for ${JSON.stringify(text)}`);
  return result.payload;
}

test('empty and whitespace are rejected', () => {
  assert.deepEqual(parsePaste('  \n '), { ok: false, reason: 'empty' });
});

test('oversized text is rejected', () => {
  assert.deepEqual(parsePaste('x'.repeat(MAX_MINDMAP_FENCE_CHARS + 1)), { ok: false, reason: 'tooLarge' });
});

test('mmap envelope keeps its real root as one node, with arrows', () => {
  const text = JSON.stringify({ format: 'solomd-mindmap', version: 1, data: {
    nodeData: { id: 'root', topic: 'Plan', children: [{ id: 'a', topic: 'A' }, { id: 'b', topic: 'B' }] },
    arrows: [{ id: 'ar', label: '', from: 'a', to: 'b' }],
  } });
  const p = ok(text);
  assert.equal(p.format, 'mmap');
  assert.deepEqual(p.nodes.map((n) => n.topic), ['Plan']);
  assert.equal(p.arrows.length, 1);
});

test('bare map data, a single node and a node array are json', () => {
  assert.equal(ok(JSON.stringify({ nodeData: { id: 'r', topic: 'R' } })).nodes[0].topic, 'R');
  assert.equal(ok(JSON.stringify({ id: 'n', topic: 'N' })).format, 'json');
  assert.deepEqual(ok(JSON.stringify([{ id: 'x', topic: 'X' }, { id: 'y', topic: 'Y' }])).nodes.map((n) => n.id), ['x', 'y']);
});

test('json nodes are sanitized', () => {
  const p = ok(JSON.stringify({ id: 'n', topic: 'N', hyperLink: 'javascript:alert(1)', dangerouslySetInnerHTML: '<img>' }));
  assert.equal(p.nodes[0].hyperLink, undefined);
  assert.equal(p.nodes[0].dangerouslySetInnerHTML, undefined);
});

test('mindmap plaintext with one top line keeps that root', () => {
  const p = ok('- Root\n  - A\n  - B');
  assert.equal(p.format, 'plaintext');
  assert.deepEqual(p.nodes.map((n) => n.topic), ['Root']);
  assert.equal(p.nodes[0].children?.length, 2);
});

test('mindmap plaintext with several top lines inserts them as siblings', () => {
  assert.deepEqual(ok('- A\n- B').nodes.map((n) => n.topic), ['A', 'B']);
});

test('markdown headings become a subtree', () => {
  const p = ok('# Title\n\n## One\n\n## Two');
  assert.equal(p.format, 'markdown');
  assert.deepEqual(p.nodes.map((n) => n.topic), ['Title']);
  assert.deepEqual(p.nodes[0].children?.map((n) => n.topic), ['One', 'Two']);
});

test('tab-indented outline (XMind style) nests by indent', () => {
  const p = ok('Root\n\tA\n\t\tA1\n\tB');
  assert.equal(p.format, 'outline');
  assert.deepEqual(p.nodes.map((n) => n.topic), ['Root']);
  assert.deepEqual(p.nodes[0].children?.map((n) => n.topic), ['A', 'B']);
});

test('space-indented outline and flat multi-line text', () => {
  assert.deepEqual(ok('Root\n    A\n    B').nodes[0].children?.map((n) => n.topic), ['A', 'B']);
  assert.deepEqual(ok('one\nשתיים\nthree').nodes.map((n) => n.topic), ['one', 'שתיים', 'three']);
});

test('a single line becomes one node', () => {
  const p = ok('  just a thought  ');
  assert.equal(p.format, 'line');
  assert.deepEqual(p.nodes.map((n) => n.topic), ['just a thought']);
});

test('invalid JSON falls through to text handling', () => {
  assert.equal(ok('{ not json').format, 'line');
});

test('outlineToPlaintext converts indent levels to bullets', () => {
  assert.equal(outlineToPlaintext(['R', '\tA', '\t\tA1']), '- R\n  - A\n    - A1');
  assert.equal(outlineToPlaintext(['R', '  A', '    A1', '  B']), '- R\n  - A\n    - A1\n  - B');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-paste.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/mindmap-paste.ts
import type { Arrow, MindElixirData, NodeObj, Summary } from 'mind-elixir';
import { parseMindmap, sanitizeMindmapData, sanitizeNodeObj } from './mindmap-format.ts';
import { MAX_MINDMAP_FENCE_CHARS, MINDMAP_FENCE_ROOT_TOPIC, parseMindmapFence } from './mindmap-fence.ts';
import { markdownToMindmap, SELECTION_ROOT_TOPIC } from './mindmap-convert.ts';

export type PasteFormat = 'mmap' | 'json' | 'plaintext' | 'markdown' | 'outline' | 'line';
export interface PastePayload { format: PasteFormat; nodes: NodeObj[]; arrows: Arrow[]; summaries: Summary[] }
export type PasteResult = { ok: true; payload: PastePayload } | { ok: false; reason: 'empty' | 'tooLarge' | 'unrecognized' };

const PASTE_ROOT_TOPIC = '\u0000paste-root';
const SYNTHETIC_ROOTS: readonly string[] = [MINDMAP_FENCE_ROOT_TOPIC, SELECTION_ROOT_TOPIC, PASTE_ROOT_TOPIC];
const ENVELOPE_FORMAT = 'solomd-mindmap';
const JSON_START = /^[[{]/u;
const BULLET_LINE = /^\s*- /u;
const MARKDOWN_SIGNAL = /^(#{1,6}\s|\s*[*+]\s|\s*\d+[.)]\s)/mu;
const LEADING_WS = /^[\t ]*/u;
const TAB = '\t';
const BULLET_INDENT = '  ';
const BULLET = '- ';
const NEWLINE = '\n';
const LINE_SPLIT = /\r\n?|\n/u;
const LINE_NODE_ID = 'p1';

type Attempt = (text: string, lines: string[]) => PastePayload | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function payloadOf(format: PasteFormat, data: MindElixirData): PastePayload {
  const root = data.nodeData;
  const nodes = SYNTHETIC_ROOTS.includes(root.topic) ? root.children ?? [] : [root];
  return { format, nodes, arrows: data.arrows ?? [], summaries: data.summaries ?? [] };
}

function nodesPayload(nodes: NodeObj[]): PastePayload {
  return { format: 'json', nodes, arrows: [], summaries: [] };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const tryEnvelope: Attempt = (text) => {
  const json = parseJson(text);
  if (!isRecord(json) || json.format !== ENVELOPE_FORMAT) return null;
  const parsed = parseMindmap(text, PASTE_ROOT_TOPIC);
  return parsed.ok ? payloadOf('mmap', parsed.data) : null;
};

function nodeArray(json: unknown[]): NodeObj[] | null {
  const nodes = json.map(sanitizeNodeObj);
  return nodes.length > 0 && nodes.every((n): n is NodeObj => n !== null) ? nodes : null;
}

const tryJson: Attempt = (text) => {
  const json = parseJson(text);
  if (Array.isArray(json)) {
    const nodes = nodeArray(json);
    return nodes ? nodesPayload(nodes) : null;
  }
  if (!isRecord(json)) return null;
  if (sanitizeNodeObj(json.nodeData)) return payloadOf('json', sanitizeMindmapData(json as unknown as MindElixirData));
  const node = sanitizeNodeObj(json);
  return node ? nodesPayload([node]) : null;
};

function fromPlaintext(format: PasteFormat, text: string): PastePayload | null {
  const parsed = parseMindmapFence(text);
  return parsed.ok && !parsed.isEmpty ? payloadOf(format, parsed.data) : null;
}

const tryPlaintext: Attempt = (text, lines) => (lines.every((l) => BULLET_LINE.test(l)) ? fromPlaintext('plaintext', text) : null);

const tryMarkdown: Attempt = (text) => {
  if (!MARKDOWN_SIGNAL.test(text)) return null;
  const data = markdownToMindmap(text, { rootTopic: PASTE_ROOT_TOPIC });
  return (data.nodeData.children ?? []).length > 0 ? payloadOf('markdown', data) : null;
};

const tryOutline: Attempt = (_text, lines) => (lines.length >= 2 ? fromPlaintext('outline', outlineToPlaintext(lines)) : null);

const tryLine: Attempt = (_text, lines) => (
  lines.length === 1 ? { format: 'line', nodes: [{ id: LINE_NODE_ID, topic: lines[0].trim() }], arrows: [], summaries: [] } : null
);

const JSON_ATTEMPTS: readonly Attempt[] = [tryEnvelope, tryJson];
const TEXT_ATTEMPTS: readonly Attempt[] = [tryPlaintext, tryMarkdown, tryOutline, tryLine];

function indentWidth(line: string): number {
  const ws = LEADING_WS.exec(line)?.[0] ?? '';
  return ws.includes(TAB) ? ws.split(TAB).length - 1 : ws.length;
}

export function outlineToPlaintext(lines: readonly string[]): string {
  const widths = lines.map(indentWidth);
  const unit = Math.min(...widths.filter((w) => w > 0), Number.POSITIVE_INFINITY);
  const base = Math.min(...widths);
  return lines
    .map((line, i) => `${BULLET_INDENT.repeat(Number.isFinite(unit) ? Math.round((widths[i] - base) / unit) : 0)}${BULLET}${line.trim()}`)
    .join(NEWLINE);
}

export function parsePaste(text: string): PasteResult {
  if (text.length > MAX_MINDMAP_FENCE_CHARS) return { ok: false, reason: 'tooLarge' };
  const lines = text.split(LINE_SPLIT).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { ok: false, reason: 'empty' };
  const attempts = JSON_START.test(text.trimStart()) ? [...JSON_ATTEMPTS, ...TEXT_ATTEMPTS] : TEXT_ATTEMPTS;
  for (const attempt of attempts) {
    const payload = attempt(text, lines);
    if (payload && payload.nodes.length > 0) return { ok: true, payload };
  }
  return { ok: false, reason: 'unrecognized' };
}
```

`LINE_NODE_ID` is a placeholder: Mind Elixir replaces every id on insert.

Why `PASTE_ROOT_TOPIC` contains `\u0000`: a user's real root topic can never equal it, so only the converter's own wrapper root is treated as synthetic.

`MARKDOWN_SIGNAL` leaves out `- ` bullets on purpose: text where every line is a `- ` bullet is mindmap plaintext (tried first), and the same fence parser handles it.

- [ ] **Step 4: Run tests**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-paste.test.ts`
Expected: PASS (13/13). If the plaintext converter treats a single top line differently from the comment in `parseMindmapFence` (synthetic `Mind Map` root vs. real root), adjust only `payloadOf`'s synthetic check, not the tests' expectations.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-paste.ts app/src/lib/mindmap-paste.test.ts
git commit -m "feat(mindmap): parse clipboard text into a paste payload (json, plaintext, markdown, outline)"
```

---

### Task 8: Paste import in the canvas

**Files:**
- Create: `app/src/lib/mindmap-paste-remap.ts`, `app/src/lib/mindmap-paste-remap.test.ts`
- Modify: `app/src/components/MindmapCanvas.vue` (`pasteHandler` option)
- Modify: `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: `parsePaste`, `PastePayload` (Task 7); `readGate` (`mindmap-gates.ts`).
- Produces:
  - `export function buildIdMap(pasted: readonly NodeObj[], inserted: readonly NodeObj[]): Map<string, string>`
  - `export function remapGates(inserted: readonly NodeObj[], idMap: ReadonlyMap<string, string>): void` (mutates `metadata.gate.target` in place)
  - `export function remapArrows(arrows: readonly Arrow[], idMap: ReadonlyMap<string, string>): Omit<Arrow, 'id'>[]` (only arrows with both ends inside the block)
  - `export function remapSummaries(summaries: readonly Summary[], idMap: ReadonlyMap<string, string>): Omit<Summary, 'id'>[]`

- [ ] **Step 1: Write failing remap tests**

```ts
// app/src/lib/mindmap-paste-remap.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { buildIdMap, remapArrows, remapGates, remapSummaries } from './mindmap-paste-remap.ts';

const PASTED: NodeObj[] = [{ id: 'a', topic: 'A', children: [{ id: 'a1', topic: 'A1' }, { id: 'g', topic: 'gate', metadata: { gate: { target: 'a1' } } }] }];
const INSERTED: NodeObj[] = [{ id: 'X', topic: 'A', children: [{ id: 'Y', topic: 'A1' }, { id: 'Z', topic: 'gate', metadata: { gate: { target: 'a1' } } }] }];

test('buildIdMap pairs ids by tree position', () => {
  assert.deepEqual([...buildIdMap(PASTED, INSERTED)], [['a', 'X'], ['a1', 'Y'], ['g', 'Z']]);
});

test('remapGates points internal gates at new ids and leaves outside gates', () => {
  const inserted: NodeObj[] = structuredClone(INSERTED);
  inserted[0].children?.push({ id: 'W', topic: 'out', metadata: { gate: { target: 'elsewhere' } } });
  remapGates(inserted, buildIdMap(PASTED, INSERTED));
  assert.deepEqual(inserted[0].children?.[1].metadata, { gate: { target: 'Y' } });
  assert.deepEqual(inserted[0].children?.[2].metadata, { gate: { target: 'elsewhere' } });
});

test('remapArrows keeps only arrows inside the block, without ids', () => {
  const map = buildIdMap(PASTED, INSERTED);
  const out = remapArrows([{ id: '1', label: 'x', from: 'a', to: 'a1' }, { id: '2', label: '', from: 'a', to: 'outside' }], map);
  assert.deepEqual(out, [{ label: 'x', from: 'X', to: 'Y' }]);
});

test('remapSummaries keeps summaries whose parent is inside the block', () => {
  const map = buildIdMap(PASTED, INSERTED);
  assert.deepEqual(remapSummaries([{ id: 's', label: 'L', parent: 'a', start: 0, end: 1 }], map), [{ label: 'L', parent: 'X', start: 0, end: 1 }]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-paste-remap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/mindmap-paste-remap.ts
import type { Arrow, NodeObj, Summary } from 'mind-elixir';
import { readGate } from './mindmap-gates.ts';

function pair(pasted: NodeObj, inserted: NodeObj, out: Map<string, string>): void {
  out.set(pasted.id, inserted.id);
  const kids = inserted.children ?? [];
  (pasted.children ?? []).forEach((child, i) => { if (kids[i]) pair(child, kids[i], out); });
}

export function buildIdMap(pasted: readonly NodeObj[], inserted: readonly NodeObj[]): Map<string, string> {
  const out = new Map<string, string>();
  pasted.forEach((node, i) => { if (inserted[i]) pair(node, inserted[i], out); });
  return out;
}

function remapNodeGate(node: NodeObj, idMap: ReadonlyMap<string, string>): void {
  const gate = readGate(node);
  const next = gate ? idMap.get(gate.target) : undefined;
  if (next && node.metadata) (node.metadata as { gate: { target: string } }).gate.target = next;
  for (const child of node.children ?? []) remapNodeGate(child, idMap);
}

export function remapGates(inserted: readonly NodeObj[], idMap: ReadonlyMap<string, string>): void {
  for (const node of inserted) remapNodeGate(node, idMap);
}

export function remapArrows(arrows: readonly Arrow[], idMap: ReadonlyMap<string, string>): Omit<Arrow, 'id'>[] {
  return arrows.flatMap(({ id: _id, ...arrow }) => {
    const from = idMap.get(arrow.from);
    const to = idMap.get(arrow.to);
    return from && to ? [{ ...arrow, from, to }] : [];
  });
}

export function remapSummaries(summaries: readonly Summary[], idMap: ReadonlyMap<string, string>): Omit<Summary, 'id'>[] {
  return summaries.flatMap(({ id: _id, ...summary }) => {
    const parent = idMap.get(summary.parent);
    return parent ? [{ ...summary, parent }] : [];
  });
}
```

- [ ] **Step 4: Run remap tests**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-paste-remap.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: i18n**

```ts
    pasteSelectNode: 'Select a node to paste into',
    pasteUnrecognized: 'Clipboard format not recognized',
    pasteTooLarge: 'Clipboard text is too large to paste',
```

- [ ] **Step 6: Wire `pasteHandler` in `MindmapCanvas.vue`**

Mind Elixir handles its own clipboard format first and calls `pasteHandler` for everything else. The paste event also bubbles from the topic edit box, so the handler must leave that alone.

```ts
import { parsePaste, type PastePayload } from '../lib/mindmap-paste';
import { buildIdMap, remapArrows, remapGates, remapSummaries } from '../lib/mindmap-paste-remap';
import { isGate } from '../lib/mindmap-gates';

const PASTE_NOTICE_KEYS = { empty: null, tooLarge: 'mindmap.pasteTooLarge', unrecognized: 'mindmap.pasteUnrecognized' } as const;

function pasteTarget(): Topic | null {
  if (!mind || isEditBlocked() || isGraphView.value) return null;
  const target = mind.currentNode;
  if (!target) toasts.info(t('mindmap.pasteSelectNode'));
  else if (isGate(target.nodeObj)) toasts.info(t('mindmap.gateCannotHoldChildren'));
  else return target;
  return null;
}

function insertPayload(instance: MindElixirInstance, target: Topic, payload: PastePayload): void {
  void instance.copyNodes(payload.nodes.map((nodeObj) => ({ nodeObj }) as Topic), target);
  const inserted = instance.currentNodes.map((tpc) => tpc.nodeObj);
  const idMap = buildIdMap(payload.nodes, inserted);
  remapGates(inserted, idMap);
  for (const arrow of remapArrows(payload.arrows, idMap)) instance.createArrowFrom(arrow);
  for (const summary of remapSummaries(payload.summaries, idMap)) instance.createSummaryFrom(summary);
  gates.syncLabels();
}

function onPaste(e: ClipboardEvent): void {
  if (e.target instanceof HTMLElement && e.target.id === TOPIC_EDITOR_ID) return;
  const target = pasteTarget();
  if (!mind || !target) return;
  const result = parsePaste(e.clipboardData?.getData('text/plain') ?? '');
  e.preventDefault();
  if (!result.ok) {
    const key = PASTE_NOTICE_KEYS[result.reason];
    if (key) toasts.info(t(key));
    return;
  }
  insertPayload(mind, target, result.payload);
}
```

Add `pasteHandler: onPaste,` to the `new MindElixir({...})` options in `mount()`.

Order of operations: `copyNodes` (the wrapped one) sanitizes, inserts as children of `target`, regenerates ids, fires one `copyNodes` operation (one undo step) and selects the new nodes. So `currentNodes` holds the inserted roots in paste order, and their `nodeObj`s are live. Mutating gate targets on them is enough because `syncNow` serializes `getData()`. `gates.syncLabels()` refreshes gate labels.

- [ ] **Step 7: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 8: Browser verification**

For each case put the text on the clipboard (copy from a text editor or run `navigator.clipboard.writeText(...)` in the page console), select a node, press Cmd+V, then press Cmd+Z once.

1. `.mmap` file contents (another map): its root appears as one child with its subtree; the arrow inside it is drawn. Cmd+Z removes the subtree (the arrow is a separate undo step; a second Cmd+Z may be needed first — note the count).
2. Map JSON `{"nodeData":{"id":"r","topic":"R","children":[{"id":"c","topic":"C"}]}}`: subtree R › C.
3. Plaintext `- A\n  - A1\n- B`: A (with A1) and B as siblings.
4. Markdown `# Doc\n\n## One\n\n- item`: Doc › One › item.
5. Tab-indented outline (`Root⇥A⇥⇥A1`), copied from XMind if available: nested correctly. Record in the commit message what XMind actually put on the clipboard.
6. One line `hello שלום`: one child node.
7. A gate copied with its target in the same subtree (Cmd+C on the parent in another map, paste here): the pasted gate points at the pasted target (not broken).
8. Guards: no selection → "Select a node to paste into"; gate selected → gate notice; read-only on, locked, graph view → nothing happens; text that is only whitespace → nothing.
9. Editing a topic (double-click) and pasting text: text goes into the topic, no nodes added.
10. Mind Elixir copy/paste (Cmd+C a node, Cmd+V) still works as before.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/mindmap-paste-remap.ts app/src/lib/mindmap-paste-remap.test.ts app/src/components/MindmapCanvas.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): Cmd+V imports map JSON, plaintext, Markdown and outlines as a subtree"
```

---

### Task 9: Phase 8 carry-over

Spec §4 rows 1–5, 7, 9. Rows 6 and 8 were already fixed (see Spec deltas).

**Files:**
- Modify: `app/src/i18n/en.ts`, `app/src/components/MindmapCanvas.vue`, `app/src/components/MindmapMapFields.vue`, `app/src/components/MindmapView.vue`, `app/src/components/MindmapReading.vue`
- Create: `app/src/components/MindmapOutlineInvalid.vue`

- [ ] **Step 1: "1 duplicates" (row 1)**

`en.ts`: keep `duplicatesChip: '{count} duplicates'`, add `duplicatesChipOne: '1 duplicate'`, delete the unused `menuDuplicates` line. Confirm with `grep -rn "menuDuplicates" app/src` → no hits.

`MindmapCanvas.vue` template:

```vue
{{ duplicateCount === 1 ? t('mindmap.duplicatesChipOne') : t('mindmap.duplicatesChip', { count: duplicateCount }) }}
```

- [ ] **Step 2: Chip hidden when merging is impossible (row 7)**

Change the chip's `v-if` to `duplicateCount > 0 && !locked && !isReadOnly && !isGraphView`.

- [ ] **Step 3: Unique theme label id (row 2)**

`MindmapMapFields.vue`:

```ts
import { useId } from 'vue';
const themeLabelId = useId();
```

```vue
<span :id="themeLabelId">{{ t('mindmap.fieldTheme') }}</span>
<div class="mm-fields__themes" role="radiogroup" :aria-labelledby="themeLabelId">
```

- [ ] **Step 4: Debounced parse in JSON cells (row 3)**

In `MindmapView.vue`, parse a debounced copy of the content while the cell has the JSON editor; parse immediately otherwise.

```ts
const JSON_PARSE_DEBOUNCE_MS = 250;
const parseSource = ref(props.tab.content);
let parseTimer: number | null = null;

watch(() => props.tab.content, (content) => {
  if (parseTimer !== null) window.clearTimeout(parseTimer);
  if (!has('json')) {
    parseSource.value = content;
    return;
  }
  parseTimer = window.setTimeout(() => { parseSource.value = content; }, JSON_PARSE_DEBOUNCE_MS);
});

const parsedContent = computed(() => codec.value.parse(parseSource.value));
```

Update the `lastValidContent` watcher to store the parsed text, not the live text:

```ts
watch(parsedContent, (parsed) => {
  if (!parsed.ok) return;
  lastValidContent.value = parseSource.value;
  sourceError.value = null;
}, { immediate: true });
```

`leaveJsonAllowed` already parses `props.tab.content` directly, so leaving a cell still validates the latest text. In `onBeforeUnmount`, clear `parseTimer`. Also flush on cell change: in `leaveCellAllowed`, after `canvas.value?.flush()`, set `parseSource.value = props.tab.content`.

- [ ] **Step 5: Outline empty state (row 4)**

i18n:

```ts
    outlineInvalid: 'The map JSON is invalid, so there is no outline to show.',
    outlineSwitchToData: 'Fix it in Data',
```

```vue
<!-- app/src/components/MindmapOutlineInvalid.vue -->
<script setup lang="ts">
import { useI18n } from '../i18n';

defineProps<{ error: string }>();
const emit = defineEmits<{ 'switch-to-data': [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="mm-outline-invalid" role="alert">
    <p>{{ t('mindmap.outlineInvalid') }}</p>
    <pre>{{ error }}</pre>
    <button type="button" @click="emit('switch-to-data')">{{ t('mindmap.outlineSwitchToData') }}</button>
  </div>
</template>

<style scoped>
.mm-outline-invalid { padding: 24px; color: var(--text); }
.mm-outline-invalid pre { white-space: pre-wrap; color: var(--text-faint); }
.mm-outline-invalid button { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; }
</style>
```

`MindmapView.vue`: in each outline part, render `<MindmapOutlineInvalid v-if="!parsedContent.ok" :error="parsedContent.error" :style="{ order: partOrder(...) }" @switch-to-data="openAsText" />` and the existing outline component `v-else`. Use a small computed `outlineError = computed(() => (parsedContent.value.ok ? null : parsedContent.value.error))` to keep the template narrowing simple.

`MindmapReading.vue` outline branch: same component when the parse fails. Its `switch-to-data` handler:

```ts
function switchToData(): void {
  props.tab.mindmapLens = 'data';
  tabs.persist();
  settings.setViewMode('edit');
}
```

(import `useTabsStore`). Also give the wide-map canvas `@open-as-text="switchToData"` so the parse-error button there works.

- [ ] **Step 6: Keys on canvas controls (row 5)**

Reproduce first: Map · Live edit, select a node, press Tab until the Fit control (⤢) has focus, press Delete, then Tab, then F2.
- If none of them changes the map, record "not reproducible" in the commit body and skip to Step 7.
- If any does, add a capture listener on the canvas host that stops non-activation keys aimed at a control:

```ts
const CONTROL_SELECTOR = '.mm-canvas-control';
const CONTROL_KEYS: readonly string[] = ['Enter', ' ', 'Escape'];

function shieldCanvasControls(e: KeyboardEvent): void {
  if (!(e.target instanceof HTMLElement) || !e.target.closest(CONTROL_SELECTOR)) return;
  if (CONTROL_KEYS.includes(e.key)) return;
  e.stopImmediatePropagation();
}
```

In `mount()`, after `appendCanvasControls(...)`: `host.value.addEventListener('keydown', shieldCanvasControls, true);`. In `teardown()`, remove it before `mind?.destroy()` (guard `host.value`). Re-run the reproduction: Delete/Tab/F2 on a focused control change nothing; Enter still fits.

- [ ] **Step 7: Build and unit sweep**

Run: `cd app && pnpm build && node --test --experimental-strip-types src/lib/mindmap-*.test.ts`
Expected: success; all pass.

- [ ] **Step 8: Browser verification (incl. row 9, paste guard)**

1. One duplicate group: chip reads "1 duplicate"; two groups: "2 duplicates". Read-only or graph view: no chip.
2. Settings → Mindmap open while the side panel's Map tab is open: `document.querySelectorAll('[aria-labelledby]')` theme groups point at different ids.
3. Data · Split on a large map: typing stays responsive; the error banner appears ≤ 250 ms after the JSON breaks; fixing it redraws the map.
4. Doc · Preview, Map · Preview and Reading (Doc lens) with broken JSON: the invalid message and "Fix it in Data" button show; the button lands in Data · Edit.
5. Paste guard (row 9): read-only on → Cmd+V of a copied node and of plain text adds nothing; locked (Data · Split, broken JSON) → nothing; graph view → nothing.

- [ ] **Step 9: Commit**

```bash
git add app/src/i18n/en.ts app/src/components/MindmapCanvas.vue app/src/components/MindmapMapFields.vue app/src/components/MindmapView.vue app/src/components/MindmapReading.vue app/src/components/MindmapOutlineInvalid.vue
git commit -m "fix(mindmap): phase 8 carry-over — chip grammar and visibility, unique theme label id, debounced JSON parse, outline invalid state, control keys"
```

---

### Task 10: Verification, docs, bump

**Files:**
- Modify: `docs/superpowers/specs/2026-10-12-mindmap-phase9-snippets-focus-design.md` (Status, decisions), `docs/superpowers/specs/2026-10-11-mindmap-design.md` (Phase 9 row), `docs/superpowers/specs/2026-10-12-mindmap-follow-ups.md` (Phase 9 pointer stays), `docs/superpowers/plans/2026-10-12-mindmap-desktop-checklist.md`, `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/tauri.conf.json`

- [ ] **Step 1: Full unit sweep**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-*.test.ts src/lib/xmind-*.test.ts src/lib/view-mode-guard.test.ts`
Expected: all pass.

- [ ] **Step 2: Build**

Run: `cd app && pnpm build` → success.

- [ ] **Step 3: Leftover sweep**

Run: `cd app && grep -rn "menuDuplicates\|mm-theme-label\|bg-secondary" src --include='*.ts' --include='*.vue'`
Expected: no hits.

- [ ] **Step 4: Update docs**

1. Phase 9 spec `## Status`: add `Done DD-MM-YY (<version>) — plan docs/superpowers/plans/2026-10-12-mindmap-phase9-snippets-focus-paste.md`. Copy this plan's "Spec deltas" table under `## Decisions during planning`.
2. Parent design status table: add or set the Phase 9 row to `✅ Done DD-MM-YY (<version>)` with the plan path.
3. Desktop checklist, new Phase 9 section:
   - Snippets: add/edit/reorder/delete each kind; Mermaid and Map render in the packaged app.
   - Markdown export through the native save dialog ends with `## Snippets`.
   - Frozen strip and focus, including RTL breadcrumb.
   - Cmd+V from the system clipboard: XMind copy, a Markdown file, a `.mmap` file's text.
   - Cmd+V into a topic edit box pastes text only.

- [ ] **Step 5: Bump the patch version**

Read the version from `app/package.json` and bump the patch number in all three files, as in earlier phases. Run `cd app/src-tauri && cargo check` so `Cargo.lock` updates.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers app/package.json app/src-tauri/Cargo.toml app/src-tauri/Cargo.lock app/src-tauri/tauri.conf.json
git commit -m "chore(mindmap): phase 9 docs and version bump"
```

- [ ] **Step 7: Desktop check (user)**

Hand off to the user for a Tauri desktop pass on the Phase 9 checklist section before merge.
