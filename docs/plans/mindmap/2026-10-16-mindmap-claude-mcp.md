# Mindmap ↔ Claude Code (MCP + Skill) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Claude Code read and edit `.mmap` mind maps through semantic tools (nodes, gates, sessions, meanings), never raw JSON, and bind a Claude session to a node in both directions.

**Architecture:** New pure TS modules in `app/src/lib/` (edit, address, legend) beside the existing mindmap logic. A new stdio MCP server `mcp-mindmap/` (TS SDK v2) imports `app/src/lib/*.ts` directly through Node type stripping and works on files. The SoloMD watcher already reloads an open clean `.mmap` tab. A Claude Code plugin `plugin/` bundles the server, a `SessionStart` hook that tells Claude its session id, and a `mindmap` skill.

**Tech Stack:** Node ≥ 22.18 (native type stripping), `@modelcontextprotocol/server` ^2.3.1, `zod` ^4.2.0, `node:test`, mind-elixir 5.15.1 types.

**Spec:** the Design section below (agreed in session 16-10-26).

## Global Constraints

- No raw JSON in or out: tools take node refs (id or `Root/A/B` path) and return outline text plus small summaries.
- No style tools. Style changes only through the map legend (`mmap_mark`).
- Writes only when the server runs with `--allow-write`. Every path must resolve inside `--workspace` and end in `.mmap`.
- Every write goes parse → pure op → `serializeMindmap` → atomic rename. No hand-built JSON.
- Out of scope (v2): Claude-side pane mod, image export, snippets, themes/display, collapse state, xmind import, multi-map merge.
- Code style: functions 10–20 lines, no comments, no magic numbers, explicit types, early returns.
- Unit tests: `cd app && node --test --experimental-strip-types src/lib/<file>.test.ts`; server tests: `cd mcp-mindmap && node --test --experimental-strip-types test/*.test.ts`.

---

## Design

### Tool surface (15)

| Group | Tool | Reuses |
| --- | --- | --- |
| Read | `mmap_outline(file, node?, depth?)` | `mindmap-address.outlineOf` (new) |
| Read | `mmap_find(file, query, by?)` | `walkNodes`, `normalizeTopic`, `readFields` |
| Read | `mmap_node(file, node)` | `mindmap-address.describeNode` (new) |
| Read | `mmap_duplicates(file)` | `findDuplicateGroups` |
| Write | `mmap_add(file, parent, outline, index?)` | `parsePaste` + `mindmap-edit.insertNodes` (new) |
| Write | `mmap_edit(file, node, {topic?, note?, fields?, tags?})` | `mindmap-edit.updateNode` (new) |
| Write | `mmap_move(file, node, parent, index?)` | `mindmap-edit.moveNode` (new) |
| Write | `mmap_remove(file, node)` | `mindmap-edit.removeNode` (new) |
| Write | `mmap_gate(file, action, …)` link/unlink/merge | `makeGateNode`, `mergeIntoGate` |
| Meaning | `mmap_legend(file, set?)` | `mindmap-legend` (new) |
| Meaning | `mmap_mark(file, node, meaning \| null)` | `mindmap-legend.markNode` (new) |
| Session | `mmap_bind_session(file, node, session)` | `CLAUDE_SESSION_KEY`, `fieldsPatch` |
| Session | `mmap_session_nodes(session, file?)` | workspace walk + `readFields` |
| File | `mmap_create(file, from, source)` | `createEmptyMindmap`, `markdownToMindmap`, `parsePaste` |
| File | `mmap_export(file, format)` | `buildTextExport`, `mapToHeadingsMarkdown`, `outlineOf` |
| App | `mmap_reveal(file, node?)` | `open -a SoloMD`, plus Task 9's deep link |

### Key decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Where the legend lives | `nodeData.metadata.legend` | `sanitizeMetadata` keeps unknown keys, so SoloMD round-trips it with no format change |
| What a mark stores | `metadata.mark = meaning` plus the legend's `style` | Reads report the meaning. SoloMD shows the colour |
| Session id source | Plugin `SessionStart` hook prints `additionalContext: claude-session-id: <uuid>` | MCP servers don't receive the session id. No shared file, so concurrent sessions don't collide |
| Node → Claude | Existing details-pane `claudeResume` action | Already shipped |
| Claude → app | `mmap_reveal` opens the file now. Focusing the node needs Task 9 (deep link) | Task 9 is app-side Rust and can slip |
| Node ids | `crypto.randomUUID()` hex, 16 chars | Same scheme as `mindmap-gate-controller.ts:29` |

### Outline format returned by reads

```text
- Root [^root]
  - Phase 2 [^a1b2] {mark: blocked} {session}
    - ⇒ API design [^g7] → [^c3d4]
    - Tasks (+12)
```

`(+N)` = children cut by `depth`. `{session}` = bound Claude session. Tags show as `#tag`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `app/src/lib/mindmap-edit.ts` (+test) | Pure structural ops: insert, update, move, remove, fresh ids |
| `app/src/lib/mindmap-address.ts` (+test) | Resolve id/path refs, outline text, node summary |
| `app/src/lib/mindmap-legend.ts` (+test) | Legend read/write, mark/unmark |
| `mcp-mindmap/package.json`, `tsconfig.json` | Server package |
| `mcp-mindmap/src/config.ts` | CLI flags → `ServerConfig` |
| `mcp-mindmap/src/store.ts` | Path guard, load/save `.mmap`, write gate |
| `mcp-mindmap/src/tools/read.ts` | outline, find, node, duplicates handlers |
| `mcp-mindmap/src/tools/write.ts` | add, edit, move, remove, gate handlers |
| `mcp-mindmap/src/tools/meaning.ts` | legend, mark handlers |
| `mcp-mindmap/src/tools/session.ts` | bind_session, session_nodes handlers |
| `mcp-mindmap/src/tools/file.ts` | create, export, reveal handlers |
| `mcp-mindmap/src/server.ts` | `registerTool` wiring (schemas, annotations) |
| `mcp-mindmap/src/index.ts` | `serveStdio` entry |
| `mcp-mindmap/test/*.test.ts` | Handler tests on temp-dir fixtures |
| `plugin/.claude-plugin/plugin.json`, `plugin/.mcp.json` | Plugin manifest + server config |
| `plugin/hooks/hooks.json`, `plugin/hooks/session-id.mjs` | SessionStart session-id hook |
| `plugin/skills/mindmap/SKILL.md` | When and how to use the tools |

---

### Task 1: Pure structural edits (`mindmap-edit.ts`)

**Files:**
- Create: `app/src/lib/mindmap-edit.ts`
- Test: `app/src/lib/mindmap-edit.test.ts`

**Interfaces:**
- Consumes: `findNode`, `walkNodes`, `canHoldChildren`, `ancestorIds` (`mindmap-gates.ts`); `buildIdMap`, `remapGates` (`mindmap-paste-remap.ts`, `remapGates` mutates in place).
- Produces:
  - `type EditResult = { ok: true; data: MindElixirData; ids: string[] } | { ok: false; error: string }`
  - `newNodeId(): string`
  - `insertNodes(data, parentId: string, nodes: readonly NodeObj[], index?: number): EditResult` (ids = new top-level ids)
  - `updateNode(data, id: string, patch: Partial<Pick<NodeObj, 'topic' | 'note' | 'tags' | 'metadata' | 'style'>>): EditResult`
  - `moveNode(data, id: string, parentId: string, index?: number): EditResult`
  - `removeNode(data, id: string): EditResult & { brokenGates?: number }`, where `ok` carries `brokenGates: number`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { findNode, readGate } from './mindmap-gates.ts';
import { insertNodes, moveNode, newNodeId, removeNode, updateNode } from './mindmap-edit.ts';

const map = (): MindElixirData => ({
  nodeData: { id: 'r', topic: 'Root', children: [
    { id: 'a', topic: 'A', children: [{ id: 'a1', topic: 'A1' }] },
    { id: 'b', topic: 'B' },
    { id: 'g', topic: '⇒ A1', metadata: { gate: { target: 'a1' } } },
  ] },
});

test('newNodeId is 16 hex chars and unique', () => {
  const id = newNodeId();
  assert.match(id, /^[0-9a-f]{16}$/);
  assert.notEqual(id, newNodeId());
});

test('insertNodes gives fresh ids and remaps internal gates', () => {
  const pasted = [{ id: 'p1', topic: 'X', children: [{ id: 'p2', topic: 'Y' }, { id: 'p3', topic: '⇒ Y', metadata: { gate: { target: 'p2' } } }] }];
  const res = insertNodes(map(), 'b', pasted);
  assert.ok(res.ok);
  const x = findNode(res.data.nodeData, res.ids[0])!;
  assert.equal(x.topic, 'X');
  assert.equal(readGate(x.children![1])!.target, x.children![0].id);
  assert.equal(findNode(res.data.nodeData, 'p1'), null);
});

test('insertNodes respects index and refuses gate parents', () => {
  const res = insertNodes(map(), 'r', [{ id: 'p', topic: 'First' }], 0);
  assert.ok(res.ok);
  assert.equal(res.data.nodeData.children![0].topic, 'First');
  assert.equal(insertNodes(map(), 'g', [{ id: 'p', topic: 'Z' }]).ok, false);
  assert.equal(insertNodes(map(), 'nope', [{ id: 'p', topic: 'Z' }]).ok, false);
});

test('updateNode patches and does not mutate input', () => {
  const input = map();
  const res = updateNode(input, 'b', { topic: 'B2', note: 'n' });
  assert.ok(res.ok);
  assert.equal(findNode(res.data.nodeData, 'b')!.topic, 'B2');
  assert.equal(findNode(input.nodeData, 'b')!.topic, 'B');
});

test('moveNode reparents and blocks cycles and root', () => {
  const res = moveNode(map(), 'a', 'b');
  assert.ok(res.ok);
  assert.equal(findNode(res.data.nodeData, 'b')!.children![0].id, 'a');
  assert.equal(moveNode(map(), 'a', 'a1').ok, false);
  assert.equal(moveNode(map(), 'r', 'b').ok, false);
});

