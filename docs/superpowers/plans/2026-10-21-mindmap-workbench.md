# Mindmap Workbench, Merge & Map Paste — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge 2+ maps into a new saved file, graft a map (file / clipboard) into the current map, and collect maps/subtrees in a persistent workbench.

**Architecture:** Pure logic in `app/src/lib/` (payloads, graft, workbench state, staleness) with `node:test` coverage. A thin Pinia store persists the workbench. Vue: one modal form, context-menu items on 3 surfaces, a paste-target dialog. MCP tools reuse the same lib functions.

**Tech Stack:** Vue 3.5 + Pinia 3, mind-elixir, Tauri 2 (`invoke('read_file')`, `@tauri-apps/plugin-dialog`, clipboard-manager), `node:test` (TS run natively by Node 22), MCP SDK + zod (mcp-mindmap only).

**Spec:** `docs/superpowers/specs/2026-10-21-mindmap-workbench-design.md`

## Global Constraints

- Tests: `cd app && node --test --experimental-strip-types <file>`; MCP: `pnpm --dir mcp-mindmap test`.
- Build gate: `pnpm --dir app build` (vue-tsc) must pass after every task touching `.vue`/`.ts`.
- App has **no zod**: validate persisted data with type guards (`isRecord` pattern, as `parseTagRules` in `lib/mindmap-folder-tree.ts`). Do not add dependencies. *(Spec §3 says Zod — superseded by this.)*
- Whole-map paste dialog triggers on `payload.format === 'mmap'` only (envelope text, which *Copy map* produces). *(Narrows spec §6 `{'mmap','json'}`.)*
- No comments unless non-obvious "why"; constants for literals; functions ≤20 lines; no `any`.
- `.mmap` has exactly one root; "nothing selected" ⇒ target root.
- Workbench actions are **not** undoable; every map edit is **one** undo step.
- i18n: add keys to `app/src/i18n/en.ts` only (other locales fall back).
- Commit after each task; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `app/src/lib/mindmap-payload.ts` | new | subtree extraction, map-text parse, copy text, pure graft |
| `app/src/lib/mindmap-batch.ts` | modify | add `runAsOneOperationAsync` |
| `app/src/lib/mindmap-insert.ts` | new | `resolveInsertTargetId`, `PasteMapTarget` |
| `app/src/lib/mindmap-workbench.ts` | new | entry types, identity, upsert/remove/select, parse, staleness, merge topic |
| `app/src/stores/mindmapWorkbench.ts` | new | Pinia + localStorage wrapper over lib |
| `app/src/composables/useMindmapWorkbench.ts` | new | read sources (tab buffer / disk), resolve, merge→save, open event |
| `app/src/components/MindmapWorkbench.vue` | new | modal form |
| `app/src/components/MindmapPasteTargetDialog.vue` | new | ⌘V target dialog |
| `app/src/components/MindmapCanvas.vue` | modify | shared insert path, menu items, paste dialog hook, `sourcePath` prop |
| `app/src/components/MindmapView.vue` | modify | pass `sourcePath` |
| `app/src/components/FileTree.vue` | modify | `.mmap` context items |
| `app/src/composables/useFiles.ts` | modify | export `saveTabAs` |
| `app/src/stores/settings.ts`, `components/SettingsPanel.vue` | modify | `mindmapPasteMapTarget` |
| `app/src/composables/useCommands.ts`, `lib/keybindings.ts`, `App.vue` | modify | `mindmap.workbench` command, mount components |
| `mcp-mindmap/src/tools/write.ts`, `src/server.ts`, `test/*.test.ts` | modify | `mmap_merge`, `mmap_graft` |

---

### Task 1: Map payload helpers + pure graft

**Files:**
- Create: `app/src/lib/mindmap-payload.ts`
- Test: `app/src/lib/mindmap-payload.test.ts`

**Interfaces:**
- Consumes: `findNode`, `walkNodes`, `canHoldChildren` (`lib/mindmap-gates.ts`); `parseMindmap`, `serializeMindmap`, `sanitizeMindmapData` (`lib/mindmap-format.ts`); `prefixMindmapIds` (`lib/mindmap-merge.ts`); `payloadOf`, `PastePayload` (`lib/mindmap-paste.ts`).
- Produces:
  - `subtreeData(data: MindElixirData, nodeIds: readonly string[], groupTopic: string): MindElixirData | null`
  - `parseMapText(text: string, fallbackTopic: string): MapTextResult` where `MapTextResult = { ok: true; data: MindElixirData; payload: PastePayload } | { ok: false; error: string }`
  - `copyMapText(data: MindElixirData): string`
  - `graftMap(target: MindElixirData, source: MindElixirData, parentId?: string): GraftResult` where `GraftResult = { ok: true; data: MindElixirData; rootId: string } | { ok: false; error: string }`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { copyMapText, graftMap, parseMapText, subtreeData } from './mindmap-payload.ts';

const sample = (): MindElixirData => ({
  nodeData: { id: 'root', topic: 'R', children: [
    { id: 'a', topic: 'A', children: [{ id: 'a1', topic: 'A1' }, { id: 'a2', topic: 'A2' }] },
    { id: 'b', topic: 'B' },
  ] },
  arrows: [
    { id: 'x1', label: '', from: 'a1', to: 'a2', delta1: { x: 0, y: 0 }, delta2: { x: 0, y: 0 } },
    { id: 'x2', label: '', from: 'a1', to: 'b', delta1: { x: 0, y: 0 }, delta2: { x: 0, y: 0 } },
  ],
  summaries: [{ id: 's1', label: 'S', parent: 'a', start: 0, end: 1 }],
});

test('subtreeData: single node becomes root, keeps internal arrows/summaries only', () => {
  const out = subtreeData(sample(), ['a'], 'G');
  assert.equal(out?.nodeData.id, 'a');
  assert.deepEqual(out?.arrows?.map((a) => a.id), ['x1']);
  assert.deepEqual(out?.summaries?.map((s) => s.id), ['s1']);
});

test('subtreeData: several nodes wrap under a group root; nested picks collapse', () => {
  const out = subtreeData(sample(), ['a', 'a1', 'b'], 'G');
  assert.equal(out?.nodeData.topic, 'G');
  assert.deepEqual(out?.nodeData.children?.map((n) => n.id), ['a', 'b']);
  assert.deepEqual(out?.arrows?.map((a) => a.id), ['x1', 'x2']);
});

test('subtreeData: unknown ids → null', () => {
  assert.equal(subtreeData(sample(), ['nope'], 'G'), null);
});

test('copyMapText → parseMapText round-trips as an mmap payload', () => {
  const res = parseMapText(copyMapText(sample()), 'fallback');
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.payload.format, 'mmap');
  assert.equal(res.payload.nodes[0].id, 'root');
  assert.equal(res.data.arrows?.length, 2);
});

test('parseMapText: invalid text → error', () => {
  assert.equal(parseMapText('not json', 'f').ok, false);
});

test('graftMap: source root goes under parent with collision-free ids', () => {
  const res = graftMap(sample(), sample(), 'b');
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const b = res.data.nodeData.children?.[1];
  assert.equal(b?.children?.[0].id, res.rootId);
  assert.notEqual(res.rootId, 'root');
  assert.equal(res.data.arrows?.length, 4);
  const ids = JSON.stringify(res.data).match(/"id":"[^"]+"/g) ?? [];
  assert.equal(new Set(ids).size, ids.length);
});

