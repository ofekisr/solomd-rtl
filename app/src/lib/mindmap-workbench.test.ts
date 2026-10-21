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