test('removeNode drops subtree and counts gates left broken', () => {
  const res = removeNode(map(), 'a');
  assert.ok(res.ok);
  assert.equal(findNode(res.data.nodeData, 'a1'), null);
  assert.equal(res.ok && res.brokenGates, 1);
  assert.equal(removeNode(map(), 'r').ok, false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-edit.test.ts`
Expected: FAIL, `Cannot find module './mindmap-edit.ts'`.

- [ ] **Step 3: Implement**

```ts
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { ancestorIds, canHoldChildren, findNode, readGate, walkNodes } from './mindmap-gates.ts';
import { buildIdMap, remapGates } from './mindmap-paste-remap.ts';

const ID_LENGTH = 16;

export type EditResult = { ok: true; data: MindElixirData; ids: string[] } | { ok: false; error: string };
export type RemoveResult = { ok: true; data: MindElixirData; ids: string[]; brokenGates: number } | { ok: false; error: string };
type NodePatch = Partial<Pick<NodeObj, 'topic' | 'note' | 'tags' | 'metadata' | 'style'>>;

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function newNodeId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, ID_LENGTH);
}

function freshCopy(node: NodeObj): NodeObj {
  const { children, ...rest } = structuredClone(node);
  const copy: NodeObj = { ...rest, id: newNodeId() };
  if (children) copy.children = children.map(freshCopy);
  return copy;
}

function parentOf(root: NodeObj, id: string): NodeObj | null {
  return walkNodes(root).find((n) => (n.children ?? []).some((c) => c.id === id)) ?? null;
}

function placeAt(parent: NodeObj, nodes: NodeObj[], index?: number): void {
  const kids = parent.children ?? [];
  const at = index === undefined ? kids.length : Math.max(0, Math.min(index, kids.length));
  parent.children = [...kids.slice(0, at), ...nodes, ...kids.slice(at)];
}

export function insertNodes(data: MindElixirData, parentId: string, nodes: readonly NodeObj[], index?: number): EditResult {
  const copy = structuredClone(data);
  const parent = findNode(copy.nodeData, parentId);
  if (!parent) return fail(`No node with id "${parentId}"`);
  if (!canHoldChildren(parent)) return fail(`"${parent.topic}" is a gate and cannot hold children`);
  const fresh = nodes.map(freshCopy);
  remapGates(fresh, buildIdMap(nodes, fresh));
  placeAt(parent, fresh, index);
  return { ok: true, data: copy, ids: fresh.map((n) => n.id) };
}

export function updateNode(data: MindElixirData, id: string, patch: NodePatch): EditResult {
  const copy = structuredClone(data);
  const node = findNode(copy.nodeData, id);
  if (!node) return fail(`No node with id "${id}"`);
  Object.assign(node, patch);
  for (const key of Object.keys(patch) as (keyof NodePatch)[]) if (patch[key] === undefined) delete node[key];
  return { ok: true, data: copy, ids: [id] };
}

export function moveNode(data: MindElixirData, id: string, parentId: string, index?: number): EditResult {
  if (id === data.nodeData.id) return fail('The root cannot move');
  if ((ancestorIds(data.nodeData, parentId) ?? []).includes(id) || parentId === id) return fail('Cannot move a node under itself');
  const copy = structuredClone(data);
  const from = parentOf(copy.nodeData, id);
  const to = findNode(copy.nodeData, parentId);
  if (!from || !to) return fail(`No node with id "${from ? parentId : id}"`);
  if (!canHoldChildren(to)) return fail(`"${to.topic}" is a gate and cannot hold children`);
  const node = from.children!.find((c) => c.id === id)!;
  from.children = from.children!.filter((c) => c.id !== id);
  placeAt(to, [node], index);
  return { ok: true, data: copy, ids: [id] };
}

export function removeNode(data: MindElixirData, id: string): RemoveResult {
  if (id === data.nodeData.id) return fail('The root cannot be removed');
  const copy = structuredClone(data);
  const parent = parentOf(copy.nodeData, id);
  if (!parent) return fail(`No node with id "${id}"`);
  const gone = new Set(walkNodes(findNode(copy.nodeData, id)!).map((n) => n.id));
  parent.children = parent.children!.filter((c) => c.id !== id);
  const brokenGates = walkNodes(copy.nodeData).filter((n) => gone.has(readGate(n)?.target ?? '')).length;
  return { ok: true, data: copy, ids: [id], brokenGates };
}
```

`ancestorIds(root, id)` returns root..parent, excluding `id` (`mindmap-gates.ts:70`), so `moveNode(map(), 'a', 'a1')` is blocked because `'a'` is among `a1`'s ancestors.

- [ ] **Step 4: Run tests**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-edit.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-edit.ts app/src/lib/mindmap-edit.test.ts
git commit -m "feat(mindmap): pure insert/update/move/remove edits"
```

---

### Task 2: Node addressing and outline text (`mindmap-address.ts`)

**Files:**
- Create: `app/src/lib/mindmap-address.ts`
- Test: `app/src/lib/mindmap-address.test.ts`

**Interfaces:**
- Consumes: `findNode`, `walkNodes`, `readGate` (`mindmap-gates.ts`); `pathTo` (`mindmap-focus.ts`, returns root..node or null); `normalizeTopic` (`mindmap-duplicates.ts`); `readFields`, `CLAUDE_SESSION_KEY` (`mindmap-node-fields.ts`).
- Produces:
  - `type Resolve = { ok: true; node: NodeObj } | { ok: false; error: string }`
  - `resolveNode(root: NodeObj, ref: string): Resolve` (id first, then `/`-separated topic path from the root, case-insensitive via `normalizeTopic`)
  - `pathOf(root: NodeObj, id: string): string` → `"Root/A/A1"`
  - `boundSession(node: NodeObj): string | null`
  - `readMark(node: NodeObj): string | null` (`metadata.mark`)
  - `outlineOf(root: NodeObj, fromId?: string, depth?: number): string`
  - `interface NodeSummary { id; topic; path; note?; tags: string[]; fields: {key; value}[]; mark?; session?; gateTarget?; gatesIn: string[]; childCount: number }`
  - `describeNode(root: NodeObj, id: string): NodeSummary | null`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { boundSession, describeNode, outlineOf, pathOf, resolveNode } from './mindmap-address.ts';

const SID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const root = (): NodeObj => ({ id: 'r', topic: 'Root', children: [
  { id: 'a', topic: 'Phase 2', tags: ['api'], metadata: { mark: 'blocked', fields: [{ key: 'claude-session', value: SID }] }, children: [
    { id: 'a1', topic: 'Design' }, { id: 'a2', topic: 'Tasks', children: [{ id: 't1', topic: 'T1' }] },
  ] },
  { id: 'g', topic: '⇒ Design', metadata: { gate: { target: 'a1' } } },
] });

test('resolveNode by id, by path, and reports misses', () => {
  assert.equal(resolveNode(root(), 'a1').ok && 'found', 'found');
  const byPath = resolveNode(root(), 'root/phase 2/design');
  assert.ok(byPath.ok && byPath.node.id === 'a1');
  const miss = resolveNode(root(), 'Root/Nope');
  assert.ok(!miss.ok && miss.error.includes('Nope'));
});

test('pathOf and boundSession', () => {
  assert.equal(pathOf(root(), 't1'), 'Root/Phase 2/Tasks/T1');
  assert.equal(boundSession(root().children![0]), SID);
  assert.equal(boundSession(root()), null);
});

test('outlineOf shows ids, marks, sessions, tags, gates and cut counts', () => {
  const text = outlineOf(root(), undefined, 2);
  assert.equal(text, [
    '- Root [^r]',
    '  - Phase 2 [^a] #api {mark: blocked} {session}',
    '    - Design [^a1]',
    '    - Tasks [^a2] (+1)',
    '  - ⇒ Design [^g] → [^a1]',
  ].join('\n'));
});

test('describeNode lists gates pointing in', () => {
  const s = describeNode(root(), 'a1')!;
  assert.deepEqual(s.gatesIn, ['g']);
  assert.equal(s.path, 'Root/Phase 2/Design');
  assert.equal(describeNode(root(), 'zz'), null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-address.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
import type { NodeObj } from 'mind-elixir';
import { findNode, readGate, walkNodes } from './mindmap-gates.ts';
import { pathTo } from './mindmap-focus.ts';
import { normalizeTopic } from './mindmap-duplicates.ts';
import { CLAUDE_SESSION_KEY, isClaudeSessionId, readFields, type NodeFieldEntry } from './mindmap-node-fields.ts';

const PATH_SEPARATOR = '/';
const INDENT = '  ';
const DEFAULT_DEPTH = Number.POSITIVE_INFINITY;

export type Resolve = { ok: true; node: NodeObj } | { ok: false; error: string };

export interface NodeSummary {
  id: string; topic: string; path: string; note?: string; tags: string[]; fields: NodeFieldEntry[];
  mark?: string; session?: string; gateTarget?: string; gatesIn: string[]; childCount: number;
}

function childByTopic(node: NodeObj, topic: string): NodeObj | undefined {
  return (node.children ?? []).find((c) => normalizeTopic(c.topic) === normalizeTopic(topic));
}

function resolvePath(root: NodeObj, ref: string): Resolve {
  const [first, ...rest] = ref.split(PATH_SEPARATOR).map((s) => s.trim());
  if (normalizeTopic(first) !== normalizeTopic(root.topic)) return { ok: false, error: `Path must start at the root "${root.topic}"` };
  let node = root;
  for (const part of rest) {
    const next = childByTopic(node, part);
    if (!next) return { ok: false, error: `"${node.topic}" has no child "${part}"` };
    node = next;
  }
  return { ok: true, node };
}

export function resolveNode(root: NodeObj, ref: string): Resolve {
  const byId = findNode(root, ref);
  if (byId) return { ok: true, node: byId };
  return ref.includes(PATH_SEPARATOR) || normalizeTopic(ref) === normalizeTopic(root.topic)
    ? resolvePath(root, ref)
    : { ok: false, error: `No node with id "${ref}". Use an id from mmap_outline or a path like "${root.topic}/Child"` };
}

export function pathOf(root: NodeObj, id: string): string {
  return (pathTo(root, id) ?? []).map((n) => n.topic).join(PATH_SEPARATOR);
}

export function boundSession(node: NodeObj): string | null {
  const entry = readFields(node).find((f) => f.key === CLAUDE_SESSION_KEY && isClaudeSessionId(f.value));
  return entry ? entry.value.trim() : null;
}

export function readMark(node: NodeObj): string | null {
  const mark = (node.metadata as Record<string, unknown> | undefined)?.mark;
  return typeof mark === 'string' && mark !== '' ? mark : null;
}

function lineOf(node: NodeObj): string {
  const tags = (node.tags ?? []).map((t) => ` #${typeof t === 'string' ? t : t.text}`).join('');
  const mark = readMark(node);
  const gate = readGate(node);
  return `- ${node.topic} [^${node.id}]${tags}${mark ? ` {mark: ${mark}}` : ''}${boundSession(node) ? ' {session}' : ''}${gate ? ` → [^${gate.target}]` : ''}`;
}

function outlineLines(node: NodeObj, level: number, depth: number): string[] {
  const kids = node.children ?? [];
  const cut = level >= depth && kids.length > 0 ? ` (+${kids.length})` : '';
  const self = `${INDENT.repeat(level)}${lineOf(node)}${cut}`;
  return cut ? [self] : [self, ...kids.flatMap((k) => outlineLines(k, level + 1, depth))];
}

export function outlineOf(root: NodeObj, fromId?: string, depth: number = DEFAULT_DEPTH): string {
  const start = fromId ? findNode(root, fromId) : root;
  return start ? outlineLines(start, 0, depth).join('\n') : '';
}

export function describeNode(root: NodeObj, id: string): NodeSummary | null {
  const node = findNode(root, id);
  if (!node) return null;
  const summary: NodeSummary = {
    id, topic: node.topic, path: pathOf(root, id), tags: (node.tags ?? []).map((t) => (typeof t === 'string' ? t : t.text)),
    fields: readFields(node), gatesIn: walkNodes(root).filter((n) => readGate(n)?.target === id).map((n) => n.id),
    childCount: (node.children ?? []).length,
  };
  if (node.note) summary.note = node.note;
  const mark = readMark(node); if (mark) summary.mark = mark;
  const session = boundSession(node); if (session) summary.session = session;
  const gate = readGate(node); if (gate) summary.gateTarget = gate.target;
  return summary;
}
```

If `NodeObj['tags']` is `string[]` only in mind-elixir 5.15.1, drop the `typeof t === 'string'` branches (`tsc` flags them as unnecessary only under lint; fine to keep).

- [ ] **Step 4: Run tests**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-address.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-address.ts app/src/lib/mindmap-address.test.ts
git commit -m "feat(mindmap): id/path node refs and outline text for agents"
```

---

### Task 3: Legend and marks (`mindmap-legend.ts`)

**Files:**
- Create: `app/src/lib/mindmap-legend.ts`
- Test: `app/src/lib/mindmap-legend.test.ts`

**Interfaces:**
- Consumes: `updateNode`, `EditResult` (Task 1); `findNode` (`mindmap-gates.ts`); `isSafeColor` (`mindmap-display.ts`).
- Produces:
  - `interface LegendEntry { meaning: string; color?: string; background?: string }`
  - `readLegend(root: NodeObj): LegendEntry[]`
  - `withLegend(data: MindElixirData, entries: readonly LegendEntry[]): MindElixirData` (drops unsafe colours and duplicate meanings)
  - `markNode(data: MindElixirData, id: string, meaning: string | null): EditResult` (null clears the mark and its legend style)

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { findNode } from './mindmap-gates.ts';
import { markNode, readLegend, withLegend } from './mindmap-legend.ts';

const map = (): MindElixirData => ({ nodeData: { id: 'r', topic: 'Root', children: [{ id: 'a', topic: 'A' }] } });

test('withLegend stores safe entries on the root and readLegend reads them', () => {
  const data = withLegend(map(), [{ meaning: 'blocked', background: '#fde2e2', color: '#b91c1c' }, { meaning: 'bad', color: 'url(x)' }, { meaning: 'blocked' }]);
  assert.deepEqual(readLegend(data.nodeData), [{ meaning: 'blocked', background: '#fde2e2', color: '#b91c1c' }, { meaning: 'bad' }]);
});

test('markNode applies legend style and records the meaning', () => {
  const data = withLegend(map(), [{ meaning: 'done', background: '#dcfce7' }]);
  const res = markNode(data, 'a', 'done');
  assert.ok(res.ok);
  const a = findNode(res.data.nodeData, 'a')!;
  assert.equal((a.metadata as { mark: string }).mark, 'done');
  assert.equal(a.style?.background, '#dcfce7');
});

test('markNode refuses unknown meanings and clears with null', () => {
  const data = withLegend(map(), [{ meaning: 'done', background: '#dcfce7' }]);
  const miss = markNode(data, 'a', 'later');
  assert.ok(!miss.ok && miss.error.includes('done'));
  const marked = markNode(data, 'a', 'done');
  assert.ok(marked.ok);
  const cleared = markNode(marked.data, 'a', null);
  assert.ok(cleared.ok);
  const a = findNode(cleared.data.nodeData, 'a')!;
  assert.equal(a.style, undefined);
  assert.equal(a.metadata, undefined);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-legend.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { findNode } from './mindmap-gates.ts';
import { isSafeColor } from './mindmap-display.ts';
import { updateNode, type EditResult } from './mindmap-edit.ts';

const MEANING_MAX = 40;

export interface LegendEntry { meaning: string; color?: string; background?: string }
type Meta = Record<string, unknown>;

const metaOf = (node: NodeObj): Meta => (node.metadata && typeof node.metadata === 'object' ? { ...(node.metadata as Meta) } : {});

function cleanEntry(value: unknown): LegendEntry | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.meaning !== 'string' || raw.meaning.trim() === '') return null;
  const entry: LegendEntry = { meaning: raw.meaning.trim().slice(0, MEANING_MAX) };
  if (isSafeColor(raw.color)) entry.color = raw.color;
  if (isSafeColor(raw.background)) entry.background = raw.background;
  return entry;
}

function cleanLegend(values: readonly unknown[]): LegendEntry[] {
  const seen = new Set<string>();
  return values.map(cleanEntry).filter((e): e is LegendEntry => e !== null && !seen.has(e.meaning) && !!seen.add(e.meaning));
}

export function readLegend(root: NodeObj): LegendEntry[] {
  const legend = metaOf(root).legend;
  return Array.isArray(legend) ? cleanLegend(legend) : [];
}

export function withLegend(data: MindElixirData, entries: readonly LegendEntry[]): MindElixirData {
  const copy = structuredClone(data);
  copy.nodeData.metadata = { ...metaOf(copy.nodeData), legend: cleanLegend(entries) };
  return copy;
}

function styleFor(entry: LegendEntry): NodeObj['style'] {
  return { ...(entry.color ? { color: entry.color } : {}), ...(entry.background ? { background: entry.background } : {}) };
}

function emptyToUndefined<T extends object>(value: T): T | undefined {
  return Object.keys(value).length > 0 ? value : undefined;
}

export function markNode(data: MindElixirData, id: string, meaning: string | null): EditResult {
  const node = findNode(data.nodeData, id);
  if (!node) return { ok: false, error: `No node with id "${id}"` };
  const { mark: _old, ...meta } = metaOf(node);
  if (meaning === null) return updateNode(data, id, { metadata: emptyToUndefined(meta), style: undefined });
  const legend = readLegend(data.nodeData);
  const entry = legend.find((e) => e.meaning === meaning);
  if (!entry) return { ok: false, error: `Unknown meaning "${meaning}". Legend has: ${legend.map((e) => e.meaning).join(', ') || '(empty, set one with mmap_legend)'}` };
  return updateNode(data, id, { metadata: { ...meta, mark: meaning }, style: emptyToUndefined(styleFor(entry) ?? {}) });
}
```

- [ ] **Step 4: Run tests and confirm SoloMD keeps the legend**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-legend.test.ts`
Expected: PASS, 3/3.

Add this round-trip test to the same file, then re-run:

```ts
import { parseMindmap, serializeMindmap } from './mindmap-format.ts';
test('legend and marks survive the SoloMD codec round-trip', () => {
  const res = markNode(withLegend(map(), [{ meaning: 'done', background: '#dcfce7' }]), 'a', 'done');
  assert.ok(res.ok);
  const back = parseMindmap(serializeMindmap(res.data), 'x');
  assert.ok(back.ok);
  assert.equal(readLegend(back.data.nodeData)[0].meaning, 'done');
  assert.equal((findNode(back.data.nodeData, 'a')!.metadata as { mark: string }).mark, 'done');
});
```

Expected: PASS, 4/4. If it fails, `sanitizeMetadata` strips the key. Stop and report, since the legend location decision then needs revisiting.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-legend.ts app/src/lib/mindmap-legend.test.ts
git commit -m "feat(mindmap): map legend and meaning marks"
```

---

### Task 4: MCP server scaffold, store, read tools

**Files:**
- Create: `mcp-mindmap/package.json`, `mcp-mindmap/tsconfig.json`, `mcp-mindmap/src/config.ts`, `mcp-mindmap/src/store.ts`, `mcp-mindmap/src/tools/read.ts`, `mcp-mindmap/src/server.ts`, `mcp-mindmap/src/index.ts`
- Test: `mcp-mindmap/test/fixtures.ts`, `mcp-mindmap/test/read.test.ts`, `mcp-mindmap/test/store.test.ts`
- Modify: `.gitignore` (add `mcp-mindmap/node_modules/`)

**Interfaces:**
- Consumes: `parseMindmap`, `serializeMindmap`, `rootTopicFromFileName` (`mindmap-format.ts`); Task 2 exports; `findDuplicateGroups`, `normalizeTopic` (`mindmap-duplicates.ts`); `readFields`.
- Produces:
  - `interface ServerConfig { workspace: string; allowWrite: boolean }`, `parseArgs(argv: string[]): ServerConfig`
  - `interface MapDoc { data: MindElixirData; display: MapDisplay; snippets: Snippet[] }`
  - `class MapStore { constructor(cfg: ServerConfig); resolve(file: string): string; load(file: string): Promise<MapDoc>; save(file: string, doc: MapDoc): Promise<void>; assertWritable(): void; list(): Promise<string[]> }`
  - `requireNode(doc: MapDoc, ref: string): NodeObj` (throws the `resolveNode` error)
  - Read handlers: `outline(store, {file, node?, depth?}) → string`, `find(store, {file, query, by?}) → string`, `node(store, {file, node}) → NodeSummary`, `duplicates(store, {file}) → string`
  - `createServer(cfg: ServerConfig): McpServer`

- [ ] **Step 1: Package files**

`mcp-mindmap/package.json`:

```json
{
  "name": "solomd-mcp-mindmap",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "solomd-mcp-mindmap": "src/index.ts" },
  "engines": { "node": ">=22.18" },
  "scripts": {
    "start": "node src/index.ts",
    "test": "node --test --experimental-strip-types test/*.test.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^2.3.1",
    "zod": "^4.2.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.6.0"
  }
}
```

`mcp-mindmap/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM"],
    "types": ["node"],
    "baseUrl": ".",
    "paths": { "mind-elixir": ["../app/node_modules/mind-elixir"] }
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

Run: `pnpm --dir app install && pnpm --dir mcp-mindmap install`
Expected: both install. `app/node_modules` must exist because `app/src/lib` resolves `@mind-elixir/export-mindmap` from there at runtime.

- [ ] **Step 2: Write failing tests**

`mcp-mindmap/test/fixtures.ts`:

```ts
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serializeMindmap } from '../../app/src/lib/mindmap-format.ts';
import { MapStore } from '../src/store.ts';

export const SID = '0f8fad5b-d9cb-469f-a165-70867728950e';

export const sampleData = () => ({ nodeData: { id: 'r', topic: 'Plan', children: [
  { id: 'a', topic: 'Phase 2', metadata: { fields: [{ key: 'claude-session', value: SID }] }, children: [{ id: 'a1', topic: 'Design' }, { id: 'a2', topic: 'Tasks' }] },
  { id: 'b', topic: 'Design' },
] } });

export async function workspace(allowWrite = true): Promise<{ dir: string; store: MapStore }> {
  const dir = await mkdtemp(join(tmpdir(), 'mmap-'));
  await writeFile(join(dir, 'plan.mmap'), serializeMindmap(sampleData()));
  return { dir, store: new MapStore({ workspace: dir, allowWrite }) };
}
```

`mcp-mindmap/test/store.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { workspace } from './fixtures.ts';
import { parseArgs } from '../src/config.ts';

test('parseArgs reads workspace and allow-write', () => {
  assert.deepEqual(parseArgs(['--workspace', '/w', '--allow-write']), { workspace: '/w', allowWrite: true });
  assert.throws(() => parseArgs([]), /--workspace/);
});

test('resolve refuses escapes and non-mmap files', async () => {
  const { store } = await workspace();
  assert.throws(() => store.resolve('../x.mmap'), /inside the workspace/);
  assert.throws(() => store.resolve('notes.md'), /\.mmap/);
});

test('load/save round-trips and save needs allow-write', async () => {
  const { dir, store } = await workspace();
  const doc = await store.load('plan.mmap');
  doc.data.nodeData.topic = 'Plan 2';
  await store.save('plan.mmap', doc);
  assert.match(await readFile(join(dir, 'plan.mmap'), 'utf8'), /"Plan 2"/);
  const ro = (await workspace(false)).store;
  assert.throws(() => ro.assertWritable(), /--allow-write/);
});
```

`mcp-mindmap/test/read.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspace } from './fixtures.ts';
import { duplicates, find, node, outline } from '../src/tools/read.ts';

test('outline from root and from a path with depth', async () => {
  const { store } = await workspace();
  assert.match(await outline(store, { file: 'plan.mmap' }), /- Phase 2 \[\^a\] \{session\}/);
  assert.equal(await outline(store, { file: 'plan.mmap', node: 'Plan/Phase 2', depth: 0 }), '- Phase 2 [^a] {session} (+2)');
});

test('find by topic returns paths', async () => {
  const { store } = await workspace();
  const text = await find(store, { file: 'plan.mmap', query: 'design' });
  assert.equal(text, '[^a1] Plan/Phase 2/Design\n[^b] Plan/Design');
});

test('node summary and unknown refs', async () => {
  const { store } = await workspace();
  assert.equal((await node(store, { file: 'plan.mmap', node: 'a1' })).path, 'Plan/Phase 2/Design');
  await assert.rejects(node(store, { file: 'plan.mmap', node: 'zz' }), /No node with id "zz"/);
});

test('duplicates groups same-topic nodes', async () => {
  const { store } = await workspace();
  assert.match(await duplicates(store, { file: 'plan.mmap' }), /\[\^a1\].*\[\^b\]/);
});
```

Run: `cd mcp-mindmap && npm test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement config, store, read handlers**

`src/config.ts`:

```ts
export interface ServerConfig { workspace: string; allowWrite: boolean }

const WORKSPACE_FLAG = '--workspace';
const ALLOW_WRITE_FLAG = '--allow-write';

export function parseArgs(argv: readonly string[]): ServerConfig {
  const at = argv.indexOf(WORKSPACE_FLAG);
  const workspace = at >= 0 ? argv[at + 1] : process.env.SOLOMD_WORKSPACE;
  if (!workspace) throw new Error(`Missing ${WORKSPACE_FLAG} <dir> (or SOLOMD_WORKSPACE)`);
  return { workspace, allowWrite: argv.includes(ALLOW_WRITE_FLAG) };
}
```

`src/store.ts`:

```ts
import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { MMAP_EXTENSION, parseMindmap, rootTopicFromFileName, serializeMindmap } from '../../app/src/lib/mindmap-format.ts';
import type { MapDisplay } from '../../app/src/lib/mindmap-display.ts';
import type { Snippet } from '../../app/src/lib/mindmap-snippets.ts';
import { resolveNode } from '../../app/src/lib/mindmap-address.ts';
import type { ServerConfig } from './config.ts';

export interface MapDoc { data: MindElixirData; display: MapDisplay; snippets: Snippet[] }

const TMP_SUFFIX = '.mcp-tmp';
const MAX_SCAN_DEPTH = 6;

export class MapStore {
  private readonly root: string;
  constructor(private readonly cfg: ServerConfig) { this.root = resolve(cfg.workspace); }

  resolve(file: string): string {
    const abs = resolve(this.root, file);
    const rel = relative(this.root, abs);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`"${file}" must be inside the workspace ${this.root}`);
    if (!abs.endsWith(`.${MMAP_EXTENSION}`)) throw new Error(`"${file}" is not a .${MMAP_EXTENSION} file`);
    return abs;
  }

  async load(file: string): Promise<MapDoc> {
    const abs = this.resolve(file);
    const parsed = parseMindmap(await readFile(abs, 'utf8'), rootTopicFromFileName(abs));
    if (!parsed.ok) throw new Error(`${file}: ${parsed.error}`);
    return { data: parsed.data, display: parsed.display, snippets: parsed.snippets };
  }

  async save(file: string, doc: MapDoc): Promise<void> {
    this.assertWritable();
    const abs = this.resolve(file);
    await writeFile(abs + TMP_SUFFIX, serializeMindmap(doc.data, doc.display, doc.snippets));
    await rename(abs + TMP_SUFFIX, abs);
  }

  assertWritable(): void {
    if (!this.cfg.allowWrite) throw new Error('Read-only: restart the server with --allow-write to edit maps');
  }

  async list(dir: string = this.root, depth = 0): Promise<string[]> {
    if (depth > MAX_SCAN_DEPTH) return [];
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => this.list(join(dir, e.name), depth + 1)));
    const here = entries.filter((e) => e.isFile() && e.name.endsWith(`.${MMAP_EXTENSION}`)).map((e) => relative(this.root, join(dir, e.name)));
    return [...here, ...nested.flat()];
  }
}

