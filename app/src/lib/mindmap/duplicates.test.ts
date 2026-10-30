import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { canonical, findDuplicateGroups, mergeIntoGate, normalizeTopic, subtreeHash } from './duplicates.ts';
import { findNode, readGate } from './gates.ts';

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

test('merge drops summaries anchored on the duplicate', () => {
  const withSummary = data();
  withSummary.summaries = [{ id: 's1', label: '', parent: 'd', start: 0, end: 1 }, { id: 's2', label: '', parent: 'k', start: 0, end: 0 }];
  const merged = mergeIntoGate(withSummary, 'k', 'd');
  assert.deepEqual(merged!.summaries!.map((s) => s.id), ['s2']);
});

test('gates that pointed at the duplicate are retargeted to the kept node', () => {
  const withGate = data();
  withGate.nodeData.children!.push({ id: 'g', topic: '⇒ tasks', metadata: { refId: 'ref', gate: { target: 'd' } } });
  const merged = mergeIntoGate(withGate, 'k', 'd');
  const gate = findNode(merged!.nodeData, 'g')!;
  assert.deepEqual(readGate(gate), { target: 'k' });
  assert.equal((gate.metadata as { refId: string }).refId, 'ref');
});

test('union does not confuse ambiguous canonical forms', () => {
  const ambiguous: MindElixirData = { nodeData: { id: 'r', topic: 'R', children: [
    { id: 'k', topic: 'T', children: [{ id: 'k1', topic: 'p', children: [{ id: 'x', topic: 'x' }, { id: 'y', topic: 'y' }] }] },
    { id: 'd', topic: 'T', children: [{ id: 'd1', topic: 'p', children: [{ id: 'z', topic: 'x(),y' }] }] },
  ] } };
  const merged = mergeIntoGate(ambiguous, 'k', 'd');
  assert.deepEqual(findNode(merged!.nodeData, 'k')!.children!.map((c) => c.id), ['k1', 'd1']);
});

test('children differing in note are not twins', () => {
  const d: MindElixirData = { nodeData: { id: 'r', topic: 'Root', children: [
    { id: 'k', topic: 'T', children: [{ id: 'k1', topic: 'A' }] },
    { id: 'x', topic: 'O', children: [{ id: 'd', topic: 't', children: [{ id: 'd1', topic: 'a', note: 'important' }] }] },
  ] } };
  const merged = mergeIntoGate(d, 'k', 'd')!;
  assert.ok(findNode(merged.nodeData, 'k')!.children!.some((c) => c.id === 'd1' && c.note === 'important'));
});

test('canonical stays linear on deep chains', () => {
  let node: NodeObj = { id: 'n0', topic: 'a' };
  for (let i = 1; i < 30; i += 1) node = { id: `n${i}`, topic: 'a', children: [node] };
  assert.ok(canonical(node).length < 5_000);
  assert.ok(subtreeHash(node).length > 0);
});
