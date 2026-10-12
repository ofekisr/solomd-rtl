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

test('merge drops summaries anchored on the duplicate', () => {
  const withSummary = data();
  withSummary.summaries = [{ id: 's1', label: '', parent: 'd', start: 0, end: 1 }, { id: 's2', label: '', parent: 'k', start: 0, end: 0 }];
  const merged = mergeIntoGate(withSummary, 'k', 'd');
  assert.deepEqual(merged!.summaries!.map((s) => s.id), ['s2']);
});