export function requireNode(doc: MapDoc, ref: string): NodeObj {
  const res = resolveNode(doc.data.nodeData, ref);
  if (!res.ok) throw new Error(res.error);
  return res.node;
}
```

`src/tools/read.ts`:

```ts
import { walkNodes } from '../../../app/src/lib/mindmap-gates.ts';
import { findDuplicateGroups, normalizeTopic } from '../../../app/src/lib/mindmap-duplicates.ts';
import { readFields } from '../../../app/src/lib/mindmap-node-fields.ts';
import { describeNode, outlineOf, pathOf, type NodeSummary } from '../../../app/src/lib/mindmap-address.ts';
import { requireNode, type MapStore } from '../store.ts';

export type FindBy = 'topic' | 'tag' | 'field' | 'note';
const NO_MATCH = '(no matches)';

export async function outline(store: MapStore, args: { file: string; node?: string; depth?: number }): Promise<string> {
  const doc = await store.load(args.file);
  const from = args.node ? requireNode(doc, args.node).id : undefined;
  return outlineOf(doc.data.nodeData, from, args.depth);
}

function haystack(node: Parameters<typeof readFields>[0], by: FindBy): string[] {
  if (by === 'tag') return (node.tags ?? []).map(String);
  if (by === 'field') return readFields(node).flatMap((f) => [f.key, f.value]);
  if (by === 'note') return [node.note ?? ''];
  return [node.topic];
}