test('graftMap: default parent is root; unknown parent fails', () => {
  const ok = graftMap(sample(), sample());
  assert.equal(ok.ok && ok.data.nodeData.children?.length, 3);
  assert.equal(graftMap(sample(), sample(), 'zzz').ok, false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-payload.test.ts`
Expected: FAIL — cannot find module `./mindmap-payload.ts`.

- [ ] **Step 3: Implement**

```ts
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { canHoldChildren, findNode, walkNodes } from './mindmap-gates.ts';
import { parseMindmap, sanitizeMindmapData, serializeMindmap } from './mindmap-format.ts';
import { prefixMindmapIds } from './mindmap-merge.ts';
import { payloadOf, type PastePayload } from './mindmap-paste.ts';

export type MapTextResult = { ok: true; data: MindElixirData; payload: PastePayload } | { ok: false; error: string };
export type GraftResult = { ok: true; data: MindElixirData; rootId: string } | { ok: false; error: string };

const GROUP_ROOT_ID = 'root';
const GRAFT_PREFIX = 'm';
const PREFIX_SEPARATOR = '-';
const PAD_WIDTH = 2;
const PAD_CHAR = '0';

function topMost(nodes: NodeObj[]): NodeObj[] {
  const inside = (n: NodeObj, other: NodeObj) => other !== n && walkNodes(other).includes(n);
  return nodes.filter((n) => !nodes.some((other) => inside(n, other)));
}

function idSet(nodes: readonly NodeObj[]): Set<string> {
  return new Set(nodes.flatMap((n) => walkNodes(n).map((x) => x.id)));
}

export function subtreeData(data: MindElixirData, nodeIds: readonly string[], groupTopic: string): MindElixirData | null {
  const found = nodeIds.map((id) => findNode(data.nodeData, id)).filter((n): n is NodeObj => n !== null);
  const picked = structuredClone(topMost(found));
  if (picked.length === 0) return null;
  const nodeData = picked.length === 1 ? picked[0] : { id: GROUP_ROOT_ID, topic: groupTopic, children: picked };
  const ids = idSet(picked);
  const arrows = (data.arrows ?? []).filter((a) => ids.has(a.from) && ids.has(a.to));
  const summaries = (data.summaries ?? []).filter((s) => ids.has(s.parent));
  return { nodeData, arrows, summaries };
}

export function parseMapText(text: string, fallbackTopic: string): MapTextResult {
  const parsed = parseMindmap(text, fallbackTopic);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, data: parsed.data, payload: payloadOf('mmap', parsed.data) };
}

export function copyMapText(data: MindElixirData): string {
  return serializeMindmap(sanitizeMindmapData(data));
}

function freePrefix(target: MindElixirData): string {
  const ids = walkNodes(target.nodeData).map((n) => n.id);
  for (let i = 1; ; i += 1) {
    const prefix = `${GRAFT_PREFIX}${String(i).padStart(PAD_WIDTH, PAD_CHAR)}${PREFIX_SEPARATOR}`;
    if (!ids.some((id) => id.startsWith(prefix))) return prefix;
  }
}

export function graftMap(target: MindElixirData, source: MindElixirData, parentId?: string): GraftResult {
  const copy = structuredClone(target);
  const parent = findNode(copy.nodeData, parentId ?? copy.nodeData.id);
  if (!parent) return { ok: false, error: `No node with id "${parentId}"` };
  if (!canHoldChildren(parent)) return { ok: false, error: `"${parent.topic}" is a gate and cannot hold children` };
  const grafted = prefixMindmapIds(sanitizeMindmapData(source), freePrefix(copy));
  parent.children = [...(parent.children ?? []), grafted.nodeData];
  copy.arrows = [...(copy.arrows ?? []), ...(grafted.arrows ?? [])];
  copy.summaries = [...(copy.summaries ?? []), ...(grafted.summaries ?? [])];
  return { ok: true, data: copy, rootId: grafted.nodeData.id };
}
```

- [ ] **Step 4: Run tests — expect PASS (7/7)**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-payload.test.ts`

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-payload.ts app/src/lib/mindmap-payload.test.ts
git commit -m "feat(mindmap): subtree payload, map-text parse and pure graft"
```

---

### Task 2: Shared insert path — root fallback + one undo step

**Files:**
- Modify: `app/src/lib/mindmap-batch.ts` (add async variant)
- Create: `app/src/lib/mindmap-insert.ts`
- Modify: `app/src/components/MindmapCanvas.vue:629-664` (`pasteTarget`, `insertPayload`, `onPaste`)
- Test: `app/src/lib/mindmap-batch.test.ts` (extend), `app/src/lib/mindmap-insert.test.ts`

**Interfaces:**
- Consumes: `OperationBus`, `runAsOneOperation` (existing).
- Produces:
  - `runAsOneOperationAsync(bus: OperationBus, work: () => Promise<boolean>, event: Record<string, unknown>): Promise<void>`
  - `type PasteMapTarget = 'selected' | 'root'`
  - `resolveInsertTargetId(selectedId: string | null, rootId: string, mode: PasteMapTarget): string`
  - Canvas-internal `insertPayloadAt(payload: PastePayload, mode: PasteMapTarget): Promise<boolean>` (used by Tasks 6, 7)

- [ ] **Step 1: Failing tests**

`mindmap-insert.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveInsertTargetId } from './mindmap-insert.ts';

test('selected mode uses selection', () => assert.equal(resolveInsertTargetId('n1', 'root', 'selected'), 'n1'));
test('selected mode without selection falls back to root', () => assert.equal(resolveInsertTargetId(null, 'root', 'selected'), 'root'));
test('root mode ignores selection', () => assert.equal(resolveInsertTargetId('n1', 'root', 'root'), 'root'));
```

Append to `mindmap-batch.test.ts`:

```ts
import { runAsOneOperationAsync } from './mindmap-batch.ts';

test('runAsOneOperationAsync emits exactly one operation for many inner ones', async () => {
  const fired: string[] = [];
  const bus = { fire: (name: string) => { fired.push(name); } };
  await runAsOneOperationAsync(bus, async () => {
    bus.fire('operation'); await Promise.resolve(); bus.fire('operation');
    return true;
  }, { name: 'pasteMap' });
  assert.deepEqual(fired, ['operation']);
});

test('runAsOneOperationAsync restores fire when work throws', async () => {
  const original = () => {};
  const bus = { fire: original };
  await assert.rejects(runAsOneOperationAsync(bus, async () => { throw new Error('x'); }, {}));
  assert.equal(bus.fire, original);
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-insert.test.ts src/lib/mindmap-batch.test.ts`

- [ ] **Step 3: Implement**

`mindmap-insert.ts`:

```ts
export type PasteMapTarget = 'selected' | 'root';

export function resolveInsertTargetId(selectedId: string | null, rootId: string, mode: PasteMapTarget): string {
  return mode === 'selected' && selectedId !== null ? selectedId : rootId;
}
```

Append to `mindmap-batch.ts`:

```ts
export async function runAsOneOperationAsync(bus: OperationBus, work: () => Promise<boolean>, event: Record<string, unknown>): Promise<void> {
  const fire = bus.fire;
  bus.fire = (name, ...args) => { if (name !== OPERATION_EVENT) fire.call(bus, name, ...args); };
  try {
    if (!(await work())) return;
  } finally {
    bus.fire = fire;
  }
  fire.call(bus, OPERATION_EVENT, event);
}
```

In `MindmapCanvas.vue`, replace `pasteTarget` / `insertPayload` / `onPaste` (lines 629-664) with:

```ts
const PASTE_MAP_OPERATION = 'pasteMap';

function insertTarget(mode: PasteMapTarget): Topic | null {
  if (!mind || isEditBlocked() || isGraphView.value) return null;
  const rootId = mind.nodeData.id;
  const id = resolveInsertTargetId(mind.currentNode?.nodeObj.id ?? null, rootId, mode);
  const target = mind.findEle(id);
  if (isGate(target.nodeObj)) {
    toasts.info(t('mindmap.gateCannotHoldChildren'));
    return null;
  }
  return target;
}

async function graftInto(instance: MindElixirInstance, target: Topic, payload: PastePayload): Promise<boolean> {
  const countBefore = target.nodeObj.children?.length ?? 0;
  await instance.copyNodes(payload.nodes.map((nodeObj) => ({ nodeObj }) as Topic), target);
  const children = target.nodeObj.children ?? [];
  if (children.length !== countBefore + payload.nodes.length) return false;
  const inserted = children.slice(countBefore);
  const idMap = buildIdMap(payload.nodes, inserted);
  remapGates(inserted, idMap);
  for (const arrow of remapArrows(payload.arrows, idMap)) instance.createArrowFrom(arrow);
  for (const summary of remapSummaries(payload.summaries, idMap)) instance.createSummaryFrom(summary);
  return true;
}

async function insertPayloadAt(payload: PastePayload, mode: PasteMapTarget): Promise<boolean> {
  const target = insertTarget(mode);
  if (!mind || !target) return false;
  const instance = mind;
  let isInserted = false;
  await runAsOneOperationAsync(instance.bus, async () => (isInserted = await graftInto(instance, target, payload)), { name: PASTE_MAP_OPERATION });
  gates.syncLabels();
  return isInserted;
}

function onPaste(e: ClipboardEvent): void {
  if (e.target instanceof HTMLElement && e.target.id === TOPIC_EDITOR_ID) return;
  if (!mind || isEditBlocked() || isGraphView.value) return;
  const result = parsePaste(e.clipboardData?.getData('text/plain') ?? '');
  e.preventDefault();
  if (!result.ok) {
    const key = PASTE_NOTICE_KEYS[result.reason];
    if (key) toasts.info(t(key));
    return;
  }
  void insertPayloadAt(result.payload, 'selected');
}
```

Imports to add: `runAsOneOperationAsync` from `../lib/mindmap-batch`, `resolveInsertTargetId, type PasteMapTarget` from `../lib/mindmap-insert`. Remove now-unused `COPY_NODES_OPERATION` / `OPERATION_EVENT` usages only if no other references remain (grep first). Remove the `mindmap.pasteSelectNode` toast usage (root fallback replaces it); leave the i18n key.

- [ ] **Step 4: Run unit tests — PASS; run build**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-insert.test.ts src/lib/mindmap-batch.test.ts && pnpm build`

- [ ] **Step 5: Manual undo check (browser, :1420)**

1. `preview_start {name: "solomd-web"}`, open a `.mmap` tab with an arrow between two nodes.
2. Copy an `.mmap` envelope (with an arrow) to clipboard, deselect all, ⌘V → lands under root.
3. ⌘Z once → map identical to before paste (nodes **and** arrow gone).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/mindmap-insert.ts app/src/lib/mindmap-insert.test.ts app/src/lib/mindmap-batch.ts app/src/lib/mindmap-batch.test.ts app/src/components/MindmapCanvas.vue
git commit -m "feat(mindmap): paste falls back to root and records one undo step"
```

---

### Task 3: Workbench state (pure lib + store)

**Files:**
- Create: `app/src/lib/mindmap-workbench.ts`, `app/src/stores/mindmapWorkbench.ts`
- Test: `app/src/lib/mindmap-workbench.test.ts`, `app/src/stores/mindmapWorkbench.test.ts`

**Interfaces:**
- Consumes: `subtreeData` (Task 1), `sanitizeMindmapData`, `isRecord` (`lib/mindmap-gates.ts`).
- Produces (lib):
  - `interface FileEntry { id: string; kind: 'file'; path: string; label: string; selected: boolean }`
  - `interface NodesEntry { id: string; kind: 'nodes'; sourcePath: string; nodeIds: string[]; label: string; snapshot: MindElixirData; capturedAt: string; selected: boolean }`
  - `type WorkbenchEntry = FileEntry | NodesEntry`; `type EntryDraft = Omit<FileEntry, 'id' | 'selected'> | Omit<NodesEntry, 'id' | 'selected'>`
  - `type Staleness = 'fresh' | 'stale' | 'missing'`
  - `entryKey(e: EntryDraft | WorkbenchEntry): string`
  - `upsertEntry(entries: readonly WorkbenchEntry[], draft: EntryDraft, newId: string): { entries: WorkbenchEntry[]; status: 'added' | 'updated' }`
  - `removeEntries(entries: readonly WorkbenchEntry[], ids: ReadonlySet<string>): WorkbenchEntry[]`
  - `parseWorkbench(raw: unknown): WorkbenchEntry[]`
  - `nodesStaleness(entry: NodesEntry, source: MindElixirData | null): Staleness`
  - `defaultMergeTopic(labels: readonly string[]): string`
  - `TAB_SOURCE_PREFIX = 'tab:'`
- Produces (store `useMindmapWorkbenchStore`): state `entries: WorkbenchEntry[]`; getters `selectedEntries`; actions `add(draft): 'added' | 'updated'`, `has(key: string): boolean`, `removeKey(key)`, `removeSelected()`, `toggle(id)`, `setAll(selected: boolean)`, `replaceSnapshot(id, snapshot: MindElixirData)`.

- [ ] **Step 1: Failing lib tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { defaultMergeTopic, entryKey, nodesStaleness, parseWorkbench, removeEntries, upsertEntry, type EntryDraft, type NodesEntry } from './mindmap-workbench.ts';

const map = (topic = 'A'): MindElixirData => ({ nodeData: { id: 'root', topic, children: [{ id: 'n', topic: 'N' }] } });
const fileDraft: EntryDraft = { kind: 'file', path: '/w/a.mmap', label: 'a' };
const nodesDraft = (snapshot = map()): EntryDraft => ({ kind: 'nodes', sourcePath: '/w/a.mmap', nodeIds: ['n'], label: 'a › N', snapshot, capturedAt: '2026-10-21T12:00:00Z' });

test('upsert adds selected; re-add updates in place and keeps selection', () => {
  const first = upsertEntry([], fileDraft, 'e1');
  assert.equal(first.status, 'added');
  assert.equal(first.entries[0].selected, true);
  const off = first.entries.map((e) => ({ ...e, selected: false }));
  const again = upsertEntry(off, { ...fileDraft, label: 'renamed' }, 'e2');
  assert.equal(again.status, 'updated');
  assert.equal(again.entries.length, 1);
  assert.equal(again.entries[0].id, 'e1');
  assert.equal(again.entries[0].selected, false);
  assert.equal(again.entries[0].label, 'renamed');
});

test('entryKey: node order does not matter; file vs nodes differ', () => {
  const a = entryKey({ ...(nodesDraft() as NodesEntry), nodeIds: ['x', 'y'] });
  const b = entryKey({ ...(nodesDraft() as NodesEntry), nodeIds: ['y', 'x'] });
  assert.equal(a, b);
  assert.notEqual(entryKey(fileDraft), a);
});

test('removeEntries drops by id', () => {
  const { entries } = upsertEntry([], fileDraft, 'e1');
  assert.deepEqual(removeEntries(entries, new Set(['e1'])), []);
});

test('parseWorkbench drops invalid rows and non-arrays', () => {
  const good = upsertEntry([], fileDraft, 'e1').entries;
  assert.deepEqual(parseWorkbench([...good, { kind: 'file' }, 42]), good);
  assert.deepEqual(parseWorkbench({}), []);
});

test('nodesStaleness: fresh / stale / missing', () => {
  const entry = { ...(nodesDraft(map()) as NodesEntry), id: 'e', selected: true, snapshot: { nodeData: { id: 'n', topic: 'N' }, arrows: [], summaries: [] } };
  assert.equal(nodesStaleness(entry, map()), 'fresh');
  const changed = map(); changed.nodeData.children![0].topic = 'N2';
  assert.equal(nodesStaleness(entry, changed), 'stale');
  assert.equal(nodesStaleness(entry, null), 'missing');
  assert.equal(nodesStaleness(entry, { nodeData: { id: 'root', topic: 'R' } }), 'missing');
});

test('defaultMergeTopic joins labels', () => assert.equal(defaultMergeTopic(['a', 'b']), 'a + b'));
```

- [ ] **Step 2: Run — FAIL**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-workbench.test.ts`

- [ ] **Step 3: Implement lib**

```ts
import type { MindElixirData } from 'mind-elixir';
import { isRecord } from './mindmap-gates.ts';
import { sanitizeMindmapData } from './mindmap-format.ts';
import { subtreeData } from './mindmap-payload.ts';

export interface FileEntry { id: string; kind: 'file'; path: string; label: string; selected: boolean }
export interface NodesEntry { id: string; kind: 'nodes'; sourcePath: string; nodeIds: string[]; label: string; snapshot: MindElixirData; capturedAt: string; selected: boolean }
export type WorkbenchEntry = FileEntry | NodesEntry;
export type EntryDraft = Omit<FileEntry, 'id' | 'selected'> | Omit<NodesEntry, 'id' | 'selected'>;
export type Staleness = 'fresh' | 'stale' | 'missing';

export const TAB_SOURCE_PREFIX = 'tab:';
const KEY_SEPARATOR = '#';
const ID_SEPARATOR = ',';
const TOPIC_JOINER = ' + ';

export function entryKey(e: EntryDraft | WorkbenchEntry): string {
  if (e.kind === 'file') return `file${KEY_SEPARATOR}${e.path}`;
  return `nodes${KEY_SEPARATOR}${e.sourcePath}${KEY_SEPARATOR}${[...e.nodeIds].sort().join(ID_SEPARATOR)}`;
}

export function upsertEntry(entries: readonly WorkbenchEntry[], draft: EntryDraft, newId: string): { entries: WorkbenchEntry[]; status: 'added' | 'updated' } {
  const key = entryKey(draft);
  const index = entries.findIndex((e) => entryKey(e) === key);
  if (index < 0) return { entries: [...entries, { ...draft, id: newId, selected: true } as WorkbenchEntry], status: 'added' };
  const current = entries[index];
  const next = [...entries];
  next[index] = { ...draft, id: current.id, selected: current.selected } as WorkbenchEntry;
  return { entries: next, status: 'updated' };
}

export function removeEntries(entries: readonly WorkbenchEntry[], ids: ReadonlySet<string>): WorkbenchEntry[] {
  return entries.filter((e) => !ids.has(e.id));
}

const isString = (v: unknown): v is string => typeof v === 'string';

function parseEntry(raw: unknown): WorkbenchEntry | null {
  if (!isRecord(raw) || !isString(raw.id) || !isString(raw.label) || typeof raw.selected !== 'boolean') return null;
  const base = { id: raw.id, label: raw.label, selected: raw.selected };
  if (raw.kind === 'file' && isString(raw.path)) return { ...base, kind: 'file', path: raw.path };
  const isNodes = raw.kind === 'nodes' && isString(raw.sourcePath) && isString(raw.capturedAt)
    && Array.isArray(raw.nodeIds) && raw.nodeIds.every(isString) && isRecord(raw.snapshot) && isRecord(raw.snapshot.nodeData);
  if (!isNodes) return null;
  const snapshot = sanitizeMindmapData(raw.snapshot as unknown as MindElixirData);
  return { ...base, kind: 'nodes', sourcePath: raw.sourcePath as string, nodeIds: raw.nodeIds as string[], snapshot, capturedAt: raw.capturedAt as string };
}

export function parseWorkbench(raw: unknown): WorkbenchEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseEntry).filter((e): e is WorkbenchEntry => e !== null);
}

export function nodesStaleness(entry: NodesEntry, source: MindElixirData | null): Staleness {
  const current = source ? subtreeData(source, entry.nodeIds, entry.snapshot.nodeData.topic) : null;
  if (!current) return 'missing';
  return JSON.stringify(current) === JSON.stringify(entry.snapshot) ? 'fresh' : 'stale';
}

export function defaultMergeTopic(labels: readonly string[]): string {
  return labels.join(TOPIC_JOINER);
}
```

> Note: `subtreeData` always returns `arrows`/`summaries` arrays, so snapshots must be captured with `subtreeData` too (Task 4 does this) for the JSON comparison to be stable. If `isRecord` is not exported from `mindmap-gates.ts`, `mindmap-merge.ts` already imports it from there — verify with `grep -n "export function isRecord" app/src/lib/mindmap-gates.ts`.

- [ ] **Step 4: Lib tests PASS (6/6)**

- [ ] **Step 5: Store + test**

`stores/mindmapWorkbench.ts`:

```ts
import { defineStore } from 'pinia';
import type { MindElixirData } from 'mind-elixir';
import { entryKey, parseWorkbench, removeEntries, upsertEntry, type EntryDraft, type WorkbenchEntry } from '../lib/mindmap-workbench';

const LS_KEY = 'solomd.mindmapWorkbench.v1';
const ID_PREFIX = 'wb-';

function storage(): Storage | null {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

function load(): WorkbenchEntry[] {
  try {
    return parseWorkbench(JSON.parse(storage()?.getItem(LS_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

export const useMindmapWorkbenchStore = defineStore('mindmapWorkbench', {
  state: () => ({ entries: load() }),
  getters: {
    selectedEntries: (s): WorkbenchEntry[] => s.entries.filter((e) => e.selected),
  },
  actions: {
    persist(): void { storage()?.setItem(LS_KEY, JSON.stringify(this.entries)); },
    add(draft: EntryDraft): 'added' | 'updated' {
      const res = upsertEntry(this.entries, draft, `${ID_PREFIX}${crypto.randomUUID()}`);
      this.entries = res.entries;
      this.persist();
      return res.status;
    },
    has(key: string): boolean { return this.entries.some((e) => entryKey(e) === key); },
    removeKey(key: string): void {
      this.entries = this.entries.filter((e) => entryKey(e) !== key);
      this.persist();
    },
    removeSelected(): void {
      this.entries = removeEntries(this.entries, new Set(this.selectedEntries.map((e) => e.id)));
      this.persist();
    },
    toggle(id: string): void {
      this.entries = this.entries.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e));
      this.persist();
    },
    setAll(selected: boolean): void {
      this.entries = this.entries.map((e) => ({ ...e, selected }));
      this.persist();
    },
    replaceSnapshot(id: string, snapshot: MindElixirData): void {
      const capturedAt = new Date().toISOString();
      this.entries = this.entries.map((e) => (e.id === id && e.kind === 'nodes' ? { ...e, snapshot, capturedAt } : e));
      this.persist();
    },
  },
});
```

`stores/mindmapWorkbench.test.ts`:

```ts
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';

const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(), key: () => null, length: 0,
} as Storage;

const { useMindmapWorkbenchStore } = await import('./mindmapWorkbench.ts');

beforeEach(() => { mem.clear(); setActivePinia(createPinia()); });

test('add persists and survives a fresh store', () => {
  useMindmapWorkbenchStore().add({ kind: 'file', path: '/a.mmap', label: 'a' });
  setActivePinia(createPinia());
  assert.equal(useMindmapWorkbenchStore().entries.length, 1);
});

test('selection is preserved across reload; removeSelected removes only checked', () => {
  const s = useMindmapWorkbenchStore();
  s.add({ kind: 'file', path: '/a.mmap', label: 'a' });
  s.add({ kind: 'file', path: '/b.mmap', label: 'b' });
  s.toggle(s.entries[0].id);
  setActivePinia(createPinia());
  const r = useMindmapWorkbenchStore();
  assert.deepEqual(r.entries.map((e) => e.selected), [false, true]);
  r.removeSelected();
  assert.deepEqual(r.entries.map((e) => e.label), ['a']);
});

test('corrupt storage → empty workbench', () => {
  mem.set('solomd.mindmapWorkbench.v1', '{nope');
  assert.deepEqual(useMindmapWorkbenchStore().entries, []);
});
```

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-workbench.test.ts src/stores/mindmapWorkbench.test.ts` → PASS (9/9).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/mindmap-workbench.ts app/src/lib/mindmap-workbench.test.ts app/src/stores/mindmapWorkbench.ts app/src/stores/mindmapWorkbench.test.ts
git commit -m "feat(mindmap): workbench state with persisted selection and staleness"
```

---

### Task 4: Workbench composable — source reading, resolve, merge → save

**Files:**
- Create: `app/src/composables/useMindmapWorkbench.ts`
- Modify: `app/src/composables/useFiles.ts` (add `saveTabAs` to the returned object near line 988)
- Modify: `app/src/i18n/en.ts` (keys below, under the `mindmap` block next to `pasteSelectNode`)

**Interfaces:**
- Consumes: store (Task 3), `subtreeData`, `parseMapText`, `copyMapText` (Task 1), `mergeMindmaps` (`lib/mindmap-merge.ts`), `sanitizeMindmapData`, `serializeMindmap`, `rootTopicFromFileName`, `isMindmapPath` (`lib/mindmap-format.ts`), `useTabsStore`, `useFiles().saveTabAs`, `invoke<FileReadResult>('read_file', { path })`.
- Produces:
  - `MINDMAP_WORKBENCH_EVENT = 'solomd:mindmap-workbench'`, `MINDMAP_WORKBENCH_ACTION = 'mindmap.workbench'`
  - `interface WorkbenchOpenDetail { autoAdd?: EntryDraft }`
  - `openWorkbench(autoAdd?: EntryDraft): void`
  - `fileDraft(path: string): EntryDraft`
  - `nodesDraft(sourcePath: string, data: MindElixirData, nodeIds: string[], sourceLabel: string): EntryDraft | null`
  - `useMindmapWorkbench()` → `{ readSource(path: string): Promise<MindElixirData | null>, resolveEntry(e: WorkbenchEntry): Promise<MindElixirData | null>, staleness(e: WorkbenchEntry): Promise<Staleness | null>, refreshEntry(e: NodesEntry): Promise<boolean>, mergeSelected(rootTopic: string): Promise<boolean> }`

i18n keys (`en.ts`, `mindmap:` block):

```ts
workbench: 'Mindmap Workbench',
workbenchAddMap: 'Add map…',
workbenchRemoveSelected: 'Remove selected',
workbenchRefreshSelected: 'Refresh selected',
workbenchMergeSelected: 'Merge selected…',
workbenchRootTopic: 'Root topic',
workbenchSelectedCount: '{selected} of {total} selected',
workbenchEmpty: 'No maps yet. Use “Add map…” or right-click a map.',
workbenchMergeNeedsTwo: 'Select at least 2 available maps to merge',
workbenchMissing: 'Missing',
workbenchStale: 'Changed since added',
workbenchSkipped: 'Skipped (not found): {names}',
workbenchAdded: 'Added to workbench',
workbenchUpdated: 'Workbench entry updated',
workbenchRemoved: 'Removed from workbench',
menuAddToWorkbench: 'Add to workbench',
menuRemoveFromWorkbench: 'Remove from workbench',
menuOpenWorkbench: 'Open workbench',
menuCopyMap: 'Copy map',
menuPasteMap: 'Paste map',
mapCopied: 'Map copied',
pasteMapTitle: 'Paste map where?',
pasteMapIntoSelected: 'Into selected node',
pasteMapIntoRoot: 'Into root',
pasteMapRemember: 'Remember my choice',
```

Also `cmd.mindmap.workbench: 'Mindmap: Open Workbench'` in the `cmd` block, and settings keys in Task 7.

- [ ] **Step 1: Export `saveTabAs`**

In `useFiles.ts` return object (line ~988) add `saveTabAs,` next to `saveTab,`.

- [ ] **Step 2: Implement composable**

```ts
import { invoke } from '@tauri-apps/api/core';
import type { MindElixirData } from 'mind-elixir';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useMindmapWorkbenchStore } from '../stores/mindmapWorkbench';
import { useFiles } from './useFiles';
import { useI18n } from '../i18n';
import type { FileReadResult } from '../types';
import { mergeMindmaps } from '../lib/mindmap-merge';
import { rootTopicFromFileName, sanitizeMindmapData, serializeMindmap } from '../lib/mindmap-format';
import { parseMapText, subtreeData } from '../lib/mindmap-payload';
import { nodesStaleness, TAB_SOURCE_PREFIX, type EntryDraft, type NodesEntry, type Staleness, type WorkbenchEntry } from '../lib/mindmap-workbench';

export const MINDMAP_WORKBENCH_EVENT = 'solomd:mindmap-workbench';
export const MINDMAP_WORKBENCH_ACTION = 'mindmap.workbench';
export interface WorkbenchOpenDetail { autoAdd?: EntryDraft }

const MINDMAP_LANGUAGE = 'mindmap';
const MMAP_SUFFIX = '.mmap';
const LABEL_SEPARATOR = ' › ';
const UNSAFE_FILE_CHARS = /[\\/:*?"<>|]+/gu;
const NAMES_JOINER = ', ';

export function openWorkbench(autoAdd?: EntryDraft): void {
  window.dispatchEvent(new CustomEvent<WorkbenchOpenDetail>(MINDMAP_WORKBENCH_EVENT, { detail: { autoAdd } }));
}

export function fileDraft(path: string): EntryDraft {
  return { kind: 'file', path, label: rootTopicFromFileName(path) };
}

export function nodesDraft(sourcePath: string, data: MindElixirData, nodeIds: string[], sourceLabel: string): EntryDraft | null {
  const snapshot = subtreeData(data, nodeIds, sourceLabel);
  if (!snapshot) return null;
  const label = `${sourceLabel}${LABEL_SEPARATOR}${snapshot.nodeData.topic}`;
  return { kind: 'nodes', sourcePath, nodeIds, label, snapshot, capturedAt: new Date().toISOString() };
}

export function useMindmapWorkbench() {
  const tabs = useTabsStore();
  const toasts = useToastsStore();
  const store = useMindmapWorkbenchStore();
  const { saveTabAs } = useFiles();
  const { t } = useI18n();

  async function readText(path: string): Promise<string | null> {
    const tab = path.startsWith(TAB_SOURCE_PREFIX)
      ? tabs.tabs.find((x) => x.id === path.slice(TAB_SOURCE_PREFIX.length))
      : tabs.tabs.find((x) => x.filePath === path);
    if (tab) return tab.content;
    if (path.startsWith(TAB_SOURCE_PREFIX)) return null;
    return invoke<FileReadResult>('read_file', { path }).then((r) => r.content, () => null);
  }

  async function readSource(path: string): Promise<MindElixirData | null> {
    const text = await readText(path);
    if (text === null) return null;
    const parsed = parseMapText(text, rootTopicFromFileName(path));
    return parsed.ok ? parsed.data : null;
  }

  const resolveEntry = (e: WorkbenchEntry): Promise<MindElixirData | null> =>
    e.kind === 'file' ? readSource(e.path) : Promise.resolve(e.snapshot);

  async function staleness(e: WorkbenchEntry): Promise<Staleness | null> {
    if (e.kind === 'file') return (await readSource(e.path)) ? null : 'missing';
    return nodesStaleness(e, await readSource(e.sourcePath));
  }

  async function refreshEntry(e: NodesEntry): Promise<boolean> {
    const source = await readSource(e.sourcePath);
    const snapshot = source ? subtreeData(source, e.nodeIds, e.snapshot.nodeData.topic) : null;
    if (snapshot) store.replaceSnapshot(e.id, snapshot);
    return snapshot !== null;
  }

  async function mergeSelected(rootTopic: string): Promise<boolean> {
    const picked = store.selectedEntries;
    const resolved = await Promise.all(picked.map(resolveEntry));
    const missing = picked.filter((_, i) => resolved[i] === null).map((e) => e.label);
    const maps = resolved.filter((d): d is MindElixirData => d !== null);
    if (missing.length > 0) toasts.info(t('mindmap.workbenchSkipped', { names: missing.join(NAMES_JOINER) }));
    if (maps.length < 2) {
      toasts.info(t('mindmap.workbenchMergeNeedsTwo'));
      return false;
    }
    const merged = sanitizeMindmapData(mergeMindmaps(rootTopic, maps.map((data) => ({ data }))));
    const tab = tabs.newTab({ fileName: `${rootTopic.replace(UNSAFE_FILE_CHARS, '-')}${MMAP_SUFFIX}`, language: MINDMAP_LANGUAGE });
    tabs.setContent(tab.id, serializeMindmap(merged));
    const isSaved = await saveTabAs(tabs.tabs.find((x) => x.id === tab.id) ?? tab);
    if (!isSaved) tabs.closeTab(tab.id);
    return isSaved;
  }

  return { readSource, resolveEntry, staleness, refreshEntry, mergeSelected };
}
```

> Verify before writing: `useTabsStore().tabs` is the array name (`grep -n "tabs: \[\]\|state: ()" app/src/stores/tabs.ts`); `invoke` import path matches `useFiles.ts`; `t()` supports `{name}` interpolation (`grep -n "interpolate\|replace(/{" app/src/i18n/index.ts`). `closeTab` on a dirty tab may prompt — if so use the non-prompting variant the store exposes (check `tabs.ts:364`).

- [ ] **Step 3: Build**

Run: `pnpm --dir app build` → PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/composables/useMindmapWorkbench.ts app/src/composables/useFiles.ts app/src/i18n/en.ts
git commit -m "feat(mindmap): workbench source resolution and merge-to-saved-file"
```

---

### Task 5: Workbench form + command

**Files:**
- Create: `app/src/components/MindmapWorkbench.vue`
- Modify: `app/src/App.vue` (import + mount next to `<MindmapConvertFolder />` at line ~2172)
- Modify: `app/src/composables/useCommands.ts` (command next to `mindmapFolderCommand`, line ~176, and add it to the exported command list where `mindmapFolderCommand` is listed)
- Modify: `app/src/lib/keybindings.ts:183` (registry row)

**Interfaces:**
- Consumes: `MINDMAP_WORKBENCH_EVENT`, `WorkbenchOpenDetail`, `useMindmapWorkbench`, `fileDraft` (Task 4); store (Task 3); `defaultMergeTopic`.
- Produces: none for later tasks (UI leaf).

- [ ] **Step 1: Command + keybinding row**

`keybindings.ts` after line 183:

```ts
  { id: 'mindmap.workbench', label: 'Mindmap: Open Workbench', category: 'tools', defaults: [] },
```

`useCommands.ts`:

```ts
  const mindmapWorkbenchCommand: Command = {
    id: MINDMAP_WORKBENCH_ACTION,
    title: t('cmd.mindmap.workbench'),
    shortcut: kb(MINDMAP_WORKBENCH_ACTION),
    run: () => openWorkbench(),
  };
```

- [ ] **Step 2: Component** (follow `MindmapConvertFolder.vue` markup/CSS classes for the modal shell; copy its `<template>` overlay + dialog wrapper and `<style>` block, renaming the root class to `mindmap-workbench`)

```vue
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { useI18n } from '../i18n';
import { useToastsStore } from '../stores/toasts';
import { useMindmapWorkbenchStore } from '../stores/mindmapWorkbench';
import { fileDraft, MINDMAP_WORKBENCH_EVENT, useMindmapWorkbench, type WorkbenchOpenDetail } from '../composables/useMindmapWorkbench';
import { defaultMergeTopic, type Staleness } from '../lib/mindmap-workbench';

const ESCAPE_KEY = 'Escape';
const MMAP_FILTER = [{ name: 'Mind map', extensions: ['mmap'] }];
const MIN_MERGE = 2;

const { t } = useI18n();
const toasts = useToastsStore();
const store = useMindmapWorkbenchStore();
const { staleness, refreshEntry, mergeSelected } = useMindmapWorkbench();

const isOpen = ref(false);
const isBusy = ref(false);
const status = ref<Record<string, Staleness | null>>({});
const rootTopic = ref('');
const dialogEl = ref<HTMLElement | null>(null);

const selectedCount = computed(() => store.selectedEntries.length);
const mergeable = computed(() => store.selectedEntries.filter((e) => status.value[e.id] !== 'missing').length);
const canMerge = computed(() => mergeable.value >= MIN_MERGE && !isBusy.value && rootTopic.value.trim() !== '');

async function refreshStatus(): Promise<void> {
  const pairs = await Promise.all(store.entries.map(async (e) => [e.id, await staleness(e)] as const));
  status.value = Object.fromEntries(pairs);
  rootTopic.value = defaultMergeTopic(store.selectedEntries.map((e) => e.label));
}

function announce(result: 'added' | 'updated'): void {
  toasts.success(t(result === 'added' ? 'mindmap.workbenchAdded' : 'mindmap.workbenchUpdated'));
}

async function onOpen(e: Event): Promise<void> {
  const draft = (e as CustomEvent<WorkbenchOpenDetail>).detail?.autoAdd;
  if (draft) announce(store.add(draft));
  isOpen.value = true;
  await refreshStatus();
  await nextTick();
  dialogEl.value?.focus();
}

async function addMaps(): Promise<void> {
  const picked = await openFileDialog({ multiple: true, filters: MMAP_FILTER });
  const paths = Array.isArray(picked) ? picked : picked ? [picked] : [];
  for (const path of paths) store.add(fileDraft(path));
  await refreshStatus();
}

async function refreshSelected(): Promise<void> {
  isBusy.value = true;
  try {
    for (const e of store.selectedEntries) if (e.kind === 'nodes') await refreshEntry(e);
    await refreshStatus();
  } finally {
    isBusy.value = false;
  }
}

async function merge(): Promise<void> {
  isBusy.value = true;
  try {
    if (await mergeSelected(rootTopic.value.trim())) isOpen.value = false;
  } finally {
    isBusy.value = false;
  }
}

function closeOnEscape(e: KeyboardEvent): void {
  if (!isOpen.value || e.key !== ESCAPE_KEY) return;
  e.preventDefault();
  isOpen.value = false;
}

onMounted(() => {
  window.addEventListener(MINDMAP_WORKBENCH_EVENT, onOpen);
  window.addEventListener('keydown', closeOnEscape, true);
});
onBeforeUnmount(() => {
  window.removeEventListener(MINDMAP_WORKBENCH_EVENT, onOpen);
  window.removeEventListener('keydown', closeOnEscape, true);
});
</script>

<template>
  <div v-if="isOpen" class="mindmap-workbench__overlay" @click.self="isOpen = false">
    <div ref="dialogEl" class="mindmap-workbench" role="dialog" aria-modal="true" :aria-label="t('mindmap.workbench')" tabindex="-1">
      <h2>{{ t('mindmap.workbench') }}</h2>
      <div class="mindmap-workbench__bar">
        <button type="button" @click="store.setAll(true)">✓</button>
        <button type="button" @click="store.setAll(false)">✗</button>
        <span>{{ t('mindmap.workbenchSelectedCount', { selected: String(selectedCount), total: String(store.entries.length) }) }}</span>
      </div>
      <p v-if="store.entries.length === 0" class="mindmap-workbench__empty">{{ t('mindmap.workbenchEmpty') }}</p>
      <ul v-else class="mindmap-workbench__list">
        <li v-for="e in store.entries" :key="e.id">
          <label>
            <input type="checkbox" :checked="e.selected" @change="store.toggle(e.id)" />
            <span>{{ e.kind === 'file' ? '🗺' : '🌿' }} {{ e.label }}</span>
            <span v-if="status[e.id] === 'missing'" class="mindmap-workbench__badge">{{ t('mindmap.workbenchMissing') }}</span>
            <span v-else-if="status[e.id] === 'stale'" class="mindmap-workbench__badge">{{ t('mindmap.workbenchStale') }}</span>
          </label>
        </li>
      </ul>
      <label class="mindmap-workbench__topic">
        {{ t('mindmap.workbenchRootTopic') }}
        <input v-model="rootTopic" type="text" />
      </label>
      <div class="mindmap-workbench__actions">
        <button type="button" @click="addMaps">{{ t('mindmap.workbenchAddMap') }}</button>
        <button type="button" :disabled="selectedCount === 0" @click="store.removeSelected(); refreshStatus()">{{ t('mindmap.workbenchRemoveSelected') }}</button>
        <button type="button" :disabled="selectedCount === 0 || isBusy" @click="refreshSelected">{{ t('mindmap.workbenchRefreshSelected') }}</button>
        <button type="button" class="primary" :disabled="!canMerge" :title="canMerge ? '' : t('mindmap.workbenchMergeNeedsTwo')" @click="merge">{{ t('mindmap.workbenchMergeSelected') }}</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Mount** — `App.vue`: `import MindmapWorkbench from './components/MindmapWorkbench.vue';` and `<MindmapWorkbench />` after `<MindmapConvertFolder />`.

- [ ] **Step 4: Build + browser check**

Run: `pnpm --dir app build`. Then on :1420: command palette → "Mindmap: Open Workbench" → empty state shown; **nothing auto-added**.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/MindmapWorkbench.vue app/src/App.vue app/src/composables/useCommands.ts app/src/lib/keybindings.ts
git commit -m "feat(mindmap): workbench form with add/remove/refresh/merge"
```

---

### Task 6: Context menus — canvas (background + nodes) and file explorer

**Files:**
- Modify: `app/src/components/MindmapCanvas.vue` (new prop `sourcePath?: string`; extend menu at line 180)
- Modify: `app/src/components/MindmapView.vue:397` (pass `:source-path="tab.filePath ?? 'tab:' + tab.id"` and `:source-label="exportName"`)
- Modify: `app/src/components/FileTree.vue:1754` (items for `.mmap` files)

**Interfaces:**
- Consumes: `openWorkbench`, `fileDraft`, `nodesDraft` (Task 4); store `has/add/removeKey` (Task 3); `entryKey`; `copyMapText`, `parseMapText` (Task 1); `insertPayloadAt` (Task 2); `writeText`/`readText` from `@tauri-apps/plugin-clipboard-manager`; `isMindmapPath`, `isXmindPath`.
- Produces: canvas-internal `pasteMapFromClipboard(): Promise<void>` (Task 7 routes it through the dialog).

Behaviour matrix (spec §5):

| Surface | Workbench draft | Copy map | Paste map |
|---|---|---|---|
| Canvas, background / root selected | `fileDraft(sourcePath)` (disabled when `sourcePath` starts with `tab:`) | whole map | ✓ |
| Canvas, node(s) selected (not root) | `nodesDraft(sourcePath, data, ids, label)` | selected subtrees via `subtreeData` | ✓ |
| File explorer, `.mmap` file | `fileDraft(node.path)` | reads file → `copyMapText` | — |

- [ ] **Step 1: Canvas props + helpers**

Add to `defineProps`: `sourcePath?: string; sourceLabel?: string`. Add:

```ts
const MENU_GROUP_TOPIC = 'Selection';

function menuDraft(): EntryDraft | null {
  if (!mind || !props.sourcePath) return null;
  const ids = (mind.currentNodes ?? []).map((tpc) => tpc.nodeObj.id).filter((id) => id !== mind!.nodeData.id);
  if (ids.length === 0) return props.sourcePath.startsWith(TAB_SOURCE_PREFIX) ? null : fileDraft(props.sourcePath);
  return nodesDraft(props.sourcePath, mind.getData(), ids, props.sourceLabel ?? props.exportName);
}

function toggleWorkbench(): void {
  const draft = menuDraft();
  if (!draft) return;
  const key = entryKey(draft);
  if (workbench.has(key)) {
    workbench.removeKey(key);
    toasts.success(t('mindmap.workbenchRemoved'));
  } else {
    workbench.add(draft);
    toasts.success(t('mindmap.workbenchAdded'));
  }
}

async function copyMap(): Promise<void> {
  if (!mind) return;
  const ids = (mind.currentNodes ?? []).map((tpc) => tpc.nodeObj.id).filter((id) => id !== mind!.nodeData.id);
  const data = ids.length === 0 ? mind.getData() : subtreeData(mind.getData(), ids, MENU_GROUP_TOPIC);
  if (!data) return;
  await writeText(copyMapText(withoutGateArrows(data)));
  toasts.success(t('mindmap.mapCopied'));
}

async function pasteMapFromClipboard(): Promise<void> {
  const result = parsePaste((await readText()) ?? '');
  if (!result.ok) {
    const key = PASTE_NOTICE_KEYS[result.reason];
    if (key) toasts.info(t(key));
    return;
  }
  await insertPayloadAt(result.payload, 'selected');
}
```

> `withoutGateArrows` lives in `lib/mindmap-graph.ts` (used by `useMindmapCanvasActions.ts`). The mind-elixir menu is built once, so the add/remove label cannot flip at open time: use a single item labelled `menuAddToWorkbench` whose action toggles and toasts the outcome — **or** rebuild `extend` on `contextmenu` if mind-elixir exposes it (check `node_modules/mind-elixir/dist/types/plugin/contextMenu.d.ts`). Prefer the label flip if the type file shows `extend` is read per open; otherwise toggle + toast.

- [ ] **Step 2: Extend menu (line 180)**

```ts
const workbenchMenu = [
  { name: t('mindmap.menuAddToWorkbench'), onclick: toggleWorkbench },
  { name: t('mindmap.menuOpenWorkbench'), onclick: () => { const d = menuDraft(); openWorkbench(d && !workbench.has(entryKey(d)) ? d : undefined); } },
  { name: t('mindmap.menuCopyMap'), onclick: () => { void copyMap().catch((e: unknown) => toasts.error(String(e))); } },
  { name: t('mindmap.menuPasteMap'), onclick: () => { void pasteMapFromClipboard(); } },
];
```

Append `...workbenchMenu` inside the existing `closingMenuItems([...])` array.

- [ ] **Step 3: MindmapView prop pass-through** (line 397 block): add `:source-path="tab.filePath ?? \`tab:${tab.id}\`"` and `:source-label="exportName"`.

- [ ] **Step 4: FileTree items** after the `copyGitUrl` button (line ~1760):

```vue
<template v-if="ctx.node && !ctx.node.is_dir && isMmap(ctx.node.path)">
  <div class="ftree__ctx-sep"></div>
  <button class="ftree__ctx-item" @click="toggleWorkbenchFile(ctx.node.path)">
    {{ workbench.has(entryKey(fileDraft(ctx.node.path))) ? t('mindmap.menuRemoveFromWorkbench') : t('mindmap.menuAddToWorkbench') }}
  </button>
  <button class="ftree__ctx-item" @click="openWorkbenchWith(ctx.node.path)">{{ t('mindmap.menuOpenWorkbench') }}</button>
  <button class="ftree__ctx-item" @click="copyMapFile(ctx.node.path)">{{ t('mindmap.menuCopyMap') }}</button>
</template>
```

Script (FileTree uses Options-API-style `setup` — match the surrounding style; check how `copyNodePath` is defined and closes the menu, and do the same):

```ts
const isMmap = (path: string): boolean => isMindmapPath(path) && !isXmindPath(path);

function toggleWorkbenchFile(path: string): void {
  const key = entryKey(fileDraft(path));
  if (workbench.has(key)) workbench.removeKey(key); else workbench.add(fileDraft(path));
  closeCtx();
}

function openWorkbenchWith(path: string): void {
  const draft = fileDraft(path);
  openWorkbench(workbench.has(entryKey(draft)) ? undefined : draft);
  closeCtx();
}

async function copyMapFile(path: string): Promise<void> {
  closeCtx();
  const data = await readSource(path);
  if (!data) { toasts.error(t('mindmap.workbenchMissing')); return; }
  await writeText(copyMapText(data));
  toasts.success(t('mindmap.mapCopied'));
}
```

(`readSource` from `useMindmapWorkbench()`; `closeCtx` = whatever FileTree's existing close function is named — `grep -n "ctx.value = null\|function closeCtx\|ctx.visible = false" app/src/components/FileTree.vue`.)

- [ ] **Step 5: Build + browser check (:1420)**

1. Right-click `.mmap` in explorer → *Add to workbench*; right-click again → label reads *Remove from workbench*.
2. In a map tab: select 2 nodes → right-click → *Open workbench* → form lists the file entry + a `🌿 name › Selection` entry, both checked.
3. Edit one of those nodes, reopen workbench → *Changed since added* badge; *Refresh selected* clears it.
4. *Copy map* on a node → paste into another map → subtree appears.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/MindmapCanvas.vue app/src/components/MindmapView.vue app/src/components/FileTree.vue
git commit -m "feat(mindmap): workbench, copy-map and paste-map context menu items"
```

---

### Task 7: ⌘V target dialog + setting

**Files:**
- Create: `app/src/components/MindmapPasteTargetDialog.vue`
- Modify: `app/src/stores/settings.ts` (field at ~271, default at ~682, normalize at ~791, setter near 1416)
- Modify: `app/src/components/SettingsPanel.vue:782` (select + reset)
- Modify: `app/src/components/MindmapCanvas.vue` (`onPaste`, `pasteMapFromClipboard` route through dialog)
- Modify: `app/src/i18n/en.ts` (settings keys)
- Test: `app/src/lib/mindmap-insert.test.ts` (extend)

**Interfaces:**
- Consumes: `insertPayloadAt`, `PasteMapTarget` (Task 2).
- Produces:
  - `type PasteMapSetting = 'ask' | PasteMapTarget`; `normalizePasteMapSetting(v: unknown): PasteMapSetting` (in `lib/mindmap-insert.ts`)
  - `needsPasteDialog(format: PasteFormat, hasSelection: boolean, setting: PasteMapSetting): boolean`
  - Settings field `mindmapPasteMapTarget: PasteMapSetting` + action `setMindmapPasteMapTarget(v: PasteMapSetting)`

i18n (`settings` block): `mindmapPasteMapTarget: 'When pasting a whole map'`, `mindmapPasteMapTarget_ask: 'Ask every time'`, `mindmapPasteMapTarget_selected: 'Into selected node'`, `mindmapPasteMapTarget_root: 'Into root'`, `mindmapPasteMapReset: 'Reset to ask'`.

- [ ] **Step 1: Failing tests** (append to `mindmap-insert.test.ts`)

```ts
import { needsPasteDialog, normalizePasteMapSetting } from './mindmap-insert.ts';

test('dialog only for whole-map paste with a selection and setting=ask', () => {
  assert.equal(needsPasteDialog('mmap', true, 'ask'), true);
  assert.equal(needsPasteDialog('mmap', false, 'ask'), false);
  assert.equal(needsPasteDialog('markdown', true, 'ask'), false);
  assert.equal(needsPasteDialog('mmap', true, 'root'), false);
});

test('normalizePasteMapSetting falls back to ask', () => {
  assert.equal(normalizePasteMapSetting('root'), 'root');
  assert.equal(normalizePasteMapSetting('bogus'), 'ask');
  assert.equal(normalizePasteMapSetting(undefined), 'ask');
});
```

Run → FAIL.

- [ ] **Step 2: Implement** (append to `mindmap-insert.ts`)

```ts
import type { PasteFormat } from './mindmap-paste.ts';

export type PasteMapSetting = 'ask' | PasteMapTarget;
const PASTE_MAP_SETTINGS: readonly PasteMapSetting[] = ['ask', 'selected', 'root'];
const WHOLE_MAP_FORMAT: PasteFormat = 'mmap';

export function normalizePasteMapSetting(value: unknown): PasteMapSetting {
  return PASTE_MAP_SETTINGS.includes(value as PasteMapSetting) ? (value as PasteMapSetting) : 'ask';
}

export function needsPasteDialog(format: PasteFormat, hasSelection: boolean, setting: PasteMapSetting): boolean {
  return format === WHOLE_MAP_FORMAT && hasSelection && setting === 'ask';
}
```

Run tests → PASS.

- [ ] **Step 3: Settings store**

```ts
// interface Settings (~271)
mindmapPasteMapTarget: PasteMapSetting;
// defaults() (~682)
mindmapPasteMapTarget: 'ask',
// load() (~791)
merged.mindmapPasteMapTarget = normalizePasteMapSetting(parsed.mindmapPasteMapTarget);
// actions (near setMindmapControlStyle ~1416) — mirror its persist call exactly
setMindmapPasteMapTarget(value: PasteMapSetting) {
  this.mindmapPasteMapTarget = normalizePasteMapSetting(value);
  /* same persist call as setMindmapControlStyle */
},
```

- [ ] **Step 4: SettingsPanel** (after the control-style block at line ~788)

```vue
<div class="settings-row">
  <label>{{ t('settings.mindmapPasteMapTarget') }}</label>
  <select :value="settings.mindmapPasteMapTarget" @change="settings.setMindmapPasteMapTarget(($event.target as HTMLSelectElement).value as PasteMapSetting)">
    <option v-for="v in ['ask', 'selected', 'root']" :key="v" :value="v">{{ t(`settings.mindmapPasteMapTarget_${v}`) }}</option>
  </select>
  <button type="button" :disabled="settings.mindmapPasteMapTarget === 'ask'" @click="settings.setMindmapPasteMapTarget('ask')">{{ t('settings.mindmapPasteMapReset') }}</button>
</div>
```

(Match the wrapper class used by the neighbouring control-style row.)

- [ ] **Step 5: Dialog component**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../i18n';
import type { PasteMapTarget } from '../lib/mindmap-insert';

const emit = defineEmits<{ choose: [target: PasteMapTarget, remember: boolean]; cancel: [] }>();
const { t } = useI18n();
const remember = ref(false);
</script>

<template>
  <div class="mindmap-paste-target__overlay" @click.self="emit('cancel')" @keydown.esc.prevent="emit('cancel')">
    <div class="mindmap-paste-target" role="dialog" aria-modal="true" :aria-label="t('mindmap.pasteMapTitle')">
      <h3>{{ t('mindmap.pasteMapTitle') }}</h3>
      <button type="button" class="primary" autofocus @click="emit('choose', 'selected', remember)">{{ t('mindmap.pasteMapIntoSelected') }}</button>
      <button type="button" @click="emit('choose', 'root', remember)">{{ t('mindmap.pasteMapIntoRoot') }}</button>
      <label><input v-model="remember" type="checkbox" /> {{ t('mindmap.pasteMapRemember') }}</label>
    </div>
  </div>
</template>
```

- [ ] **Step 6: Wire into canvas**

```ts
const pendingPaste = ref<PastePayload | null>(null);

function routePaste(payload: PastePayload): void {
  const setting = settings.mindmapPasteMapTarget;
  const hasSelection = (mind?.currentNodes?.length ?? 0) > 0;
  if (needsPasteDialog(payload.format, hasSelection, setting)) { pendingPaste.value = payload; return; }
  const mode: PasteMapTarget = payload.format === 'mmap' && setting !== 'ask' ? setting : 'selected';
  void insertPayloadAt(payload, mode);
}

function onPasteTargetChosen(target: PasteMapTarget, remember: boolean): void {
  const payload = pendingPaste.value;
  pendingPaste.value = null;
  if (remember) settings.setMindmapPasteMapTarget(target);
  if (payload) void insertPayloadAt(payload, target);
}
```

Replace `void insertPayloadAt(result.payload, 'selected')` in both `onPaste` and `pasteMapFromClipboard` with `routePaste(result.payload)`. In the template: `<MindmapPasteTargetDialog v-if="pendingPaste" @choose="onPasteTargetChosen" @cancel="pendingPaste = null" />`.

- [ ] **Step 7: Tests + build + browser**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-insert.test.ts && pnpm build`.
Browser: select node, ⌘V an envelope → dialog; tick Remember + *Into root* → lands at root; next ⌘V no dialog; Settings → Mindmap → *Reset to ask* → dialog returns. Paste plain `- a` lines → no dialog.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/MindmapPasteTargetDialog.vue app/src/components/MindmapCanvas.vue app/src/stores/settings.ts app/src/components/SettingsPanel.vue app/src/lib/mindmap-insert.ts app/src/lib/mindmap-insert.test.ts app/src/i18n/en.ts
git commit -m "feat(mindmap): ask where to paste a whole map, with remembered choice"
```

---

### Task 8: MCP tools `mmap_merge` and `mmap_graft`

**Files:**
- Modify: `mcp-mindmap/src/tools/write.ts` (or `file.ts` if `create` style fits better — put next to `create`)
- Modify: `mcp-mindmap/src/server.ts` (register near `mmap_create`, line ~120)
- Test: `mcp-mindmap/test/merge-graft.test.ts`

**Interfaces:**
- Consumes: `mergeMindmaps`, `graftMap`, `sanitizeMindmapData`; `MapStore.load/save/resolve/assertWritable`.
- Produces: `merge(store, { files: string[]; out: string; root?: string }): Promise<string>`, `graft(store, { file: string; source: string; node?: string }): Promise<string>`.

- [ ] **Step 1: Failing test** — copy the store fixture setup from an existing test in `mcp-mindmap/test/` (`ls mcp-mindmap/test` and reuse its temp-workspace helper), then:

```ts
test('mmap_merge writes a new map with one child per source and refuses overwrite', async () => {
  await merge(store, { files: ['a.mmap', 'b.mmap'], out: 'ab.mmap', root: 'AB' });
  const doc = await store.load('ab.mmap');
  assert.equal(doc.data.nodeData.topic, 'AB');
  assert.equal(doc.data.nodeData.children?.length, 2);
  await assert.rejects(merge(store, { files: ['a.mmap', 'b.mmap'], out: 'ab.mmap' }), /already exists/);
});

test('mmap_graft inserts source under node (default root)', async () => {
  await graft(store, { file: 'a.mmap', source: 'b.mmap' });
  const doc = await store.load('a.mmap');
  assert.equal(doc.data.nodeData.children?.at(-1)?.topic, 'B');
});
```

Run: `pnpm --dir mcp-mindmap test` → FAIL.

- [ ] **Step 2: Implement**

```ts
import { mergeMindmaps } from '../../../app/src/lib/mindmap-merge.ts';
import { graftMap } from '../../../app/src/lib/mindmap-payload.ts';
import { sanitizeMindmapData } from '../../../app/src/lib/mindmap-format.ts';

const MIN_MERGE = 2;
const TOPIC_JOINER = ' + ';

export async function merge(store: MapStore, a: { files: string[]; out: string; root?: string }): Promise<string> {
  store.assertWritable();
  if (a.files.length < MIN_MERGE) throw new Error('Give at least 2 files to merge');
  if (await exists(store.resolve(a.out))) throw new Error(`${a.out} already exists. Pick another name`);
  const docs = await Promise.all(a.files.map((f) => store.load(f)));
  const root = a.root ?? docs.map((d) => d.data.nodeData.topic).join(TOPIC_JOINER);
  const data = sanitizeMindmapData(mergeMindmaps(root, docs.map((d) => ({ data: d.data }))));
  await store.save(a.out, { data, display: {}, snippets: [] });
  return `Created ${a.out} from ${a.files.length} maps`;
}

export async function graft(store: MapStore, a: { file: string; source: string; node?: string }): Promise<string> {
  store.assertWritable();
  const [target, source] = await Promise.all([store.load(a.file), store.load(a.source)]);
  const res = graftMap(target.data, source.data, a.node);
  if (!res.ok) throw new Error(res.error);
  await store.save(a.file, { ...target, data: res.data });
  return `Grafted ${a.source} into ${a.file} as node ${res.rootId}`;
}
```

(`exists` already lives in `file.ts`; export it or co-locate these in `file.ts`.)

Register in `server.ts`:

```ts
server.registerTool('mmap_merge', {
  title: 'Merge maps into a new file', annotations: WRITE,
  description: 'New .mmap whose root has one child per source map. Ids are prefixed; arrows, summaries and gates kept. Refuses to overwrite.',
  inputSchema: z.object({ files: z.array(fileArg).min(2), out: fileArg, root: z.string().optional().describe('Root topic; defaults to "A + B"') }),
}, async (a) => text(await merge(store, a)));
server.registerTool('mmap_graft', {
  title: 'Insert a map under a node', annotations: WRITE,
  description: 'Copy the whole source map (root included) under a node of the target map; default node is the root.',
  inputSchema: z.object({ file: fileArg, source: fileArg, node: nodeArg.optional() }),
}, async (a) => text(await graft(store, a)));
```

- [ ] **Step 3: Tests + typecheck PASS**

Run: `pnpm --dir mcp-mindmap test && pnpm --dir mcp-mindmap typecheck`

- [ ] **Step 4: Update `plugin/` skill doc** if it lists tools (`grep -rn "mmap_create" plugin/`) — add the two tools to that list.

- [ ] **Step 5: Commit**

```bash
git add mcp-mindmap plugin
git commit -m "feat(mcp-mindmap): mmap_merge and mmap_graft tools"
```

---

### Task 9: Full verification

- [ ] **Step 1:** `cd app && node --test --experimental-strip-types src/lib/*.test.ts src/stores/*.test.ts` → all PASS (report count).
- [ ] **Step 2:** `pnpm --dir app build` and `pnpm --dir mcp-mindmap test` → PASS.
- [ ] **Step 3:** Browser end-to-end on :1420 (`preview_start {name: "solomd-web"}`):
  1. Explorer: add `a.mmap`, `b.mmap` to workbench.
  2. Open workbench → both checked, root topic `a + b` → *Merge selected…* → save dialog → new tab with root `a + b` and 2 children.
  3. Uncheck one, close, reopen → unchecked state preserved.
  4. In `a.mmap`, nothing selected, *Paste map* with `b` copied → `b` under root; ⌘Z once restores.
  5. Screenshot the workbench form and the merged map as proof.
- [ ] **Step 4:** Commit any fixes; leave branch ready for review.
