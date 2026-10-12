# Mindmap Phase 5a — Structural md→mindmap Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert a markdown selection, section, document, or folder into a mind map (new `.mmap` tab or inserted fence), offline and instant, and close the Phase 4 hardening carry-overs.

**Architecture:** A fence-aware line scanner (`mindmap-md-scan.ts`) turns markdown into flat blocks; a converter (`mindmap-convert.ts`) builds a `MindElixirData` tree stamped with `metadata.source`; a merge module (`mindmap-merge.ts`) prefixes ids and merges per-file maps for folders. UI glue: palette/key actions dispatch window events to the focused pane (pattern of `solomd:insert-markdown`), a composable writes the output, and a dialog drives folder conversion.

**Tech Stack:** Vue 3, Pinia, TypeScript, CodeMirror 6, Tauri 2, `mind-elixir` 5.15.1, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-11-mindmap-design.md` — sections "Phase 5", "Split", "5a structural rules", "5a folder conversion", "5a output and commands", "5a carry-overs from Phase 4". Handoff: `docs/superpowers/plans/2026-10-11-mindmap-phase5-handoff.md`.

## Global Constraints

- Branch `feat/mindmap`; no worktree; never push.
- pnpm in `app/`, exact version pins, commit `app/pnpm-lock.yaml` with any dependency change. 5a adds no dependency.
- TypeScript: no `any`, no zod, constants for every literal value, functions ≤ ~20 lines, early returns, no comments except non-obvious "why".
- `src/lib` imports between lib files use the `.ts` extension (node test runner requirement).
- Unit tests: `cd app && node --test --experimental-strip-types src/lib/<file>.test.ts`.
- Build: `cd app && pnpm build` (runs `vue-tsc` + `vite build`) must pass at the end of every task that touches `.vue` or composables.
- Known pre-existing failures, out of scope: 12 `src/lib/*.test.ts` files with extensionless imports; one Rust assertion in `detect_language_from_extension`.
- Every map payload passes through `sanitizeMindmapData` before it is exported or rendered.
- Files are written through Tauri (`invoke('write_file' | 'write_binary_file')`), never browser downloads.
- Gate data lives in `node.metadata.gate`. Core stores `metadata.refId`, so always merge into `metadata`, never replace it.
- New user-facing strings go in `app/src/i18n/en.ts` (`mindmap` for map UI, `cmd.*` for commands). Other locales fall back.
- Node ids produced by converters match `[\w-]+`.
- Commit trailer: `Co-Authored-By: Claude <model> 5.5 <noreply@anthropic.com>` (use the implementer's model name).

## File Map

| File | Status | Responsibility |
|---|---|---|
| `app/src/lib/mindmap-md-scan.ts` (+ test) | Create | Markdown lines → `MdBlock[]` (fence-, comment-, front-matter-aware) |
| `app/src/lib/mindmap-convert.ts` (+ test) | Create | `MdBlock[]` → `MindElixirData`; scope helpers (`sectionRange`, `sliceLines`) |
| `app/src/lib/mindmap-merge.ts` (+ test) | Create | `prefixMindmapIds`, `mergeMindmaps` (arrows, summaries, gates, refIds) |
| `app/src/lib/mindmap-folder.ts` (+ test) | Create | Folder file selection: sort, skip keywords, epub skip directive, grouping, unit maps |
| `app/src/lib/mindmap-source.ts` (+ test) | Modify | Safe workspace-relative `path`; `toWorkspaceRelative`, `resolveSourcePath` |
| `app/src/lib/mindmap-gate-plaintext.ts` (+ test) | Modify | Validate orphaned-gate fallback target |
| `app/src/lib/mindmap-fence.ts` (+ test) | Modify | `buildMindmapFence`, `insertBlockAfterLine` |
| `app/src/composables/useMindmapJump.ts` | Modify | Resolve relative path, goto only on success, pathless toast |
| `app/src/composables/useMindmapConvert.ts` | Create | Run a conversion and write its output |
| `app/src/composables/useMindmapFolderFiles.ts` | Create | Recursive `.md` listing + reads through Tauri |
| `app/src/components/MindmapConvertFolder.vue` | Create | Folder dialog |
| `app/src/components/Editor.vue`, `PaneContent.vue`, `App.vue` | Modify | Expose line selection; handle convert event; mount dialog |
| `app/src/lib/keybindings.ts`, `composables/useCommands.ts`, `i18n/en.ts` | Modify | Six actions, commands, strings |
| `app/src/lib/mindmap-gate-controller.test.ts` | Create | Controller tests with a `MindElixirInstance` fake |

---

### Task 1: Markdown block scanner

**Files:**
- Create: `app/src/lib/mindmap-md-scan.ts`
- Test: `app/src/lib/mindmap-md-scan.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type MdBlock =
    | { kind: 'heading'; level: number; text: string; line: number }
    | { kind: 'item'; indent: number; text: string; line: number }
    | { kind: 'text'; indent: number; text: string; line: number }
    | { kind: 'blank'; line: number };
  export function scanMarkdown(source: string, firstLine?: number): MdBlock[];
  export function plainInline(text: string): string;
  ```
  `line` is 1-based and offset by `firstLine - 1` (default `firstLine = 1`).

Rules (spec "5a structural rules"):
- Front matter: only when line 1 (of the scanned source) is `---`; skip through the next `---` or `...` line.
- Code fence: `^ {0,3}(`{3,}|~{3,})`; inside it, skip until a line `^ {0,3}(X{n,})\s*$` with the same char and length ≥ opener.
- HTML comment: a line whose trimmed start is `<!--` skips through the line containing `-->` (same line allowed).
- Skipped lines: `^\s*:{3,}` (fenced-div markers), `^\s*\|` (table rows, checked after blockquote stripping), thematic breaks `^\s*([-*_])(\s*\1){2,}\s*$`.
- Heading: `^ {0,3}(#{1,6})\s+(.+?)\s*$`, then strip a closing `\s+#+$` and a trailing `\s*\{[^{}]*\}$`; text through `plainInline`.
- Item: `^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$`; task box `^\[([ xX])\]\s+` becomes `☐ ` / `☑ `; empty item text is skipped.
- Text: strip repeated blockquote markers `^\s*>\s?` and a line-block `^\|\s?`; `^\[(.+)\]\{\.subheading\}$` keeps its bracket text; result through `plainInline`; empty → `blank`.
- Indent: leading whitespace width, tab = 4.
- `plainInline`: images `!\[([^\]]*)\]\([^)]*\)` → `$1`; links `\[([^\]]+)\]\([^)]*\)` → `$1`; `**x**`, `__x__`, `~~x~~`, `` `x` `` → `x`; trim.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanMarkdown, plainInline } from './mindmap-md-scan.ts';

const kinds = (src: string) => scanMarkdown(src).map((b) => b.kind);

test('headings carry level, stripped text and line', () => {
  assert.deepEqual(scanMarkdown('# One {#id .unlisted}\n\n## Two ##'), [
    { kind: 'heading', level: 1, text: 'One', line: 1 },
    { kind: 'blank', line: 2 },
    { kind: 'heading', level: 2, text: 'Two', line: 3 },
  ]);
});

test('backtick and tilde fences hide their content', () => {
  assert.deepEqual(kinds('```js\n# no\n```\n~~~~\n- no\n~~~\n~~~~\n# yes'), ['heading']);
});

test('a shorter closing marker does not close the fence', () => {
  assert.deepEqual(kinds('````\n```\n# no\n````\n# yes'), ['heading']);
});

test('front matter, comments, directives, fenced divs, tables, rules are skipped', () => {
  const src = '---\ntitle: x\n---\n<!-- epub: skip=true -->\n<!--\n# no\n-->\n::: letter\n| a | b |\n---\n# yes\n:::';
  assert.deepEqual(kinds(src), ['heading']);
});

test('list items keep indent, numbering styles and task boxes', () => {
  assert.deepEqual(scanMarkdown('- a\n  1. b\n\t+ [x] c\n- [ ] d\n- '), [
    { kind: 'item', indent: 0, text: 'a', line: 1 },
    { kind: 'item', indent: 2, text: 'b', line: 2 },
    { kind: 'item', indent: 4, text: '☑ c', line: 3 },
    { kind: 'item', indent: 0, text: '☐ d', line: 4 },
  ]);
});

test('quotes, line blocks and subheadings become text', () => {
  assert.deepEqual(scanMarkdown('> | שורה\n[Sub]{.subheading}'), [
    { kind: 'text', indent: 0, text: 'שורה', line: 1 },
    { kind: 'text', indent: 0, text: 'Sub', line: 2 },
  ]);
});

test('firstLine offsets line numbers', () => {
  assert.deepEqual(scanMarkdown('# A', 10), [{ kind: 'heading', level: 1, text: 'A', line: 10 }]);
});

test('plainInline strips links, images, emphasis and code', () => {
  assert.equal(plainInline('**b** [l](u) ![i](p) `c` ~~s~~ __u__'), 'b l i c s u');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-md-scan.test.ts`
Expected: FAIL, cannot find module `./mindmap-md-scan.ts`.

- [ ] **Step 3: Write the implementation**

```ts
export type MdBlock =
  | { kind: 'heading'; level: number; text: string; line: number }
  | { kind: 'item'; indent: number; text: string; line: number }
  | { kind: 'text'; indent: number; text: string; line: number }
  | { kind: 'blank'; line: number };

type Skip = { until: (line: string) => boolean } | null;

const DEFAULT_FIRST_LINE = 1;
const TAB_WIDTH = 4;
const FRONT_MATTER_OPEN = '---';
const FRONT_MATTER_CLOSE = /^(?:---|\.\.\.)\s*$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';
const SKIPPED_LINE = [/^\s*:{3,}/, /^\s*([-*_])(\s*\1){2,}\s*$/];
const TABLE_ROW = /^\s*\|/;
const HEADING = /^ {0,3}(#{1,6})\s+(.+?)\s*$/;
const CLOSING_HASHES = /\s+#+$/;
const ATTRIBUTE_BLOCK = /\s*\{[^{}]*\}$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TASK_BOX = /^\[([ xX])\]\s+/;
const TASK_OPEN = '☐ ';
const TASK_DONE = '☑ ';
const QUOTE_MARKER = /^\s*>\s?/;
const LINE_BLOCK = /^\|\s?/;
const SUBHEADING = /^\[(.+)\]\{\.subheading\}$/;
const LEADING_WS = /^[ \t]*/;
const INLINE_RULES: [RegExp, string][] = [
  [/!\[([^\]]*)\]\([^)]*\)/g, '$1'],
  [/\[([^\]]+)\]\([^)]*\)/g, '$1'],
  [/\*\*(.+?)\*\*/g, '$1'],
  [/__(.+?)__/g, '$1'],
  [/~~(.+?)~~/g, '$1'],
  [/`([^`]*)`/g, '$1'],
];

export function plainInline(text: string): string {
  return INLINE_RULES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text).trim();
}

function indentOf(line: string): number {
  const ws = LEADING_WS.exec(line)?.[0] ?? '';
  return [...ws].reduce((width, ch) => width + (ch === '\t' ? TAB_WIDTH : 1), 0);
}

function fenceSkip(line: string): Skip {
  const marker = FENCE_OPEN.exec(line)?.[1];
  if (!marker) return null;
  const close = new RegExp(`^ {0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}\\s*$`);
  return { until: (next) => close.test(next) };
}

function commentSkip(line: string): Skip | 'single' {
  if (!line.trimStart().startsWith(COMMENT_OPEN)) return null;
  if (line.includes(COMMENT_CLOSE)) return 'single';
  return { until: (next) => next.includes(COMMENT_CLOSE) };
}

function headingBlock(line: string, at: number): MdBlock | null {
  const match = HEADING.exec(line);
  if (!match) return null;
  const text = plainInline(match[2].replace(CLOSING_HASHES, '').replace(ATTRIBUTE_BLOCK, ''));
  return { kind: 'heading', level: match[1].length, text, line: at };
}

function itemBlock(line: string, at: number): MdBlock | 'empty' | null {
  const match = ITEM.exec(line);
  if (!match) return null;
  const box = TASK_BOX.exec(match[3]);
  const body = box ? match[3].slice(box[0].length) : match[3];
  const prefix = box ? (box[1] === ' ' ? TASK_OPEN : TASK_DONE) : '';
  const text = plainInline(body);
  if (text === '') return 'empty';
  return { kind: 'item', indent: indentOf(line), text: `${prefix}${text}`, line: at };
}

function textBlock(line: string, at: number): MdBlock | null {
  let body = line;
  while (QUOTE_MARKER.test(body)) body = body.replace(QUOTE_MARKER, '');
  if (body !== line) body = body.replace(LINE_BLOCK, '');
  else if (TABLE_ROW.test(body)) return null;
  const sub = SUBHEADING.exec(body.trim());
  const text = plainInline(sub ? sub[1] : body);
  if (text === '') return { kind: 'blank', line: at };
  return { kind: 'text', indent: indentOf(line), text, line: at };
}

function blockFor(line: string, at: number): MdBlock | null {
  if (SKIPPED_LINE.some((pattern) => pattern.test(line))) return null;
  const heading = headingBlock(line, at);
  if (heading) return heading;
  const item = itemBlock(line, at);
  if (item === 'empty') return null;
  return item ?? textBlock(line, at);
}

function frontMatterEnd(lines: string[]): number {
  if (lines[0]?.trim() !== FRONT_MATTER_OPEN) return 0;
  const close = lines.findIndex((line, i) => i > 0 && FRONT_MATTER_CLOSE.test(line));
  return close < 0 ? 0 : close + 1;
}

export function scanMarkdown(source: string, firstLine: number = DEFAULT_FIRST_LINE): MdBlock[] {
  const lines = source.split(/\r?\n/);
  const blocks: MdBlock[] = [];
  let skip: Skip = null;
  for (let i = frontMatterEnd(lines); i < lines.length; i += 1) {
    const line = lines[i];
    if (skip) { if (skip.until(line)) skip = null; continue; }
    const comment = commentSkip(line);
    if (comment) { skip = comment === 'single' ? null : comment; continue; }
    skip = fenceSkip(line);
    if (skip) continue;
    const block = blockFor(line, firstLine + i);
    if (block) blocks.push(block);
  }
  return blocks;
}
```