export async function find(store: MapStore, args: { file: string; query: string; by?: FindBy }): Promise<string> {
  const doc = await store.load(args.file);
  const needle = normalizeTopic(args.query);
  const hits = walkNodes(doc.data.nodeData).filter((n) => haystack(n, args.by ?? 'topic').some((h) => normalizeTopic(h).includes(needle)));
  return hits.map((n) => `[^${n.id}] ${pathOf(doc.data.nodeData, n.id)}`).join('\n') || NO_MATCH;
}

export async function node(store: MapStore, args: { file: string; node: string }): Promise<NodeSummary> {
  const doc = await store.load(args.file);
  return describeNode(doc.data.nodeData, requireNode(doc, args.node).id)!;
}

export async function duplicates(store: MapStore, args: { file: string }): Promise<string> {
  const doc = await store.load(args.file);
  const root = doc.data.nodeData;
  const groups = findDuplicateGroups(root);
  return groups.map((g) => g.ids.map((id) => `[^${id}] ${pathOf(root, id)}`).join('  ==  ')).join('\n') || NO_MATCH;
}
```

- [ ] **Step 4: Wire the server with read tools**

`src/server.ts`:

```ts
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { ServerConfig } from './config.ts';
import { MapStore } from './store.ts';
import { duplicates, find, node, outline } from './tools/read.ts';

export const SERVER_NAME = 'solomd-mindmap';
const VERSION = '0.1.0';
export const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
export const fileArg = z.string().describe('Map path relative to the workspace, e.g. "plans/q4.mmap"');
export const nodeArg = z.string().describe('Node id from an outline ("a1b2") or a topic path from the root ("Plan/Phase 2")');

export const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });
export const json = (value: object) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });

