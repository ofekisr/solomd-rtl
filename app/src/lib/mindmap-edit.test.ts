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

test('updateNode with an undefined value removes the field', () => {
  const input: MindElixirData = { nodeData: { id: 'r', topic: 'Root', children: [{ id: 's', topic: 'S', style: { color: '#000' } }] } };
  const res = updateNode(input, 's', { style: undefined });
  assert.ok(res.ok);
  assert.equal('style' in findNode(res.data.nodeData, 's')!, false);
  assert.deepEqual(findNode(input.nodeData, 's')!.style, { color: '#000' });
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