`scanMarkdown` is ~13 lines of logic; keep it as written (the loop with `continue` guards is the early-return form here).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-md-scan.test.ts`
Expected: 8/8 pass. If the "front matter … skipped" test fails on the `---` line after the table, it is a thematic break (skipped) — fix the scanner, not the test.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-md-scan.ts app/src/lib/mindmap-md-scan.test.ts
git commit -m "feat(mindmap): fence-aware markdown block scanner for conversion"
```

---

### Task 2: Structural converter and scope helpers

**Files:**
- Create: `app/src/lib/mindmap-convert.ts`
- Test: `app/src/lib/mindmap-convert.test.ts`

**Interfaces:**
- Consumes: `scanMarkdown`, `MdBlock` (Task 1).
- Produces:
  ```ts
  export interface ConvertOptions { rootTopic: string; path?: string; firstLine?: number }
  export interface LineRange { fromLine: number; toLine: number }  // 1-based, inclusive
  export function markdownToMindmap(source: string, options: ConvertOptions): MindElixirData;
  export function sectionRange(source: string, line: number): LineRange | null;
  export function sliceLines(source: string, range: LineRange): string;
  export const SELECTION_ROOT_TOPIC = 'Selection';
  ```

Rules:
- Ids: root `root`; others `n1`, `n2`, … in creation order.
- Every node (root included when it comes from a heading) gets `metadata: { source: { line, path? } }`; omit `path` when `options.path` is undefined.
- Heading: pop the heading stack while `top.level >= level`; add under `top.node`; push; clear the item stack.
- Item: pop the item stack while `top.indent >= indent`; parent = item top or heading top; push.
- Text: if an item is open and (`indent > 0` or the previous block was not `blank`), append to the deepest open item whose `indent < max(indent, 1)` — i.e. the last item for lazy continuation; otherwise clear the item stack and append to the heading top.
- Note append: same paragraph (previous block was text for the same node) joins with a space; a new paragraph joins with `\n\n`.
- Root lift: if the root has exactly one child, no note, and that child came from a heading, the child becomes `nodeData` with id `root` (rewrite only the id; keep its `metadata`).
- `sectionRange`: last heading with `line <= line` (from `scanMarkdown`, so fenced `#` is ignored); end = line before the next heading with `level <= its level`, else the last line. `null` when no heading precedes `line`.
- `sliceLines`: lines `fromLine..toLine` joined by `\n`.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { markdownToMindmap, sectionRange, sliceLines } from './mindmap-convert.ts';