function registerRead(server: McpServer, store: MapStore): void {
  server.registerTool('mmap_outline', {
    title: 'Map outline', annotations: READ,
    description: 'Indented outline of a map or subtree: "- Topic [^id]", gates as "→ [^target]", "{mark: x}", "{session}", "(+N)" for children cut by depth. Start here.',
    inputSchema: z.object({ file: fileArg, node: nodeArg.optional(), depth: z.number().int().min(0).max(50).optional().describe('Levels below the start node; omit for all') }),
  }, async (a) => text(await outline(store, a)));
  server.registerTool('mmap_find', {
    title: 'Find nodes', annotations: READ,
    description: 'Case-insensitive substring search. Returns "[^id] path" lines.',
    inputSchema: z.object({ file: fileArg, query: z.string().min(1), by: z.enum(['topic', 'tag', 'field', 'note']).optional() }),
  }, async (a) => text(await find(store, a)));
  server.registerTool('mmap_node', {
    title: 'Node details', annotations: READ,
    description: 'One node: topic, path, note, tags, fields, mark, bound session, gate target, gates pointing in, child count.',
    inputSchema: z.object({ file: fileArg, node: nodeArg }),
  }, async (a) => json(await node(store, a)));
  server.registerTool('mmap_duplicates', {
    title: 'Duplicate nodes', annotations: READ,
    description: 'Groups of nodes with the same topic and subtree. Merge one with mmap_gate action "merge".',
    inputSchema: z.object({ file: fileArg }),
  }, async (a) => text(await duplicates(store, a)));
}

export function createServer(cfg: ServerConfig): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });
  registerRead(server, new MapStore(cfg));
  return server;
}
```

`src/index.ts`:

```ts
#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { parseArgs } from './config.ts';
import { createServer, SERVER_NAME } from './server.ts';

const cfg = parseArgs(process.argv.slice(2));
serveStdio(() => createServer(cfg));
console.error(`${SERVER_NAME} on stdio, workspace ${cfg.workspace}${cfg.allowWrite ? ' (writes on)' : ''}`);
```

- [ ] **Step 5: Run tests, typecheck, smoke**

Run: `cd mcp-mindmap && npm test && npm run typecheck`
Expected: PASS, 7/7. Typecheck clean. If `tsc` complains about `app/src/lib` files (DOM-only types, Vue globals), add `"exclude"` for them or narrow `lib`. Do not change app code to satisfy it.

Run: `npx @modelcontextprotocol/inspector node mcp-mindmap/src/index.ts --workspace demos/fixtures` (any folder with a `.mmap`), then call `mmap_outline`.
Expected: an outline in the inspector.

- [ ] **Step 6: Commit**

```bash
git add mcp-mindmap .gitignore
git commit -m "feat(mcp-mindmap): stdio server with read tools over .mmap"
```

---

### Task 5: Write tools (add, edit, move, remove, gate)

**Files:**
- Create: `mcp-mindmap/src/tools/write.ts`
- Modify: `mcp-mindmap/src/server.ts` (add `registerWrite`)
- Test: `mcp-mindmap/test/write.test.ts`

**Interfaces:**
- Consumes: Task 1 (`insertNodes`, `updateNode`, `moveNode`, `removeNode`, `newNodeId`, `EditResult`); `parsePaste`; `makeGateNode`, `findNode`, `isGate`; `mergeIntoGate`; `fieldsPatch`, `notePatch`; `MapStore`, `requireNode`.
- Produces: `add`, `edit`, `move`, `remove`, `gate` handlers, each `(store, args) => Promise<string>` returning a one-line result plus the touched node ids. `applyEdit(store, file, doc, res): Promise<string[]>` (shared save helper).

- [ ] **Step 1: Write failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspace } from './fixtures.ts';
import { add, edit, gate, move, remove } from '../src/tools/write.ts';
import { outline } from '../src/tools/read.ts';

const F = 'plan.mmap';

test('add inserts a plaintext subtree under a path', async () => {
  const { store } = await workspace();
  const res = await add(store, { file: F, parent: 'Plan/Phase 2/Tasks', outline: '- Write API\n  - Endpoints\n- Review' });
  assert.match(res, /Added 2 node/);
  assert.match(await outline(store, { file: F, node: 'a2' }), /- Write API \[\^\w+\]\n {4}- Endpoints/);
});

test('edit changes topic, note, fields and tags', async () => {
  const { store } = await workspace();
  await edit(store, { file: F, node: 'b', topic: 'Design v2', note: 'why', tags: ['ux'], fields: [{ key: 'owner', value: 'ofek' }] });
  assert.match(await outline(store, { file: F }), /- Design v2 \[\^b\] #ux/);
});

test('move and remove report gate damage', async () => {
  const { store } = await workspace();
  await move(store, { file: F, node: 'b', parent: 'a' });
  assert.match(await outline(store, { file: F, node: 'a' }), /- Design \[\^b\]/);
  await gate(store, { file: F, action: 'link', parent: 'Plan', target: 'a1' });
  assert.match(await remove(store, { file: F, node: 'a' }), /1 gate now broken/);
});

test('gate merge turns a duplicate into a gate', async () => {
  const { store } = await workspace();
  await gate(store, { file: F, action: 'merge', keep: 'a1', duplicate: 'b' });
  assert.match(await outline(store, { file: F }), /\[\^b\] → \[\^a1\]/);
});

test('writes refused without --allow-write', async () => {
  const { store } = await workspace(false);
  await assert.rejects(edit(store, { file: F, node: 'b', topic: 'x' }), /--allow-write/);
});
```

Run: `cd mcp-mindmap && npm test`
Expected: FAIL, `write.ts` missing.

- [ ] **Step 2: Implement `src/tools/write.ts`**

```ts
import type { NodeObj } from 'mind-elixir';
import { parsePaste } from '../../../app/src/lib/mindmap-paste.ts';
import { insertNodes, moveNode, newNodeId, removeNode, updateNode, type EditResult } from '../../../app/src/lib/mindmap-edit.ts';
import { canBeGateTarget, makeGateNode } from '../../../app/src/lib/mindmap-gates.ts';
import { mergeIntoGate } from '../../../app/src/lib/mindmap-duplicates.ts';
import { fieldsPatch, notePatch, type NodeFieldEntry } from '../../../app/src/lib/mindmap-node-fields.ts';
import { requireNode, type MapDoc, type MapStore } from '../store.ts';

type GateArgs =
  | { file: string; action: 'link'; parent: string; target: string }
  | { file: string; action: 'unlink'; gate: string }
  | { file: string; action: 'merge'; keep: string; duplicate: string };

async function writable(store: MapStore, file: string): Promise<MapDoc> {
  store.assertWritable();
  return store.load(file);
}

export async function applyEdit(store: MapStore, file: string, doc: MapDoc, res: EditResult): Promise<string[]> {
  if (!res.ok) throw new Error(res.error);
  await store.save(file, { ...doc, data: res.data });
  return res.ids;
}

const idList = (ids: readonly string[]): string => ids.map((id) => `[^${id}]`).join(' ');

export async function add(store: MapStore, a: { file: string; parent: string; outline: string; index?: number }): Promise<string> {
  const doc = await writable(store, a.file);
  const parsed = parsePaste(a.outline);
  if (!parsed.ok) throw new Error(`Could not read the outline (${parsed.reason}). Use "- Topic" lines, two spaces per level`);
  const parent = requireNode(doc, a.parent);
  const ids = await applyEdit(store, a.file, doc, insertNodes(doc.data, parent.id, parsed.payload.nodes, a.index));
  return `Added ${ids.length} node(s) under [^${parent.id}]: ${idList(ids)}`;
}

function editPatch(node: NodeObj, a: { topic?: string; note?: string; tags?: string[]; fields?: NodeFieldEntry[] }): Partial<NodeObj> {
  return {
    ...(a.topic !== undefined ? { topic: a.topic } : {}),
    ...(a.note !== undefined ? notePatch(a.note) : {}),
    ...(a.tags !== undefined ? { tags: a.tags.length > 0 ? a.tags : undefined } : {}),
    ...(a.fields !== undefined ? fieldsPatch(node, a.fields) : {}),
  };
}

export async function edit(store: MapStore, a: { file: string; node: string; topic?: string; note?: string; tags?: string[]; fields?: NodeFieldEntry[] }): Promise<string> {
  const doc = await writable(store, a.file);
  const node = requireNode(doc, a.node);
  await applyEdit(store, a.file, doc, updateNode(doc.data, node.id, editPatch(node, a)));
  return `Updated [^${node.id}]`;
}

export async function move(store: MapStore, a: { file: string; node: string; parent: string; index?: number }): Promise<string> {
  const doc = await writable(store, a.file);
  const [node, parent] = [requireNode(doc, a.node), requireNode(doc, a.parent)];
  await applyEdit(store, a.file, doc, moveNode(doc.data, node.id, parent.id, a.index));
  return `Moved [^${node.id}] under [^${parent.id}]`;
}

export async function remove(store: MapStore, a: { file: string; node: string }): Promise<string> {
  const doc = await writable(store, a.file);
  const node = requireNode(doc, a.node);
  const res = removeNode(doc.data, node.id);
  await applyEdit(store, a.file, doc, res);
  const broken = res.ok ? res.brokenGates : 0;
  return `Removed [^${node.id}] "${node.topic}"${broken > 0 ? `; ${broken} gate now broken (find them with mmap_find query "⇒")` : ''}`;
}

async function link(store: MapStore, a: Extract<GateArgs, { action: 'link' }>): Promise<string> {
  const doc = await writable(store, a.file);
  const [parent, target] = [requireNode(doc, a.parent), requireNode(doc, a.target)];
  if (!canBeGateTarget(target)) throw new Error(`"${target.topic}" cannot be a gate target (it is itself a gate)`);
  const ids = await applyEdit(store, a.file, doc, insertNodes(doc.data, parent.id, [makeGateNode(newNodeId(), target)]));
  return `Gate ${idList(ids)} under [^${parent.id}] → [^${target.id}]`;
}

async function merge(store: MapStore, a: Extract<GateArgs, { action: 'merge' }>): Promise<string> {
  const doc = await writable(store, a.file);
  const [keep, dup] = [requireNode(doc, a.keep), requireNode(doc, a.duplicate)];
  const data = mergeIntoGate(doc.data, keep.id, dup.id);
  if (!data) throw new Error('These nodes cannot merge (one contains the other, or one is a gate)');
  await applyEdit(store, a.file, doc, { ok: true, data, ids: [dup.id] });
  return `Merged [^${dup.id}] into [^${keep.id}]; [^${dup.id}] is now a gate`;
}

export async function gate(store: MapStore, a: GateArgs): Promise<string> {
  if (a.action === 'link') return link(store, a);
  if (a.action === 'merge') return merge(store, a);
  return remove(store, { file: a.file, node: a.gate });
}
```

- [ ] **Step 3: Register write tools in `server.ts`**

Add the imports and the function, then call `registerWrite(server, store)` in `createServer` after `registerRead`, sharing one `store` constant:

