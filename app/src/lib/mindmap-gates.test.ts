import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData, NodeObj } from 'mind-elixir';
import {
  ancestorIds, canBeGateTarget, canHoldChildren, findNode, gateLabel, GATE_LABEL_PREFIX, isBrokenGate, isGate,
  makeGateNode, readGate, walkNodes, withGate, withGateLabels,
} from './mindmap-gates.ts';

const BROKEN = '⚠ broken';
const tree = (): NodeObj => ({
  id: 'r', topic: 'Root', children: [
    { id: 'a', topic: 'Alpha', metadata: { refId: 'a1' }, children: [{ id: 'a2', topic: 'Deep' }] },
    { id: 'g', topic: 'stale', metadata: { gate: { target: 'a2' } } },
  ],
});

test('readGate validates shape', () => {
  assert.deepEqual(readGate({ id: 'x', topic: '', metadata: { gate: { target: 'a' } } }), { target: 'a' });
  assert.deepEqual(readGate({ id: 'x', topic: '', metadata: { gate: { target: '', missingRef: 'q' } } }), { target: '', missingRef: 'q' });
  assert.equal(readGate({ id: 'x', topic: '', metadata: { gate: { target: 5 } } }), null);
  assert.equal(readGate({ id: 'x', topic: '', metadata: { gate: { target: '' } } }), null);
  assert.equal(readGate({ id: 'x', topic: '' }), null);
});

test('withGate merges metadata and drops children', () => {
  const node: NodeObj = { id: 'x', topic: 't', metadata: { refId: 'k' }, children: [{ id: 'c', topic: 'c' }] };
  const gate = withGate(node, { target: 'a' });
  assert.deepEqual(gate.metadata, { refId: 'k', gate: { target: 'a' } });
  assert.equal(gate.children, undefined);
  assert.equal(isGate(gate), true);
});

test('makeGateNode labels from target', () => {
  const g = makeGateNode('n1', { id: 'a', topic: 'Alpha' });
  assert.equal(g.topic, `${GATE_LABEL_PREFIX}Alpha`);
  assert.deepEqual(readGate(g), { target: 'a' });
});

test('find, walk, ancestors', () => {
  const root = tree();
  assert.equal(findNode(root, 'a2')?.topic, 'Deep');
  assert.equal(findNode(root, 'zz'), null);
  assert.deepEqual(walkNodes(root).map((n) => n.id), ['r', 'a', 'a2', 'g']);
  assert.deepEqual(ancestorIds(root, 'a2'), ['r', 'a']);
  assert.deepEqual(ancestorIds(root, 'r'), []);
  assert.equal(ancestorIds(root, 'zz'), null);
});

test('labels are live and broken gates are flagged', () => {
  const root = tree();
  const gate = findNode(root, 'g')!;
  assert.equal(gateLabel(gate, root, BROKEN), `${GATE_LABEL_PREFIX}Deep`);
  assert.equal(isBrokenGate(gate, root), false);
  root.children![0].children = [];
  assert.equal(gateLabel(gate, root, BROKEN), `${GATE_LABEL_PREFIX}${BROKEN}`);
  assert.equal(isBrokenGate(gate, root), true);
});

test('gate pointing at a gate is broken', () => {
  const root: NodeObj = { id: 'r', topic: 'R', children: [
    { id: 'g1', topic: '', metadata: { gate: { target: 'g2' } } },
    { id: 'g2', topic: '', metadata: { gate: { target: 'r' } } },
  ] };
  assert.equal(isBrokenGate(findNode(root, 'g1')!, root), true);
});

test('guards', () => {
  const root = tree();
  assert.equal(canHoldChildren(findNode(root, 'g')!), false);
  assert.equal(canHoldChildren(findNode(root, 'a')!), true);
  assert.equal(canBeGateTarget(findNode(root, 'g')!), false);
});

test('withGateLabels copies and labels', () => {
  const data: MindElixirData = { nodeData: tree() };
  const labelled = withGateLabels(data, BROKEN);
  assert.equal(findNode(labelled.nodeData, 'g')?.topic, `${GATE_LABEL_PREFIX}Deep`);
  assert.equal(findNode(data.nodeData, 'g')?.topic, 'stale');
});

test('readGate ignores a missingRef that is not a safe ref', () => {
  const bad = { id: 'g', topic: 'x', metadata: { gate: { target: '', missingRef: 'a\n- injected' } } };
  assert.equal(readGate(bad), null);
  const withTarget = { id: 'g', topic: 'x', metadata: { gate: { target: 't', missingRef: 'a b' } } };
  assert.deepEqual(readGate(withTarget), { target: 't' });
});