const shape = (n: NodeObj): unknown => [n.topic, ...(n.children ?? []).map(shape)];
const opts = { rootTopic: 'doc', path: 'notes/a.md' };

test('a sole H1 is lifted to root with its source', () => {
  const data = markdownToMindmap('# Book\n## A\n- x\n  - y\n## B', opts);
  assert.deepEqual(shape(data.nodeData), ['Book', ['A', ['x', ['y']]], ['B']]);
  assert.equal(data.nodeData.id, 'root');
  assert.deepEqual(data.nodeData.metadata, { source: { line: 1, path: 'notes/a.md' } });
});

test('two H1s keep the file-stem root', () => {
  const data = markdownToMindmap('# A\n# B', opts);
  assert.deepEqual(shape(data.nodeData), ['doc', ['A'], ['B']]);
});

test('skipped heading levels attach to the nearest lower heading', () => {
  const data = markdownToMindmap('# A\n### C\n## B', { rootTopic: 'd' });
  assert.deepEqual(shape(data.nodeData), ['A', ['C'], ['B']]);
});

test('paragraphs go to notes; continuation text to the item', () => {
  const data = markdownToMindmap('# A\nline one\nline two\n\nsecond\n- item\n  more\n\nafter', { rootTopic: 'd' });
  const [item] = data.nodeData.children ?? [];
  assert.equal(data.nodeData.note, 'line one line two\n\nsecond\n\nafter');
  assert.equal(item.note, 'more');
});

test('ids match [\\w-]+ and lines are stamped, path omitted when absent', () => {
  const data = markdownToMindmap('- a\n- b', { rootTopic: 'd', firstLine: 5 });
  const [a, b] = data.nodeData.children ?? [];
  assert.deepEqual([a.id, b.id], ['n1', 'n2']);
  assert.deepEqual(b.metadata, { source: { line: 6 } });
});