```ts
import { add, edit, gate, move, remove } from './tools/write.ts';

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const DESTRUCTIVE = { ...WRITE, destructiveHint: true } as const;
const fieldArg = z.object({ key: z.string().min(1).max(64), value: z.string().max(2000) });

function registerWrite(server: McpServer, store: MapStore): void {
  server.registerTool('mmap_add', {
    title: 'Add nodes', annotations: WRITE,
    description: 'Add a subtree under a parent. "outline" uses "- Topic" lines, two spaces per level; markdown headings also work.',
    inputSchema: z.object({ file: fileArg, parent: nodeArg, outline: z.string().min(1), index: z.number().int().min(0).optional() }),
  }, async (a) => text(await add(store, a)));
  server.registerTool('mmap_edit', {
    title: 'Edit node', annotations: WRITE,
    description: 'Change topic, note, tags or fields. Passing fields or tags replaces the whole list. Never sets style: use mmap_mark.',
    inputSchema: z.object({ file: fileArg, node: nodeArg, topic: z.string().min(1).optional(), note: z.string().optional(), tags: z.array(z.string()).optional(), fields: z.array(fieldArg).optional() }),
  }, async (a) => text(await edit(store, a)));
  server.registerTool('mmap_move', {
    title: 'Move node', annotations: WRITE,
    description: 'Reparent a node (with its subtree). index = position among the new siblings.',
    inputSchema: z.object({ file: fileArg, node: nodeArg, parent: nodeArg, index: z.number().int().min(0).optional() }),
  }, async (a) => text(await move(store, a)));
  server.registerTool('mmap_remove', {
    title: 'Remove node', annotations: DESTRUCTIVE,
    description: 'Delete a node and its subtree. Reports gates left pointing at removed nodes.',
    inputSchema: z.object({ file: fileArg, node: nodeArg }),
  }, async (a) => text(await remove(store, a)));
  server.registerTool('mmap_gate', {
    title: 'Gates (cross-links)', annotations: WRITE,
    description: 'link: add a gate under "parent" pointing at "target". unlink: delete gate node "gate". merge: fold "duplicate" into "keep" and leave a gate.',
    inputSchema: z.discriminatedUnion('action', [
      z.object({ file: fileArg, action: z.literal('link'), parent: nodeArg, target: nodeArg }),
      z.object({ file: fileArg, action: z.literal('unlink'), gate: nodeArg }),
      z.object({ file: fileArg, action: z.literal('merge'), keep: nodeArg, duplicate: nodeArg }),
    ]),
  }, async (a) => text(await gate(store, a)));
}
```

If the SDK rejects a `discriminatedUnion` as `inputSchema` (it requires an object schema), switch to one object with `action: z.enum([...])` and optional `parent`/`target`/`gate`/`keep`/`duplicate`, and validate the pairs at the top of `gate()` with an error naming the missing argument.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd mcp-mindmap && npm test && npm run typecheck`
Expected: PASS, 12/12.

- [ ] **Step 5: Commit**

```bash
git add mcp-mindmap/src mcp-mindmap/test
git commit -m "feat(mcp-mindmap): add/edit/move/remove/gate tools"
```

---

### Task 6: Meaning tools (legend, mark)

**Files:**
- Create: `mcp-mindmap/src/tools/meaning.ts`
- Modify: `mcp-mindmap/src/server.ts`
- Test: `mcp-mindmap/test/meaning.test.ts`

**Interfaces:**
- Consumes: Task 3 (`readLegend`, `withLegend`, `markNode`, `LegendEntry`); `applyEdit` (Task 5).
- Produces: `legend(store, {file, set?: LegendEntry[]}) → string`, `mark(store, {file, node, meaning: string | null}) → string`.

- [ ] **Step 1: Failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspace } from './fixtures.ts';
import { legend, mark } from '../src/tools/meaning.ts';
import { outline } from '../src/tools/read.ts';

test('set legend, mark, read back by meaning only', async () => {
  const { store } = await workspace();
  assert.equal(await legend(store, { file: 'plan.mmap' }), '(no legend yet)');
  await legend(store, { file: 'plan.mmap', set: [{ meaning: 'blocked', background: '#fde2e2' }] });
  assert.equal(await legend(store, { file: 'plan.mmap' }), 'blocked');
  await mark(store, { file: 'plan.mmap', node: 'a1', meaning: 'blocked' });
  const text = await outline(store, { file: 'plan.mmap' });
  assert.match(text, /Design \[\^a1\] \{mark: blocked\}/);
  assert.doesNotMatch(text, /#fde2e2/);
});
```

Run: `cd mcp-mindmap && npm test` → FAIL.

- [ ] **Step 2: Implement `src/tools/meaning.ts`**

```ts
import { markNode, readLegend, withLegend, type LegendEntry } from '../../../app/src/lib/mindmap-legend.ts';
import { requireNode, type MapStore } from '../store.ts';
import { applyEdit } from './write.ts';

const EMPTY = '(no legend yet)';

export async function legend(store: MapStore, a: { file: string; set?: LegendEntry[] }): Promise<string> {
  const doc = await store.load(a.file);
  if (!a.set) return readLegend(doc.data.nodeData).map((e) => e.meaning).join('\n') || EMPTY;
  store.assertWritable();
  const data = withLegend(doc.data, a.set);
  await store.save(a.file, { ...doc, data });
  return `Legend: ${readLegend(data.nodeData).map((e) => e.meaning).join(', ')}`;
}

export async function mark(store: MapStore, a: { file: string; node: string; meaning: string | null }): Promise<string> {
  store.assertWritable();
  const doc = await store.load(a.file);
  const node = requireNode(doc, a.node);
  await applyEdit(store, a.file, doc, markNode(doc.data, node.id, a.meaning));
  return a.meaning === null ? `Cleared mark on [^${node.id}]` : `Marked [^${node.id}] "${a.meaning}"`;
}
```

- [ ] **Step 3: Register in `server.ts`**

```ts
import { legend, mark } from './tools/meaning.ts';

function registerMeaning(server: McpServer, store: MapStore): void {
  server.registerTool('mmap_legend', {
    title: 'Map legend', annotations: WRITE,
    description: 'The map\'s meanings (e.g. blocked, done, risk). Without "set" it lists them. "set" replaces the legend; colours are CSS hex and stay hidden from reads.',
    inputSchema: z.object({ file: fileArg, set: z.array(z.object({ meaning: z.string().min(1).max(40), color: z.string().optional(), background: z.string().optional() })).optional() }),
  }, async (a) => text(await legend(store, a)));
  server.registerTool('mmap_mark', {
    title: 'Mark node meaning', annotations: WRITE,
    description: 'Give a node a legend meaning (SoloMD shows its colour). meaning=null clears it. The only way to change node appearance.',
    inputSchema: z.object({ file: fileArg, node: nodeArg, meaning: z.string().nullable() }),
  }, async (a) => text(await mark(store, a)));
}
```

Call `registerMeaning(server, store)` in `createServer`. `mmap_legend` is listed with `WRITE` annotations because `set` writes. Its description says reads are safe.

- [ ] **Step 4: Run tests**

Run: `cd mcp-mindmap && npm test && npm run typecheck` → PASS, 13/13.

- [ ] **Step 5: Commit**

```bash
git add mcp-mindmap/src mcp-mindmap/test
git commit -m "feat(mcp-mindmap): legend and mark tools"
```

---

### Task 7: Session binding tools + session-id hook

**Files:**
- Create: `mcp-mindmap/src/tools/session.ts`, `plugin/hooks/session-id.mjs`
- Modify: `mcp-mindmap/src/server.ts`
- Test: `mcp-mindmap/test/session.test.ts`, `plugin/hooks/session-id.test.mjs`

**Interfaces:**
- Consumes: `CLAUDE_SESSION_KEY`, `isClaudeSessionId`, `readFields`, `fieldsPatch`; `boundSession`, `pathOf`; `walkNodes`; `MapStore.list`; `applyEdit`, `updateNode`.
- Produces: `bindSession(store, {file, node, session: string | null}) → string`; `sessionNodes(store, {session, file?}) → string` (lines `file  [^id] path`); hook script prints `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"claude-session-id: <uuid>"}}`.

- [ ] **Step 1: Failing tests**

`mcp-mindmap/test/session.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SID, workspace } from './fixtures.ts';
import { bindSession, sessionNodes } from '../src/tools/session.ts';

const OTHER = '9b2c1e4a-1111-4222-8333-944455556666';

test('sessionNodes finds the bound node across the workspace', async () => {
  const { store } = await workspace();
  assert.equal(await sessionNodes(store, { session: SID }), 'plan.mmap  [^a] Plan/Phase 2');
});

test('bind replaces an existing binding and keeps other fields', async () => {
  const { store } = await workspace();
  await bindSession(store, { file: 'plan.mmap', node: 'a1', session: OTHER });
  assert.equal(await sessionNodes(store, { session: OTHER, file: 'plan.mmap' }), 'plan.mmap  [^a1] Plan/Phase 2/Design');
  await bindSession(store, { file: 'plan.mmap', node: 'a', session: null });
  assert.equal(await sessionNodes(store, { session: SID }), '(no node bound to this session)');
});

test('bind rejects non-uuid sessions', async () => {
  const { store } = await workspace();
  await assert.rejects(bindSession(store, { file: 'plan.mmap', node: 'a1', session: 'abc' }), /session id/);
});
```

`plugin/hooks/session-id.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./session-id.mjs', import.meta.url));

test('prints the session id as SessionStart context', () => {
  const out = execFileSync('node', [script], { input: JSON.stringify({ session_id: '0f8fad5b-d9cb-469f-a165-70867728950e', hook_event_name: 'SessionStart' }) });
  const parsed = JSON.parse(out.toString());
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(parsed.hookSpecificOutput.additionalContext, 'claude-session-id: 0f8fad5b-d9cb-469f-a165-70867728950e');
});

test('prints nothing for bad input', () => {
  assert.equal(execFileSync('node', [script], { input: 'nope' }).toString(), '');
});
```

Run both: FAIL.

- [ ] **Step 2: Implement `plugin/hooks/session-id.mjs`**

```js
#!/usr/bin/env node
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let raw = '';
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let id;
  try { id = JSON.parse(raw).session_id; } catch { return; }
  if (typeof id !== 'string' || !UUID.test(id)) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `claude-session-id: ${id}` } }));
});
```

- [ ] **Step 3: Implement `src/tools/session.ts`**

