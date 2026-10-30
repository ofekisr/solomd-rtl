import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { defaultMergeTopic, entryKey, nodesStaleness, parseWorkbench, removeEntries, upsertEntry, type EntryDraft, type NodesEntry, type WorkbenchEntry } from './workbench.ts';
import { subtreeData } from './payload.ts';

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

const unsafeNode = { id: 'n', topic: 'N', hyperLink: 'javascript:alert(1)', tags: [{ text: 't', extra: 1 }] };
const unsafeSource = (node: object = unsafeNode): MindElixirData =>
  ({ nodeData: { id: 'root', topic: 'R', children: [node] } }) as unknown as MindElixirData;
const liveEntry = (source: MindElixirData): WorkbenchEntry => {
  const snapshot = subtreeData(source, ['n'], 'N');
  if (!snapshot) throw new Error('no subtree');
  const { entries } = upsertEntry([], { kind: 'nodes', sourcePath: '/w/a.mmap', nodeIds: ['n'], label: 'l', snapshot, capturedAt: 't' }, 'e1');
  return parseWorkbench(JSON.parse(JSON.stringify(entries)))[0];
};

test('live source with unsafe fields reads fresh after a persist round-trip', () => {
  const entry = liveEntry(unsafeSource());
  assert.equal(nodesStaleness(entry as NodesEntry, unsafeSource()), 'fresh');
});

test('staleness ignores key order of the live source', () => {
  const entry = liveEntry(unsafeSource());
  const reordered = { tags: unsafeNode.tags, hyperLink: unsafeNode.hyperLink, topic: 'N', id: 'n' };
  assert.equal(nodesStaleness(entry as NodesEntry, unsafeSource(reordered)), 'fresh');
});

test('upsert stores a sanitized snapshot', () => {
  const snapshot = subtreeData(unsafeSource(), ['n'], 'N');
  if (!snapshot) throw new Error('no subtree');
  const { entries } = upsertEntry([], { kind: 'nodes', sourcePath: '/w/a.mmap', nodeIds: ['n'], label: 'l', snapshot, capturedAt: 't' }, 'e1');
  const stored = entries[0] as NodesEntry;
  assert.equal(stored.snapshot.nodeData.hyperLink, undefined);
});

test('a malformed nodes row is dropped without losing valid rows', () => {
  const good = upsertEntry([], fileDraft, 'e1').entries;
  const bad = { id: 'x', kind: 'nodes', label: 'X', selected: true, sourcePath: '/a', capturedAt: 't', nodeIds: ['x'], snapshot: { nodeData: { id: 'x', topic: 'X', children: 'bad' } } };
  assert.deepEqual(parseWorkbench([bad, ...good]), good);
});

const withNodeExtra = (extra: object): MindElixirData =>
  ({ nodeData: { id: 'root', topic: 'R', children: [{ id: 'n', topic: 'N', ...extra }] } }) as unknown as MindElixirData;

test('layout-only keys (direction, expanded) do not make an entry stale', () => {
  const entry = liveEntry(withNodeExtra({}));
  assert.equal(nodesStaleness(entry as NodesEntry, withNodeExtra({ direction: 1 })), 'fresh');
  assert.equal(nodesStaleness(entry as NodesEntry, withNodeExtra({ expanded: false })), 'fresh');
});

test('a topic change is still stale next to layout keys', () => {
  const entry = liveEntry(withNodeExtra({}));
  assert.equal(nodesStaleness(entry as NodesEntry, withNodeExtra({ direction: 1, topic: 'N2' })), 'stale');
});