test('sectionRange ends before the next same-or-higher heading and ignores fences', () => {
  const src = '# A\n## B\ntext\n```\n# no\n```\n### C\n## D';
  assert.deepEqual(sectionRange(src, 3), { fromLine: 2, toLine: 7 });
  assert.equal(sectionRange('intro\n# A', 1), null);
  assert.equal(sliceLines(src, { fromLine: 2, toLine: 3 }), '## B\ntext');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-convert.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { scanMarkdown, type MdBlock } from './mindmap-md-scan.ts';

export interface ConvertOptions { rootTopic: string; path?: string; firstLine?: number }
export interface LineRange { fromLine: number; toLine: number }

export const SELECTION_ROOT_TOPIC = 'Selection';
const ROOT_ID = 'root';
const ID_PREFIX = 'n';
const SAME_PARAGRAPH = ' ';
const NEW_PARAGRAPH = '\n\n';
const NEWLINE = '\n';
const ROOT_LEVEL = 0;

type HeadingFrame = { level: number; node: NodeObj };
type ItemFrame = { indent: number; node: NodeObj };

class TreeBuilder {
  private count = 0;
  private headings: HeadingFrame[];
  private items: ItemFrame[] = [];
  private previous: MdBlock | null = null;
  private lastNoteNode: NodeObj | null = null;
  readonly root: NodeObj;
  private readonly fromHeading = new WeakSet<NodeObj>();

  constructor(private readonly options: ConvertOptions) {
    this.root = { id: ROOT_ID, topic: options.rootTopic, children: [] };
    this.headings = [{ level: ROOT_LEVEL, node: this.root }];
  }

  add(block: MdBlock): void {
    if (block.kind === 'heading') this.addHeading(block.level, block.text, block.line);
    else if (block.kind === 'item') this.addItem(block.indent, block.text, block.line);
    else if (block.kind === 'text') this.addText(block.indent, block.text);
    this.previous = block;
  }

  isHeadingNode(node: NodeObj): boolean {
    return this.fromHeading.has(node);
  }

  private node(topic: string, line: number): NodeObj {
    this.count += 1;
    const source = this.options.path === undefined ? { line } : { line, path: this.options.path };
    return { id: `${ID_PREFIX}${this.count}`, topic, children: [], metadata: { source } };
  }

  private addHeading(level: number, text: string, line: number): void {
    while (this.headings.length > 1 && this.headings[this.headings.length - 1].level >= level) this.headings.pop();
    const node = this.node(text, line);
    this.fromHeading.add(node);
    this.headingTop().children?.push(node);
    this.headings.push({ level, node });
    this.items = [];
  }

  private addItem(indent: number, text: string, line: number): void {
    while (this.items.length > 0 && this.items[this.items.length - 1].indent >= indent) this.items.pop();
    const parent = this.items.length > 0 ? this.items[this.items.length - 1].node : this.headingTop();
    const node = this.node(text, line);
    parent.children?.push(node);
    this.items.push({ indent, node });
  }

  private addText(indent: number, text: string): void {
    const isContinuation = this.items.length > 0 && (indent > 0 || this.previous?.kind !== 'blank');
    if (!isContinuation) this.items = [];
    const target = isContinuation ? this.items[this.items.length - 1].node : this.headingTop();
    this.appendNote(target, text);
  }

  private appendNote(node: NodeObj, text: string): void {
    const sameParagraph = this.previous?.kind === 'text' && this.lastNoteNode === node;
    const joiner = sameParagraph ? SAME_PARAGRAPH : NEW_PARAGRAPH;
    node.note = node.note ? `${node.note}${joiner}${text}` : text;
    this.lastNoteNode = node;
  }

  private headingTop(): NodeObj {
    return this.headings[this.headings.length - 1].node;
  }
}

function liftSoleHeading(builder: TreeBuilder): NodeObj {
  const { root } = builder;
  const children = root.children ?? [];
  if (children.length !== 1 || root.note || !builder.isHeadingNode(children[0])) return root;
  return { ...children[0], id: ROOT_ID };
}

export function markdownToMindmap(source: string, options: ConvertOptions): MindElixirData {
  const builder = new TreeBuilder(options);
  for (const block of scanMarkdown(source, options.firstLine)) builder.add(block);
  return { nodeData: liftSoleHeading(builder) };
}

export function sectionRange(source: string, line: number): LineRange | null {
  const headings = scanMarkdown(source).filter((b): b is Extract<MdBlock, { kind: 'heading' }> => b.kind === 'heading');
  const start = headings.filter((h) => h.line <= line).pop();
  if (!start) return null;
  const next = headings.find((h) => h.line > start.line && h.level <= start.level);
  const lastLine = source.split(NEWLINE).length;
  return { fromLine: start.line, toLine: next ? next.line - 1 : lastLine };
}

export function sliceLines(source: string, range: LineRange): string {
  return source.split(NEWLINE).slice(range.fromLine - 1, range.toLine).join(NEWLINE);
}
```

Note on the "paragraphs go to notes" test: `after` follows a blank line at indent 0, so it closes the item and lands on the heading note.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-convert.test.ts src/lib/mindmap-md-scan.test.ts`
Expected: 14/14 pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-convert.ts app/src/lib/mindmap-convert.test.ts
git commit -m "feat(mindmap): structural markdown to mind map converter"
```

---

### Task 3: Id prefixing and map merge

**Files:**
- Create: `app/src/lib/mindmap-merge.ts`
- Test: `app/src/lib/mindmap-merge.test.ts`

**Interfaces:**
- Consumes: `isRecord` from `./mindmap-gates.ts`.
- Produces:
  ```ts
  export interface MergeEntry { data: MindElixirData; group?: string }
  export function filePrefix(index: number): string;            // 0 → 'f01-'
  export function prefixMindmapIds(data: MindElixirData, prefix: string): MindElixirData;
  export function mergeMindmaps(rootTopic: string, entries: MergeEntry[]): MindElixirData;
  ```

Rules:
- `prefixMindmapIds` is pure (no mutation): node `id`, `metadata.refId` (when a string), `metadata.gate.target` (when non-empty) get the prefix; other `metadata` keys are kept; arrows: `id`, `from`, `to`; summaries: `id`, `parent`. `start`/`end` indices untouched.
- `mergeMindmaps`: entry `i` is prefixed with `filePrefix(i)`; root `{ id: 'root', topic: rootTopic }`; consecutive entries with the same defined `group` share a group node `{ id: 'g<NN>', topic: group }` (NN counts groups from 01); arrows and summaries are concatenated; omit empty `arrows`/`summaries`.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { filePrefix, prefixMindmapIds, mergeMindmaps } from './mindmap-merge.ts';

const sample = (): MindElixirData => ({
  nodeData: {
    id: 'root', topic: 'A', children: [
      { id: 'n1', topic: 'x', metadata: { refId: 'n1', source: { line: 2 } } },
      { id: 'n2', topic: 'gate', metadata: { gate: { target: 'n1' } } },
      { id: 'n3', topic: 'broken', metadata: { gate: { target: '', missingRef: 'zz' } } },
    ],
  },
  arrows: [{ id: 'a1', label: '', from: 'n1', to: 'n2', delta1: { x: 0, y: 0 }, delta2: { x: 0, y: 0 } }],
  summaries: [{ id: 's1', label: 'S', parent: 'root', start: 0, end: 1 }],
});

test('filePrefix pads to two digits', () => {
  assert.equal(filePrefix(0), 'f01-');
  assert.equal(filePrefix(99), 'f100-');
});

test('prefix rewrites ids, refIds, gate targets, arrows and summaries without mutating', () => {
  const input = sample();
  const out = prefixMindmapIds(input, 'f01-');
  const [x, gate, broken] = out.nodeData.children ?? [];
  assert.equal(out.nodeData.id, 'f01-root');
  assert.deepEqual(x.metadata, { refId: 'f01-n1', source: { line: 2 } });
  assert.deepEqual(gate.metadata, { gate: { target: 'f01-n1' } });
  assert.deepEqual(broken.metadata, { gate: { target: '', missingRef: 'zz' } });
  assert.deepEqual([out.arrows?.[0].from, out.arrows?.[0].to, out.arrows?.[0].id], ['f01-n1', 'f01-n2', 'f01-a1']);
  assert.deepEqual([out.summaries?.[0].parent, out.summaries?.[0].id], ['f01-root', 'f01-s1']);
  assert.equal(input.nodeData.id, 'root');
});

test('merge groups consecutive entries and keeps arrows', () => {
  const out = mergeMindmaps('Folder', [{ data: sample(), group: 'part1' }, { data: sample(), group: 'part1' }, { data: sample() }]);
  const [group, third] = out.nodeData.children ?? [];
  assert.equal(out.nodeData.id, 'root');
  assert.deepEqual([group.id, group.topic, group.children?.map((c) => c.id)], ['g01', 'part1', ['f01-root', 'f02-root']]);
  assert.equal(third.id, 'f03-root');
  assert.equal(out.arrows?.length, 3);
  assert.equal(out.summaries?.length, 3);
});

test('merge omits empty arrow and summary lists', () => {
  const out = mergeMindmaps('F', [{ data: { nodeData: { id: 'root', topic: 'a' } } }]);
  assert.equal('arrows' in out, false);
  assert.equal('summaries' in out, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-merge.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { isRecord } from './mindmap-gates.ts';

export interface MergeEntry { data: MindElixirData; group?: string }

const FILE_PREFIX = 'f';
const GROUP_PREFIX = 'g';
const PREFIX_SEPARATOR = '-';
const PAD_WIDTH = 2;
const PAD_CHAR = '0';
const ROOT_ID = 'root';

const pad = (n: number): string => String(n).padStart(PAD_WIDTH, PAD_CHAR);

export function filePrefix(index: number): string {
  return `${FILE_PREFIX}${pad(index + 1)}${PREFIX_SEPARATOR}`;
}

function prefixGate(gate: unknown, prefix: string): unknown {
  if (!isRecord(gate) || typeof gate.target !== 'string' || gate.target === '') return gate;
  return { ...gate, target: `${prefix}${gate.target}` };
}

function prefixMetadata(metadata: unknown, prefix: string): unknown {
  if (!isRecord(metadata)) return metadata;
  const next: Record<string, unknown> = { ...metadata };
  if (typeof metadata.refId === 'string') next.refId = `${prefix}${metadata.refId}`;
  if ('gate' in metadata) next.gate = prefixGate(metadata.gate, prefix);
  return next;
}

function prefixNode(node: NodeObj, prefix: string): NodeObj {
  const next: NodeObj = { ...node, id: `${prefix}${node.id}` };
  if (node.metadata !== undefined) next.metadata = prefixMetadata(node.metadata, prefix);
  if (node.children) next.children = node.children.map((child) => prefixNode(child, prefix));
  return next;
}

export function prefixMindmapIds(data: MindElixirData, prefix: string): MindElixirData {
  const next: MindElixirData = { ...data, nodeData: prefixNode(data.nodeData, prefix) };
  if (data.arrows) next.arrows = data.arrows.map((a) => ({ ...a, id: `${prefix}${a.id}`, from: `${prefix}${a.from}`, to: `${prefix}${a.to}` }));
  if (data.summaries) next.summaries = data.summaries.map((s) => ({ ...s, id: `${prefix}${s.id}`, parent: `${prefix}${s.parent}` }));
  return next;
}

function groupChildren(entries: MergeEntry[], nodes: NodeObj[]): NodeObj[] {
  const out: NodeObj[] = [];
  let groupCount = 0;
  entries.forEach((entry, i) => {
    const last = out[out.length - 1];
    if (entry.group === undefined) { out.push(nodes[i]); return; }
    if (last && last.topic === entry.group && last.id.startsWith(GROUP_PREFIX) && entries[i - 1]?.group === entry.group) {
      last.children?.push(nodes[i]);
      return;
    }
    groupCount += 1;
    out.push({ id: `${GROUP_PREFIX}${pad(groupCount)}`, topic: entry.group, children: [nodes[i]] });
  });
  return out;
}

export function mergeMindmaps(rootTopic: string, entries: MergeEntry[]): MindElixirData {
  const prefixed = entries.map((entry, i) => prefixMindmapIds(entry.data, filePrefix(i)));
  const arrows = prefixed.flatMap((d) => d.arrows ?? []);
  const summaries = prefixed.flatMap((d) => d.summaries ?? []);
  const children = groupChildren(entries, prefixed.map((d) => d.nodeData));
  const merged: MindElixirData = { nodeData: { id: ROOT_ID, topic: rootTopic, children } };
  if (arrows.length > 0) merged.arrows = arrows;
  if (summaries.length > 0) merged.summaries = summaries;
  return merged;
}
```

If `isRecord` in `mindmap-gates.ts` is typed for a narrower `Meta`, use it as is; if `vue-tsc` rejects the `metadata` assignment type, cast through the `NodeObj['metadata']` type, not `any`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-merge.test.ts`
Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-merge.ts app/src/lib/mindmap-merge.test.ts
git commit -m "feat(mindmap): prefix ids and merge maps with arrows, summaries and gates"
```

---

### Task 4: Phase 4 hardening carry-overs (source path, gate target, jump)

**Files:**
- Modify: `app/src/lib/mindmap-source.ts`, `app/src/lib/mindmap-source.test.ts`
- Modify: `app/src/lib/mindmap-gate-plaintext.ts`, `app/src/lib/mindmap-gate-plaintext.test.ts`
- Modify: `app/src/composables/useMindmapJump.ts`, `app/src/components/MindmapView.vue` (pathless toast), `app/src/i18n/en.ts`

**Interfaces:**
- Produces (in `mindmap-source.ts`):
  ```ts
  export function isSafeSourcePath(path: string): boolean;
  export function toWorkspaceRelative(absPath: string, root: string): string | undefined;
  export function resolveSourcePath(root: string, relPath: string): string;
  ```
- Changes: `readNodeSource` returns `null` when `path` is present and `!isSafeSourcePath(path)`.

Rules:
- `isSafeSourcePath`: non-empty; no leading `/` or `\`; no `\` anywhere; no drive prefix `^[A-Za-z]:`; no scheme `^[a-z][\w+.-]*:`; no segment equal to `..` or `.`; no NUL.
- `toWorkspaceRelative`: normalize `\` to `/` in both, strip trailing `/` from root; return the remainder when `absPath` starts with `root + '/'` and the remainder is safe, else `undefined`.
- `resolveSourcePath`: `${root without trailing slash}/${relPath}`.
- Gate fallback (`mindmap-gate-plaintext.ts` around line 49, `gate.missingRef || gate.target`): use the value only if it matches `^[\w-]+$`; otherwise emit no gate line (skip the node's gate, keep its topic as a plain node line). Add a `SAFE_REF` constant; reuse it if `missingRef` validation from Phase 4 already defines one.
- `jumpTo(source, tabId)`:
  1. Pathless: activate `tabId` as today, then dispatch goto.
  2. With path: no workspace root → `toasts.info(t('mindmap.sourceUnavailable'))`, return. Else `abs = resolveSourcePath(root, path)`; `await files.openPath(abs, { bypassNewWindow: true })`; after `nextTick`, if the active tab's `filePath` differs from `abs` (compare both with `\` normalized to `/`) → toast `mindmap.sourceUnavailable`, return; else dispatch goto.
- `MindmapView.vue` (whole-file `.mmap` view): a source without `path` has no target document → toast `mindmap.sourceUnavailable` instead of calling `jumpTo`. Fence overlays keep the pathless path (their tab is the markdown tab).
- `en.ts` `mindmap`: `sourceUnavailable: 'Source document is not available'`.

- [ ] **Step 1: Write the failing tests** (append to `mindmap-source.test.ts`)

```ts
import { isSafeSourcePath, toWorkspaceRelative, resolveSourcePath, readNodeSource } from './mindmap-source.ts';

test('isSafeSourcePath rejects absolute, drive, scheme, backslash and dot segments', () => {
  for (const bad of ['/etc/passwd', 'C:/x.md', 'file:///x', 'a\\b.md', '../x.md', 'a/../b.md', './a.md', '', 'a\0b'])
    assert.equal(isSafeSourcePath(bad), false, bad);
  assert.equal(isSafeSourcePath('notes/פרק 1.md'), true);
});

test('readNodeSource drops an unsafe path', () => {
  assert.equal(readNodeSource({ id: 'a', topic: 'a', metadata: { source: { line: 2, path: '/abs.md' } } }), null);
});

test('toWorkspaceRelative and resolveSourcePath round-trip', () => {
  assert.equal(toWorkspaceRelative('/ws/notes/a.md', '/ws/'), 'notes/a.md');
  assert.equal(toWorkspaceRelative('/other/a.md', '/ws'), undefined);
  assert.equal(toWorkspaceRelative('C:\\ws\\a.md', 'C:\\ws'), 'a.md');
  assert.equal(resolveSourcePath('/ws/', 'notes/a.md'), '/ws/notes/a.md');
});
```

Update the existing test at `mindmap-source.test.ts:31` that uses an absolute path: it must now expect `null` (or switch it to a relative path and keep its original assertion).

Gate test (append to `mindmap-gate-plaintext.test.ts`): build a map whose gate node has `metadata.gate = { target: 'x\n- injected' }` and no matching node; assert `gatesToTopics` output topics contain no `\n` and no `=> x` line for it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-source.test.ts src/lib/mindmap-gate-plaintext.test.ts`
Expected: FAIL on the new tests (missing exports, unsafe path accepted, injected target emitted).

- [ ] **Step 3: Implement** the three lib functions, the `readNodeSource` guard, the gate guard, `jumpTo`, the `MindmapView` toast, and the i18n key as specified above.

```ts
const UNSAFE_PATH = [/^[\\/]/, /\\/, /^[A-Za-z]:/, /^[a-z][\w+.-]*:/i, /\0/];
const DOT_SEGMENTS = new Set(['.', '..']);
const SEPARATOR = '/';
const BACKSLASH = /\\/g;
const TRAILING_SLASHES = /\/+$/;

export function isSafeSourcePath(path: string): boolean {
  if (path === '' || UNSAFE_PATH.some((p) => p.test(path))) return false;
  return !path.split(SEPARATOR).some((segment) => DOT_SEGMENTS.has(segment));
}

const normalize = (p: string): string => p.replace(BACKSLASH, SEPARATOR);

export function toWorkspaceRelative(absPath: string, root: string): string | undefined {
  const base = `${normalize(root).replace(TRAILING_SLASHES, '')}${SEPARATOR}`;
  const path = normalize(absPath);
  if (!path.startsWith(base)) return undefined;
  const rel = path.slice(base.length);
  return isSafeSourcePath(rel) ? rel : undefined;
}

export function resolveSourcePath(root: string, relPath: string): string {
  return `${root.replace(TRAILING_SLASHES, '')}${SEPARATOR}${relPath}`;
}
```

In `readNodeSource`, after the `typeof path` check: `if (path !== undefined && !isSafeSourcePath(path)) return null;`.

- [ ] **Step 4: Verify**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-*.test.ts && pnpm build`
Expected: all mindmap tests pass (137 + new), build OK.
Browser check (`pnpm dev`, Vite): open a `.mmap`, run "Mindmap: Jump to Source" on a node without source → existing "no source" behavior; paste a crafted `.mmap` whose node has `source.path: "/etc/passwd"` → no jump, no error.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-source.ts app/src/lib/mindmap-source.test.ts app/src/lib/mindmap-gate-plaintext.ts app/src/lib/mindmap-gate-plaintext.test.ts app/src/composables/useMindmapJump.ts app/src/components/MindmapView.vue app/src/i18n/en.ts
git commit -m "fix(mindmap): workspace-relative source paths, safe gate fallback, guarded jump"
```

---

### Task 5: Document, section and selection conversion (commands, output)

**Files:**
- Modify: `app/src/lib/mindmap-fence.ts`, `app/src/lib/mindmap-fence.test.ts`
- Create: `app/src/composables/useMindmapConvert.ts`
- Modify: `app/src/components/Editor.vue` (expose `getLineSelection`), `app/src/components/PaneContent.vue` (event handler), `app/src/lib/keybindings.ts`, `app/src/composables/useCommands.ts`, `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: `markdownToMindmap`, `sectionRange`, `sliceLines`, `SELECTION_ROOT_TOPIC` (Task 2); `toWorkspaceRelative` (Task 4); `sanitizeMindmapData`, `serializeMindmap`, `mmapPathFor`, `rootTopicFromFileName` (`mindmap-format.ts`); `serializeMindmapFence`, `MINDMAP_FENCE_LANG` (`mindmap-fence.ts`).
- Produces:
  ```ts
  // mindmap-fence.ts
  export function buildMindmapFence(data: MindElixirData): string;           // "```mindmap\n<body>\n```"
  export function insertBlockAfterLine(source: string, line: number, block: string): string;
  // Editor.vue defineExpose
  getLineSelection(): { fromLine: number; toLine: number; headLine: number; isEmpty: boolean } | null;
  // useMindmapConvert.ts
  export type ConvertScope = 'document' | 'section' | 'selection';
  export type ConvertOutput = 'map' | 'fence';
  export const MINDMAP_CONVERT_EVENT = 'solomd:mindmap-convert';
  export interface MindmapConvertDetail { scope: ConvertScope; output: ConvertOutput; paneId: string }
  export function useMindmapConvert(): { convert(tab: Tab, scope: ConvertScope, output: ConvertOutput, selection: LineSelection | null): void };
  ```

Rules:
- `insertBlockAfterLine`: insert after line `line` (1-based) as `\n\n<block>\n`, collapsing to exactly one blank line on each side; `line` past the end appends.
- `buildMindmapFence` body is `serializeMindmapFence(data)`; fence marker ```` ``` ````; language `MINDMAP_FENCE_LANG`.
- `convert`:
  - Guard: `tab.language !== 'markdown'` → toast `mindmap.convertMarkdownOnly`.
  - Range: document = whole file; section = `sectionRange(content, selection.headLine)` (null → toast `mindmap.convertNoSection`); selection = `{fromLine, toLine}` (`isEmpty` → toast `mindmap.convertEmptySelection`). Section/selection with `selection === null` (plain Windows editor) → toast `mindmap.convertNeedsEditor`.
  - Root topic: document → `rootTopicFromFileName(tab.fileName)`; section → same (lift replaces it); selection → `SELECTION_ROOT_TOPIC`.
  - `path`: `tab.filePath && workspace.currentFolder ? toWorkspaceRelative(tab.filePath, workspace.currentFolder) : undefined`.
  - `data = sanitizeMindmapData(markdownToMindmap(sliceLines(content, range), { rootTopic, path, firstLine: range.fromLine }))`.
  - Output `map`: `tabs.newTab({ fileName: fileNameOf(mmapPathFor(tab.filePath ?? tab.fileName)), language: 'mindmap' })`, then `tabs.setContent(newTab.id, serializeMindmap(data))`. No `importedFrom`. Reuse the `fileNameOf` helper `useFiles.ts` uses (export it or copy the one-liner into a lib util).
  - Output `fence`: `tabs.setContent(tab.id, insertBlockAfterLine(content, range.toLine, buildMindmapFence(data)))`. Toast success `mindmap.convertDone`.
- Editor `getLineSelection`: CodeMirror path reads `view.state.selection.main` → `doc.lineAt(from).number`, `doc.lineAt(to).number` (if `to` is at column 0 of a later line, use the previous line), `doc.lineAt(head).number`, `isEmpty: main.empty`. `usePlainWindowsEditor` → return `null` (recorded deviation: plain editor supports document scope only).
- PaneContent: listen to `MINDMAP_CONVERT_EVENT` like `onInsertMarkdownEvent`; ignore other panes; call `convert(props.tab, scope, output, editorRef.value?.getLineSelection?.() ?? null)`.
- Key actions (`keybindings.ts`, category `'tools'`, no `scope`):
  | id | label | defaults |
  |---|---|---|
  | `mindmap.convertDocument` | `Mindmap: Convert Document to Map` | `['Mod+Alt+Shift+M']` |
  | `mindmap.convertSection` | `Mindmap: Convert Section to Map` | `[]` |
  | `mindmap.convertSelection` | `Mindmap: Convert Selection to Map` | `[]` |
  | `mindmap.insertFenceFromSection` | `Mindmap: Insert Map Fence from Section` | `[]` |
  | `mindmap.insertFenceFromSelection` | `Mindmap: Insert Map Fence from Selection` | `[]` |
  Before adding the default, confirm `Mod+Alt+Shift+M` is unused (`grep -n "Alt+Shift+M\|Shift+Alt+M" app/src/lib/keybindings.ts app/src/lib/mindmap-keymap.ts`) and that `conflictFor` reports none; if it clashes, pick another and record it in the Status.
- Commands (`useCommands.ts`): one `Command` per action, `title: t('cmd.mindmap.<camelId>')`, `shortcut: kb(id)`, `run` dispatches `MINDMAP_CONVERT_EVENT` with `paneId: tiles.focusedPaneId`. Verify how a global key action reaches its command (follow `fmt.code` from the key dispatcher to `useCommands`) and make the new ids reachable the same way.
- i18n `en.ts`: `cmd.mindmap.{convertDocument,convertSection,convertSelection,insertFenceFromSection,insertFenceFromSelection}` (same text as labels); `mindmap.{convertMarkdownOnly: 'Convert works on markdown documents', convertNoSection: 'Place the cursor under a heading', convertEmptySelection: 'Select some text first', convertNeedsEditor: 'Section and selection need the rich editor', convertDone: 'Mind map inserted'}`.

- [ ] **Step 1: Write the failing test** (append to `mindmap-fence.test.ts`)

```ts
import { buildMindmapFence, insertBlockAfterLine } from './mindmap-fence.ts';

test('insertBlockAfterLine keeps one blank line around the block', () => {
  assert.equal(insertBlockAfterLine('a\nb\n\nc', 2, 'X'), 'a\nb\n\nX\n\nc');
  assert.equal(insertBlockAfterLine('a', 5, 'X'), 'a\n\nX\n');
});

test('buildMindmapFence wraps the serialized body', () => {
  const fence = buildMindmapFence({ nodeData: { id: 'root', topic: 'R', children: [{ id: 'n1', topic: 'A' }] } });
  assert.match(fence, /^```mindmap\n[\s\S]*- A[\s\S]*\n```$/);
});
```

- [ ] **Step 2: Run** `cd app && node --test --experimental-strip-types src/lib/mindmap-fence.test.ts` → FAIL (missing exports).

- [ ] **Step 3: Implement** `buildMindmapFence`, `insertBlockAfterLine` (≤ 20 lines: split lines, take head `0..line`, tail rest, trim trailing blank lines from head and leading from tail, join `head + '\n\n' + block + '\n' + (tail ? '\n' + tail : '')`), then the composable, Editor expose, PaneContent handler, actions, commands, i18n.

- [ ] **Step 4: Verify**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-*.test.ts && pnpm build` → pass.
Browser check (Vite `pnpm dev`): open a markdown doc with `# Book`, `## A` + list + paragraph, a fenced code block containing `# no`, and Hebrew headings:
1. Mod+Alt+Shift+M → new `Book.mmap` tab; root `Book`; `# no` absent; paragraph shows as a note; Hebrew labels render RTL.
2. Jump to Source on a list node → markdown tab opens at that line (workspace open in web? if not, record pathless behavior).
3. Cursor under `## A` → "Insert Map Fence from Section" → fence appears after the section and renders in preview.
4. Select two list lines → "Convert Selection to Map" → root `Selection`.
5. Run "Convert Document" from a `.mmap` tab → toast `convertMarkdownOnly`.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-fence.ts app/src/lib/mindmap-fence.test.ts app/src/composables/useMindmapConvert.ts app/src/components/Editor.vue app/src/components/PaneContent.vue app/src/lib/keybindings.ts app/src/composables/useCommands.ts app/src/i18n/en.ts
git commit -m "feat(mindmap): convert document, section or selection to a map or fence"
```

---

### Task 6: Folder conversion

**Files:**
- Create: `app/src/lib/mindmap-folder.ts`, `app/src/lib/mindmap-folder.test.ts`
- Create: `app/src/composables/useMindmapFolderFiles.ts`, `app/src/components/MindmapConvertFolder.vue`
- Modify: `app/src/App.vue` (mount dialog), `app/src/lib/keybindings.ts`, `app/src/composables/useCommands.ts`, `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: `markdownToMindmap` (Task 2), `mergeMindmaps`, `MergeEntry` (Task 3), `toWorkspaceRelative` (Task 4), `scanMarkdown` (Task 1), `sanitizeMindmapData`, `serializeMindmap`, `rootTopicFromFileName`.
- Produces:
  ```ts
  export interface FolderFile { absPath: string; relPath: string; text: string }   // relPath relative to the chosen folder, '/' separated
  export interface FolderPick { file: FolderFile; title: string; skippedByDirective: boolean }
  export const MAX_FILE_CHARS = 2_000_000;
  export const NODE_WARNING_THRESHOLD = 5000;
  export function sortFolderFiles(files: FolderFile[]): FolderFile[];
  export function parseSkipKeywords(input: string): string[];
  export function matchesSkipKeyword(text: string, keywords: string[]): boolean;
  export function hasEpubSkip(text: string): boolean;
  export function fileTitle(file: FolderFile): string;           // sole H1 text, else stem
  export function subfolderOf(relPath: string): string | undefined;
  export function buildFolderMap(folderName: string, files: FolderFile[], options: { groupBySubfolder: boolean; workspaceRoot: string | null }): MindElixirData;
  export function countNodes(data: MindElixirData): number;
  // useMindmapFolderFiles.ts
  export function useMindmapFolderFiles(): { listMarkdownFiles(folder: string): Promise<{ files: FolderFile[]; oversized: string[] }> };
  ```

Rules:
- `sortFolderFiles`: by `relPath` with `localeCompare(b, undefined, { numeric: false })` — plain lexical (`a < b ? -1 : 1`), matching epub-builder spine order.
- `parseSkipKeywords`: split on `,`, trim, drop empty, dedupe case-insensitively.
- `matchesSkipKeyword`: for each keyword, `new RegExp('(?<![\\p{L}\\p{N}_])' + escaped + '(?![\\p{L}\\p{N}_])', 'iu')`; escape regex metacharacters.
- `hasEpubSkip`: a line matching `^\s*<!--\s*epub:\s*(.*?)\s*-->\s*$` outside code fences (reuse the fence rule: run the same fence-skip logic — export a small `linesOutsideFences(source): { text: string; line: number }[]` from `mindmap-md-scan.ts` and use it) whose pairs (split `,`, then `=`, trimmed) include `skip=true`.
- `fileTitle`: headings of level 1 from `scanMarkdown`; exactly one → its text; else `rootTopicFromFileName(relPath)`.
- `subfolderOf`: the directory part of `relPath` (`a/b/c.md` → `a/b`), `undefined` at top level.
- `buildFolderMap`: for each file, `markdownToMindmap(text, { rootTopic: stem, path })` where `path = workspaceRoot ? toWorkspaceRelative(absPath, workspaceRoot) : undefined`; entries get `group = subfolderOf(relPath)` when grouping; result `sanitizeMindmapData(mergeMindmaps(folderName, entries))`.
- `listMarkdownFiles`: recursive `invoke('list_dir', { path })` (entries `{ name, path, is_dir }`); skip names starting with `.` and `node_modules`; keep `.md` / `.markdown` (case-insensitive); stop at 500 files; read each with `invoke<FileReadResult>('read_file', { path })`; content longer than `MAX_FILE_CHARS` goes to `oversized` (relPath) instead of `files`; read errors also go to `oversized` with the error logged via `console.error`.
- Dialog (`MindmapConvertFolder.vue`), opened by window event `solomd:mindmap-convert-folder`:
  - Folder: defaults to `workspace.currentFolder`; "Choose…" uses `@tauri-apps/plugin-dialog` `open({ directory: true })` (same as `useFiles.ts:729`). No folder → message `mindmap.folderNone`.
  - List: one checkbox row per file showing `relPath` and title; initially checked unless `hasEpubSkip` (badge `mindmap.folderSkippedDirective`) or skip keywords match title or stem.
  - Inputs: skip keywords text field (re-evaluates checks live, but never re-checks a file the user unchecked by hand — track manual toggles in a `Set`), "Group by subfolder" checkbox.
  - Oversized files listed under `mindmap.folderOversized`.
  - Convert: build the map; if `countNodes > NODE_WARNING_THRESHOLD`, `window.confirm(t('mindmap.folderLarge', { count }))` first; open a new tab `fileName: '<folderName>.mmap'`, `language: 'mindmap'`, content `serializeMindmap(map)`; close the dialog.
  - Escape closes; `role="dialog"` with `aria-modal="true"`; `dir="auto"` on file rows (Hebrew names).
- Action `mindmap.convertFolder`, label `Mindmap: Convert Folder to Map`, category `'tools'`, `defaults: []`; command dispatches `solomd:mindmap-convert-folder`.
- i18n: `cmd.mindmap.convertFolder`; `mindmap.{folderTitle: 'Convert folder to mind map', folderChoose: 'Choose…', folderNone: 'Open or choose a folder first', folderSkipKeywords: 'Skip files whose title contains (comma-separated whole words)', folderGroup: 'Group by subfolder', folderSkippedDirective: 'epub skip', folderOversized: 'Skipped (over 2 MB or unreadable)', folderLarge: 'This map has {count} nodes. Continue?', folderConvert: 'Convert', folderCancel: 'Cancel'}`. Check how `t()` interpolates (grep an existing `{count}` key) and match it.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sortFolderFiles, parseSkipKeywords, matchesSkipKeyword, hasEpubSkip,
  fileTitle, subfolderOf, buildFolderMap, countNodes,
} from './mindmap-folder.ts';

const f = (relPath: string, text: string) => ({ absPath: `/ws/book/${relPath}`, relPath, text });

test('files sort lexically by relative path', () => {
  assert.deepEqual(sortFolderFiles([f('10-b.md', ''), f('02-a.md', ''), f('a/01.md', '')]).map((x) => x.relPath), ['02-a.md', '10-b.md', 'a/01.md']);
});

test('skip keywords are whole-word, case-insensitive, Hebrew-aware', () => {
  const kw = parseSkipKeywords(' Draft, טיוטה ,draft,');
  assert.deepEqual(kw, ['Draft', 'טיוטה']);
  assert.equal(matchesSkipKeyword('My DRAFT notes', kw), true);
  assert.equal(matchesSkipKeyword('Drafting', kw), false);
  assert.equal(matchesSkipKeyword('פרק טיוטה', kw), true);
});

test('epub skip directive is honored outside fences only', () => {
  assert.equal(hasEpubSkip('<!-- epub: toc=false, skip=true -->\n# A'), true);
  assert.equal(hasEpubSkip('```\n<!-- epub: skip=true -->\n```'), false);
  assert.equal(hasEpubSkip('<!-- epub: skip=false -->'), false);
});

test('title is the sole H1, else the stem; subfolder is the dir part', () => {
  assert.equal(fileTitle(f('a/01-x.md', '# Intro\n## s')), 'Intro');
  assert.equal(fileTitle(f('02-y.md', '# A\n# B')), '02-y');
  assert.equal(subfolderOf('a/b/c.md'), 'a/b');
  assert.equal(subfolderOf('c.md'), undefined);
});

test('folder map merges files with prefixed ids and workspace-relative sources', () => {
  const map = buildFolderMap('book', [f('01.md', '# One\n- x'), f('part/02.md', '# Two')], { groupBySubfolder: true, workspaceRoot: '/ws' });
  const [one, group] = map.nodeData.children ?? [];
  assert.equal(map.nodeData.topic, 'book');
  assert.deepEqual([one.id, one.topic], ['f01-root', 'One']);
  assert.deepEqual(one.children?.[0].metadata, { source: { line: 2, path: 'book/01.md' } });
  assert.deepEqual([group.topic, group.children?.[0].id], ['part', 'f02-root']);
  assert.equal(countNodes(map), 5);
});
```

- [ ] **Step 2: Run** `cd app && node --test --experimental-strip-types src/lib/mindmap-folder.test.ts` → FAIL.

- [ ] **Step 3: Implement** `mindmap-folder.ts` (and the `linesOutsideFences` export in `mindmap-md-scan.ts` with one test there), then the composable, dialog, App mount, action, command, i18n.

- [ ] **Step 4: Verify**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-*.test.ts && pnpm build` → pass.
Browser check: the web build may lack `list_dir`/`read_file` (Tauri-only). If the dialog cannot list files in the browser, verify the dialog renders, shows `folderNone` or the Tauri error toast cleanly (no uncaught rejection), and record the folder run as part of the desktop check. Unit tests carry the merge logic.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-folder.ts app/src/lib/mindmap-folder.test.ts app/src/lib/mindmap-md-scan.ts app/src/lib/mindmap-md-scan.test.ts app/src/composables/useMindmapFolderFiles.ts app/src/components/MindmapConvertFolder.vue app/src/App.vue app/src/lib/keybindings.ts app/src/composables/useCommands.ts app/src/i18n/en.ts
git commit -m "feat(mindmap): convert a folder of markdown files into one map"
```

---

### Task 7: Gate controller and capture-phase dispatch tests

**Files:**
- Create: `app/src/lib/mindmap-gate-controller.test.ts`
- Modify (only if a seam is needed): `app/src/lib/mindmap-gate-controller.ts`

**Interfaces:**
- Consumes: the exported API of `mindmap-gate-controller.ts` (read it first; list its exports in the test file header).

Steps:
- [ ] **Step 1:** Read `mindmap-gate-controller.ts` and the capture-phase handler added in Phase 4 Task 7 fix `59654e9` (`git show 59654e9 --stat`, then the diff). Write a minimal `MindElixirInstance` fake: plain object with `nodeData`, `getData()`, `selectNode(el)`, `findEle(id)` returning `{ nodeObj }` stubs, `bus.addListener/fire`, `container` as a real `EventTarget` — only the members the controller touches (type it as `Pick<MindElixirInstance, …>` cast once through `unknown`).
- [ ] **Step 2:** Tests (each must fail if the behavior regresses):
  1. Follow on a gate selects its target and pushes history; Back returns to the gate.
  2. Follow on a broken gate does not change selection.
  3. Capture-phase: dispatch a `keydown` `Alt+Enter` on the container; assert the controller handled it and `stopPropagation` prevented a bubble listener registered after it (the regression from `59654e9`: core Enter added a stray sibling).
  4. `before.addChild` on a gate returns `false`.
- [ ] **Step 3:** Run `cd app && node --test --experimental-strip-types src/lib/mindmap-gate-controller.test.ts`. If the controller cannot run under node (DOM globals), add the smallest seam (inject `document`/`KeyboardEvent` constructor or move pure logic out) — do not pull in jsdom. Record the seam in Status.
- [ ] **Step 4:** Confirm each test fails when its behavior is broken (temporarily revert the relevant line, run, restore).
- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-gate-controller.test.ts app/src/lib/mindmap-gate-controller.ts
git commit -m "test(mindmap): gate controller and capture-phase key dispatch"
```

---

### Task 8: Verification, docs, bump

**Files:**
- Modify: this plan (Status), `docs/superpowers/specs/2026-10-11-mindmap-design.md` (Status row 5a), `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.lock` (`solomd` entry only)

- [ ] **Step 1:** Full sweep: `cd app && node --test --experimental-strip-types src/lib/mindmap-*.test.ts src/lib/fence-scan.test.ts src/lib/fence-languages.test.ts`; record per-file counts.
- [ ] **Step 2:** `cd app && pnpm build` → OK.
- [ ] **Step 3:** Browser check of Tasks 5-6 paths once more after the final review fixes.
- [ ] **Step 4:** Desktop (Tauri) check if runnable: Phases 1-4 pending list (Phase 4 Status, Open items) plus folder conversion on a real folder with Hebrew files, an `epub: skip=true` file, and a subfolder; Jump to Source from a folder map. If not runnable, record PENDING; claim nothing.
- [ ] **Step 5:** Bump `4.14.12` → `4.14.13` in the four files; update spec Status row 5a to `✅ Done <DD-MM-YY> (4.14.13) — plan docs/superpowers/plans/2026-10-12-mindmap-phase5a-convert.md`; fill this plan's Status (tasks/commits table, tests, browser, desktop, Deviations, Open items) shaped like Phase 4's.
- [ ] **Step 6: Commit**

```bash
git add -A docs app/package.json app/src-tauri/Cargo.toml app/src-tauri/tauri.conf.json app/src-tauri/Cargo.lock
git commit -m "chore(release): mindmap phase 5a docs and bump version to 4.14.13"
```

---

## Status

COMPLETE. 12-10-26, version 4.14.13. Branch `feat/mindmap`, unpushed.

| Task | Commits | Notes |
|---|---|---|
| 1 Markdown scanner | `f1e7acc..f8b00b2` | |
| 2 Tree builder | `f8b00b2..ed86493` (fix `ed86493`) | Fix: continuation target, root frame constant |
| 3 Merge + folder grouping | `ed86493..e187ea8` | |
| 4 Source paths, jump | `e187ea8..094bd5a` (fix `094bd5a`) | Fix: root drift via `revealInTree: false`, import merge, separators |
| 5 Convert commands | `094bd5a..b43bf01` | |
| 6 Folder conversion dialog | `b43bf01..47d4931` (fix `47d4931`) | Fix: theme vars (also in duplicates dialog), stem match, try/catch, truncation note |
| 7 Gate controller, capture-phase key dispatch tests | `47d4931..cfb8af3` | Key handlers moved to `mindmap-key-dispatch.ts` |
| Final review (Opus, `a26cbb4..cfb8af3`) | fix wave `cfb8af3..5c53f07` | 12 items: stale tab content, fence plaintext topics, front matter at start only, one lift rule, byte size, inline confirm, markdown-only jump, indented fences, fence insert outside code blocks |
| 8 Verification, docs, bump | this commit | |

**Tests:** 196/196 pass (`node --test --experimental-strip-types src/lib/mindmap-*.test.ts src/lib/fence-scan.test.ts src/lib/fence-languages.test.ts src/lib/keybindings.test.ts`): mindmap-active 4, mindmap-convert 8, mindmap-direction 3, mindmap-duplicates 9, mindmap-export 9, mindmap-fence 19, mindmap-folder 5, mindmap-format 34, mindmap-gate-controller 7, mindmap-gate-plaintext 7, mindmap-gates 9, mindmap-graph 5, mindmap-headings 4, mindmap-keymap 5, mindmap-md-scan 13, mindmap-merge 4, mindmap-source 8, fence-scan 12, fence-languages 19, keybindings 12. `pnpm build` OK (chunk-size warning only).

**Browser check (web, controller-run per task):** Mod+Alt+Shift+M on a Hebrew doc creates `convert-test.mmap` (sole-H1 lift, fenced `# no` absent, notes and continuations on the right nodes, checkbox prefix, source lines correct); section fence inserted after its section; selection becomes root `Selection lines 22-23`; `.mmap` tab guard toast; pathless Jump to Source toast. Folder dialog opens from the palette, readable in dark theme after the fix, Choose... fails with a clean toast (no Tauri), Escape closes. Gate follow (Alt+Enter) selects the target, Alt+Left returns, node count unchanged. After the fix wave: typing then an immediate convert includes the typed text; `> quote`, `[^1]`, `=> done` topics are clean. Re-run of the Tasks 5-6 paths after the final fixes covered by the fix-wave check above.

**Desktop (Tauri) check:** PENDING. Not runnable in this session; nothing below claims it passed. It must cover:

- Phases 1-4 pending items (Phase 4 Open items): export PNG, SVG, HTML, JSON, Markdown, Mermaid and adjacency through the native save dialog; open each file (Hebrew labels in PNG/SVG, HTML read-only, JSON parses); copy as plaintext into a note.
- Jump to Source from a converted saved document (workspace open) and from a folder map (path-based jump).
- Folder conversion of a real folder with Hebrew files, an `<!-- epub: skip=true -->` file, a subfolder (Group by subfolder) and a file over 2 MiB.
- Large-map inline confirm.

### Deviations

- Ruling: Task 2 TreeBuilder uses an explicit field, not a constructor parameter property (`--experimental-strip-types` rejects them).
- Ruling: Task 1 minors (attribute-only heading, attribute block before closing hashes, literal constants) folded into Task 2.
- Ruling: Task 2 continuation: indented text goes to the deepest open item with smaller indent; unindented lazy continuation goes to the last item.
- Ruling: Task 4 browser check folded into Task 5 (stamped sources only exist once converters run).
- Ruling: Task 4 root drift handled with `openPath(..., { revealInTree: false })` from `jumpTo`; source paths not redesigned.
- Ruling: Task 5 keybindings invariant changed from "no global id starts with `mindmap.`" to "no category `mindmap` action is global" (spec mandates global `mindmap.convert*`).
- Ruling: `cmd.mindmap` optional in the I18n type (14 locales fall back to en).
- Ruling: plain Windows editor supports document scope only (`getLineSelection` returns null).
- Deviation: fence output drops notes (plaintext has no note syntax); `.mmap` output keeps them.
- Ruling: Task 6 fix also corrected undefined `--bg-primary` in `MindmapDuplicates.vue`.
- Ruling: Task 7 seam: key handlers moved verbatim to `lib/mindmap-key-dispatch.ts` so node can test them.
- Ruling: final review ran before Task 8, scope `a26cbb4..HEAD`; fix wave took 12 items; `d32a3f8` alone is not green (imports `safeInsertLine` from `f1e2c00`), branch head is.

### Open items

- Desktop (Tauri) check PENDING (list above).
- Notes are stored but not shown in the canvas (Mind Elixir core has no note UI): 5b or follow-up.
- Fence output drops notes.
- Root drift: source paths are relative to the workspace root at conversion time; a map converted after the root drifted keeps the drifted-root paths.
- Plain Windows editor converts the whole document only.
- Pre-existing, out of scope: Cmd+Shift+K also runs CodeMirror `deleteLine`; separate task suggested.
- Parked: folder dialog `pendingLargeCount` not reset on folder change (stale "Convert anyway" skips re-confirm); `convertDone` toast says "Mind map inserted" for `.mmap` output; an indented code block with a bare fence and no closer hides the rest of the file (intended trade-off); `fileTitle` converts each file twice; front matter edge at selection line 1; `fenceRanges` ignore front matter.
- Deferred minors:
  - Scanner (T1): fences under list items indented 4+ (partly addressed by any-indent fences); backtick in a backtick info string accepted; lone `-`/`*`/`#` line becomes text; `__init__` becomes `init` in `plainInline`; test gaps (CRLF, `...` closer, unterminated front matter, single-line comment, `~~~` vs backticks, table in quote, `1)`, nested quotes).
  - Tree builder (T2): `sectionRange` lastLine counts the trailing empty line at EOF; `addText` calls `headingTop()` twice, `canContinue` partly redundant; no test for heading-stack popping beyond one level.
  - Merge (T3): grouping tests miss group/ungrouped/same-group and adjacent different groups; redundant `openGroup?.children` narrowing.
  - Source/jump (T4): double toast when `openPath` fails then tab mismatch; strict path compare false negatives (case-insensitive FS, symlinks); symlink escape not caught lexically; `ensureRef` mutates `refId` on the clone before the `REF_PATTERN` check.
  - Commands (T5): `getLineSelection` sits under `getViewLine`'s doc comment (`Editor.vue`); `resolveRange` guards untested; `insertBlockAfterLine` LF-only on CRLF docs; `MINDMAP_CONVERT_ACTIONS` ids typed `string`.
  - Folder dialog (T6): Escape not stopped and no focus trap; sequential reads without progress; `load()` catch does not reset `isTruncated`; "500" hardcoded in `en.ts` vs `MAX_FILES`.
  - Key dispatch (T7): `buildHarness` ~24 lines; test 3 not mutation-checked; no tests for chord follow-up or ignored-target path.