```ts
import type { NodeObj } from 'mind-elixir';
import { walkNodes } from '../../../app/src/lib/mindmap-gates.ts';
import { CLAUDE_SESSION_KEY, fieldsPatch, isClaudeSessionId, readFields } from '../../../app/src/lib/mindmap-node-fields.ts';
import { boundSession, pathOf } from '../../../app/src/lib/mindmap-address.ts';
import { updateNode } from '../../../app/src/lib/mindmap-edit.ts';
import { requireNode, type MapStore } from '../store.ts';
import { applyEdit } from './write.ts';

const NONE = '(no node bound to this session)';

function sessionFields(node: NodeObj, session: string | null) {
  const others = readFields(node).filter((f) => f.key !== CLAUDE_SESSION_KEY);
  return fieldsPatch(node, session === null ? others : [...others, { key: CLAUDE_SESSION_KEY, value: session }]);
}

export async function bindSession(store: MapStore, a: { file: string; node: string; session: string | null }): Promise<string> {
  if (a.session !== null && !isClaudeSessionId(a.session)) throw new Error(`"${a.session}" is not a Claude session id (UUID). Use the claude-session-id from your context`);
  store.assertWritable();
  const doc = await store.load(a.file);
  const node = requireNode(doc, a.node);
  await applyEdit(store, a.file, doc, updateNode(doc.data, node.id, sessionFields(node, a.session)));
  return a.session === null ? `Unbound [^${node.id}]` : `Bound [^${node.id}] "${node.topic}" to session ${a.session}. Resume from SoloMD's details pane`;
}

async function matchesIn(store: MapStore, file: string, session: string): Promise<string[]> {
  const root = (await store.load(file)).data.nodeData;
  return walkNodes(root).filter((n) => boundSession(n) === session).map((n) => `${file}  [^${n.id}] ${pathOf(root, n.id)}`);
}

export async function sessionNodes(store: MapStore, a: { session: string; file?: string }): Promise<string> {
  const files = a.file ? [a.file] : await store.list();
  const lines = (await Promise.all(files.map((f) => matchesIn(store, f, a.session).catch(() => [])))).flat();
  return lines.join('\n') || NONE;
}
```

- [ ] **Step 4: Register in `server.ts`**

```ts
import { bindSession, sessionNodes } from './tools/session.ts';

const sessionArg = z.string().describe('Claude session UUID; your own is the "claude-session-id" in your context');

function registerSession(server: McpServer, store: MapStore): void {
  server.registerTool('mmap_bind_session', {
    title: 'Bind Claude session to node', annotations: WRITE,
    description: 'Store a Claude session on a node so SoloMD can resume it ("claude --resume"). session=null unbinds. A node holds one session.',
    inputSchema: z.object({ file: fileArg, node: nodeArg, session: sessionArg.nullable() }),
  }, async (a) => text(await bindSession(store, a)));
  server.registerTool('mmap_session_nodes', {
    title: 'Nodes bound to a session', annotations: READ,
    description: 'Which node(s) a session is bound to, across the workspace or one file. Use at session start to find "your" node.',
    inputSchema: z.object({ session: sessionArg, file: fileArg.optional() }),
  }, async (a) => text(await sessionNodes(store, a)));
}
```

Call `registerSession(server, store)` in `createServer`.

- [ ] **Step 5: Run tests**

Run: `cd mcp-mindmap && npm test && npm run typecheck && node --test plugin/hooks/session-id.test.mjs`
Expected: PASS, 16/16 server tests and 2/2 hook tests. (Run the hook test from the repo root.)

- [ ] **Step 6: Commit**

```bash
git add mcp-mindmap plugin/hooks
git commit -m "feat(mcp-mindmap): bind Claude sessions to nodes + session-id hook"
```

---

### Task 8: File tools (create, export, reveal)

**Files:**
- Create: `mcp-mindmap/src/tools/file.ts`
- Modify: `mcp-mindmap/src/server.ts`
- Test: `mcp-mindmap/test/file.test.ts`

**Interfaces:**
- Consumes: `createEmptyMindmap`, `serializeMindmap`, `rootTopicFromFileName`; `markdownToMindmap` (`mindmap-convert.ts`); `parsePaste`; `insertNodes`; `buildTextExport`, `MindmapTextFormat`; `mapToHeadingsMarkdown`; `outlineOf`; `node:child_process.execFile`.
- Produces: `create(store, {file, from: 'outline' | 'markdown', source, root?}) → string`; `exportMap(store, {file, format: 'outline' | 'markdown' | 'headings' | 'mermaid' | 'adjacency'}) → string`; `reveal(store, {file, node?}, opener?) → string` (`opener` injectable for tests); `revealUrl(abs: string, nodeId?: string): string`.

- [ ] **Step 1: Failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspace } from './fixtures.ts';
import { create, exportMap, reveal, revealUrl } from '../src/tools/file.ts';
import { outline } from '../src/tools/read.ts';

test('create from outline and from markdown, refusing overwrite', async () => {
  const { store } = await workspace();
  await create(store, { file: 'new.mmap', from: 'outline', source: '- A\n  - B', root: 'Ideas' });
  assert.match(await outline(store, { file: 'new.mmap' }), /^- Ideas \[\^\w+\]\n {2}- A/);
  await create(store, { file: 'md.mmap', from: 'markdown', source: '# Doc\n## One\n## Two' });
  assert.match(await outline(store, { file: 'md.mmap' }), /One/);
  await assert.rejects(create(store, { file: 'plan.mmap', from: 'outline', source: '- x' }), /already exists/);
});

test('export formats', async () => {
  const { store } = await workspace();
  assert.match(await exportMap(store, { file: 'plan.mmap', format: 'outline' }), /- Plan \[\^r\]/);
  assert.match(await exportMap(store, { file: 'plan.mmap', format: 'mermaid' }), /mindmap|graph|flowchart/);
  assert.match(await exportMap(store, { file: 'plan.mmap', format: 'headings' }), /# Plan/);
});

test('reveal opens the file and builds a node deep link', async () => {
  const { store, dir } = await workspace();
  const calls: string[][] = [];
  const res = await reveal(store, { file: 'plan.mmap', node: 'Plan/Phase 2' }, async (args) => { calls.push(args); });
  assert.equal(calls[0].at(-1), `${dir}/plan.mmap`);
  assert.match(res, /\[\^a\]/);
  assert.equal(revealUrl('/x/p.mmap', 'a'), 'solomd://open?path=%2Fx%2Fp.mmap&node=a');
});
```

Run: FAIL.

- [ ] **Step 2: Implement `src/tools/file.ts`**

```ts
import { access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createEmptyMindmap, rootTopicFromFileName } from '../../../app/src/lib/mindmap-format.ts';
import { markdownToMindmap } from '../../../app/src/lib/mindmap-convert.ts';
import { parsePaste } from '../../../app/src/lib/mindmap-paste.ts';
import { insertNodes } from '../../../app/src/lib/mindmap-edit.ts';
import { buildTextExport } from '../../../app/src/lib/mindmap-export.ts';
import { mapToHeadingsMarkdown } from '../../../app/src/lib/mindmap-headings.ts';
import { outlineOf, pathOf } from '../../../app/src/lib/mindmap-address.ts';
import { requireNode, type MapStore } from '../store.ts';

export type ExportFormat = 'outline' | 'markdown' | 'headings' | 'mermaid' | 'adjacency';
export type Opener = (args: string[]) => Promise<void>;

const APP_NAME = 'SoloMD';
const DEEP_LINK = 'solomd://open';
const run = promisify(execFile);
const macOpener: Opener = async (args) => { await run('open', args); };

async function exists(abs: string): Promise<boolean> {
  return access(abs).then(() => true, () => false);
}

function fromOutline(root: string, source: string) {
  const parsed = parsePaste(source);
  if (!parsed.ok) throw new Error(`Could not read the outline (${parsed.reason})`);
  const res = insertNodes(createEmptyMindmap(root), createEmptyMindmap(root).nodeData.id, parsed.payload.nodes);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function create(store: MapStore, a: { file: string; from: 'outline' | 'markdown'; source: string; root?: string }): Promise<string> {
  store.assertWritable();
  const abs = store.resolve(a.file);
  if (await exists(abs)) throw new Error(`${a.file} already exists. Edit it with mmap_add instead`);
  const root = a.root ?? rootTopicFromFileName(abs);
  const data = a.from === 'markdown' ? markdownToMindmap(a.source, { rootTopic: root }) : fromOutline(root, a.source);
  await store.save(a.file, { data, display: {}, snippets: [] });
  return `Created ${a.file}`;
}

export async function exportMap(store: MapStore, a: { file: string; format: ExportFormat }): Promise<string> {
  const doc = await store.load(a.file);
  if (a.format === 'outline') return outlineOf(doc.data.nodeData);
  if (a.format === 'headings') return mapToHeadingsMarkdown(doc.data);
  return buildTextExport(doc.data, a.format, doc.snippets);
}

export function revealUrl(abs: string, nodeId?: string): string {
  const params = new URLSearchParams({ path: abs, ...(nodeId ? { node: nodeId } : {}) });
  return `${DEEP_LINK}?${params.toString()}`;
}

export async function reveal(store: MapStore, a: { file: string; node?: string }, opener: Opener = macOpener): Promise<string> {
  const abs = store.resolve(a.file);
  const doc = await store.load(a.file);
  const node = a.node ? requireNode(doc, a.node) : undefined;
  await opener(['-a', APP_NAME, abs]);
  const where = node ? ` at [^${node.id}] ${pathOf(doc.data.nodeData, node.id)}` : '';
  return `Opened ${a.file} in ${APP_NAME}${where}. Node focus link: ${revealUrl(abs, node?.id)}`;
}
```

If `buildTextExport(..., 'markdown')` throws in Node because `@mind-elixir/export-mindmap` touches `document`, route `'markdown'` to `outlineMarkdownOf` (`mindmap-outline.ts`) instead and note it in the commit message.

- [ ] **Step 3: Register in `server.ts`**

```ts
import { create, exportMap, reveal } from './tools/file.ts';

function registerFile(server: McpServer, store: MapStore): void {
  server.registerTool('mmap_create', {
    title: 'Create map', annotations: WRITE,
    description: 'New .mmap from a "- Topic" outline or from markdown headings/lists. Refuses to overwrite.',
    inputSchema: z.object({ file: fileArg, from: z.enum(['outline', 'markdown']), source: z.string().min(1), root: z.string().optional().describe('Root topic; defaults to the file name') }),
  }, async (a) => text(await create(store, a)));
  server.registerTool('mmap_export', {
    title: 'Export map as text', annotations: READ,
    description: 'outline (with ids), markdown, headings, mermaid or adjacency. Returns the text; write it with your own file tools if needed.',
    inputSchema: z.object({ file: fileArg, format: z.enum(['outline', 'markdown', 'headings', 'mermaid', 'adjacency']) }),
  }, async (a) => text(await exportMap(store, a)));
  server.registerTool('mmap_reveal', {
    title: 'Show in SoloMD', annotations: { ...READ, openWorldHint: true, idempotentHint: false },
    description: 'Open the map in the SoloMD app (macOS), optionally at a node.',
    inputSchema: z.object({ file: fileArg, node: nodeArg.optional() }),
  }, async (a) => text(await reveal(store, a)));
}
```

Call `registerFile(server, store)` in `createServer`.

- [ ] **Step 4: Run tests**

Run: `cd mcp-mindmap && npm test && npm run typecheck` → PASS, 19/19.

- [ ] **Step 5: Commit**

```bash
git add mcp-mindmap
git commit -m "feat(mcp-mindmap): create/export/reveal tools"
```

---

### Task 9: Claude Code plugin + skill, end-to-end check

**Files:**
- Create: `plugin/.claude-plugin/plugin.json`, `plugin/.mcp.json`, `plugin/hooks/hooks.json`, `plugin/skills/mindmap/SKILL.md`, `plugin/README.md`
- Modify: `CLAUDE.md` (layout table row for `mcp-mindmap/` and `plugin/`)

**Interfaces:**
- Consumes: `mcp-mindmap/src/index.ts` CLI (`--workspace`, `--allow-write`); `plugin/hooks/session-id.mjs`.
- Produces: an installable plugin `solomd-mindmap`.

- [ ] **Step 1: Manifest, server config, hook**

`plugin/.claude-plugin/plugin.json`:

```json
{
  "name": "solomd-mindmap",
  "version": "0.1.0",
  "description": "Read and edit SoloMD .mmap mind maps from Claude Code; bind sessions to nodes"
}
```

`plugin/.mcp.json`:

```json
{
  "mcpServers": {
    "solomd-mindmap": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/../mcp-mindmap/src/index.ts", "--workspace", "${SOLOMD_WORKSPACE}", "--allow-write"]
    }
  }
}
```

`plugin/hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/session-id.mjs\"" }] }
    ]
  }
}
```

Check: run `claude plugin validate plugin`. If the validator rejects `${SOLOMD_WORKSPACE}` env expansion in `.mcp.json` args, replace it with `"${CLAUDE_PROJECT_DIR}"`. A workspace then defaults to the project Claude was started in.

- [ ] **Step 2: Write `plugin/skills/mindmap/SKILL.md`**

````markdown
---
name: mindmap
description: Use when the user mentions a mind map, a .mmap file, a node, gates, or "my map"; or asks to plan, outline or brainstorm into SoloMD; or to bind/find this session's node. Works through the solomd-mindmap MCP tools.
---

# SoloMD mind maps

Maps are `.mmap` files. Never read or write their JSON directly: always use the `mmap_*` tools.

## Start

1. `mmap_session_nodes` with your `claude-session-id` (it's in your context). If a node comes back, that's what this session is about: `mmap_outline` from it.
2. Otherwise `mmap_outline` on the file with `depth: 2`, then drill down by node id.

## Refer to nodes

- By id from an outline: `a1b2` (shown as `[^a1b2]`).
- Or by topic path from the root: `Plan/Phase 2/Tasks`.

## Choose the right operation

| Want | Tool |
| --- | --- |
| New children / subtree | `mmap_add` with "- Topic" lines, 2 spaces per level |
| Rename, note, tags, key/value fields | `mmap_edit` (lists replace, so read first with `mmap_node`) |
| Same idea in two places | `mmap_gate` link (a gate is a cross-link, shown `⇒ Topic → [^target]`) instead of duplicating |
| Found duplicates | `mmap_duplicates` then `mmap_gate` merge |
| Status / meaning (blocked, done, risk) | `mmap_mark`; if the meaning is missing, ask the user before extending `mmap_legend` |
| Tie this conversation to a node | `mmap_bind_session` with your `claude-session-id` |
| Show the user | `mmap_reveal` |

## Rules

- Don't style nodes. Appearance changes only through legend meanings.
- Before `mmap_remove` on a node with children, say what will go and confirm.
- Keep topics short (≤ 8 words). Put detail in the note.
- After edits, tell the user the node ids you touched. SoloMD reloads an open map unless the user has unsaved changes there.
````

- [ ] **Step 3: README and CLAUDE.md**

`plugin/README.md`:

````markdown
# solomd-mindmap plugin

Claude Code tools for SoloMD `.mmap` maps.

```bash
pnpm --dir app install
pnpm --dir mcp-mindmap install
claude --plugin-dir ./plugin
```

Set `SOLOMD_WORKSPACE` to your notes folder (default: the project dir). Needs Node ≥ 22.18.
````

Add to the `CLAUDE.md` layout table:

```markdown
| `mcp-mindmap/` | Stdio MCP server for `.mmap` (TS, imports `app/src/lib`) — `pnpm --dir mcp-mindmap test` |
| `plugin/` | Claude Code plugin: mindmap MCP + skill + session-id hook |
```

- [ ] **Step 4: Validate and run end to end**

Run: `claude plugin validate plugin`
Expected: no errors.

Run: `SOLOMD_WORKSPACE=$PWD/demos claude --plugin-dir ./plugin -p "Use mmap_outline on any .mmap in the workspace with depth 1, then tell me your claude-session-id"`
Expected: an outline, plus a UUID matching the session.

Manual check in SoloMD (desktop build): open a map, ask Claude to `mmap_add` under the root. The tab reloads with the new nodes. Then bind the session and click resume in the details pane: `claude --resume <id>` opens this conversation.

- [ ] **Step 5: Commit**

```bash
git add plugin CLAUDE.md
git commit -m "feat(plugin): solomd-mindmap Claude Code plugin with skill and session hook"
```

---

### Task 10 (optional, app side): focus a node from a `solomd://open` link on desktop

**Files:**
- Modify: `app/src-tauri/tauri.conf.json` (deep-link `desktop.schemes: ["solomd"]`), `app/src-tauri/src/lib.rs` (register the scheme on desktop; forward single-instance argv URLs to the frontend)
- Modify: `app/src/App.vue:1136-1163` (run the existing `onOpenUrl` handler on desktop too)
- Create: `app/src/lib/deep-link.ts` (+test): `parseOpenLink(url: string): { path: string; node?: string } | null`
- Modify: the open path in `App.vue` so that after a `.mmap` opens with `node`, it calls the existing jump (`composables/useMindmapJump.ts`)

**Interfaces:**
- Consumes: `revealUrl` format from Task 8 (`solomd://open?path=<abs>&node=<id>`).
- Produces: `parseOpenLink`.

- [ ] **Step 1: Failing test for `parseOpenLink`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenLink } from './deep-link.ts';

test('parses path and node', () => {
  assert.deepEqual(parseOpenLink('solomd://open?path=%2Fx%2Fp.mmap&node=a'), { path: '/x/p.mmap', node: 'a' });
  assert.deepEqual(parseOpenLink('solomd://open?path=%2Fx%2Fp.mmap'), { path: '/x/p.mmap' });
  assert.equal(parseOpenLink('solomd://other?path=x'), null);
  assert.equal(parseOpenLink('https://evil/open?path=x'), null);
  assert.equal(parseOpenLink('solomd://open?path=%2Fx%2Fp.mmap&node=%3Cscript%3E'), null);
});
```

- [ ] **Step 2: Implement `app/src/lib/deep-link.ts`**

```ts
const SCHEME = 'solomd:';
const OPEN_HOST = 'open';
const NODE_ID = /^[\w-]{1,64}$/u;

export interface OpenLink { path: string; node?: string }

export function parseOpenLink(raw: string): OpenLink | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== SCHEME || url.hostname !== OPEN_HOST) return null;
  const path = url.searchParams.get('path');
  const node = url.searchParams.get('node');
  if (!path) return null;
  if (node !== null && !NODE_ID.test(node)) return null;
  return node === null ? { path } : { path, node };
}
```

Run: `cd app && node --test --experimental-strip-types src/lib/deep-link.test.ts` → PASS, 1/1.

- [ ] **Step 3: Wire the desktop deep link**

Follow the tauri-plugin-deep-link v2 desktop guide: add `"plugins": { "deep-link": { "desktop": { "schemes": ["solomd"] } } }` to `tauri.conf.json`, call `app.deep_link().register_all()` in `setup` under `#[cfg(desktop)]`, and in the single-instance callback emit any `solomd://` argv to the frontend. In `App.vue`, drop the mobile-only guard around `onOpenUrl`. Route URLs through `parseOpenLink`: open `path`, then, when `node` is set and the tab is a mindmap, call the jump from `useMindmapJump`.

- [ ] **Step 4: Verify on desktop**

Run: `pnpm --dir app tauri build --debug`, install, then `open "solomd://open?path=$PWD/demos/<map>.mmap&node=<id>"`.
Expected: SoloMD opens the map and focuses the node.

Then make `mmap_reveal` use the deep link when a node is given: in `reveal`, call `opener([revealUrl(abs, node.id)])` instead of `['-a', APP_NAME, abs]`, and update the Task 8 test's expectation to `calls[0][0].startsWith('solomd://open')`.

- [ ] **Step 5: Commit**

```bash
git add app/src-tauri app/src/App.vue app/src/lib/deep-link.ts app/src/lib/deep-link.test.ts mcp-mindmap
git commit -m "feat(app): solomd://open deep link focuses a mindmap node on desktop"
```

---

## Self-review

| Check | Result |
| --- | --- |
| Every design tool has a task | outline/find/node/duplicates → T4; add/edit/move/remove/gate → T5; legend/mark → T6; bind/session_nodes → T7; create/export/reveal → T8; node focus → T10 |
| No raw JSON | Reads return outline text, except `mmap_node`, which returns a small summary. No tool accepts node JSON |
| Styles hidden | Only `markNode` writes `style`; outline shows `{mark}` only |
| Names consistent | `EditResult`, `applyEdit`, `requireNode`, `outlineOf`, `revealUrl` match across tasks |
| Known risks flagged inline | Legend round-trip (T3), tsc over app lib (T4), discriminated-union schema (T5), export-mindmap in Node (T8), `.mcp.json` env expansion (T9), Tauri desktop deep link (T10) |
