import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { gateArrows, GATE_ARROW_PREFIX, toAdjacency, toMermaid, withGateArrows, withoutGateArrows } from './mindmap-graph.ts';

const data = (): MindElixirData => ({
  nodeData: { id: 'r', topic: 'Root "q"', children: [
    { id: 'a', topic: 'A <b>' },
    { id: 'g', topic: '⇒ A', metadata: { gate: { target: 'a' } } },
    { id: 'x', topic: 'broken', metadata: { gate: { target: 'gone' } } },
  ] },
  arrows: [{ id: 'user', label: 'l', from: 'a', to: 'r' }],
});

test('gate arrows only for live gates', () => {
  assert.deepEqual(gateArrows(data()).map((a) => [a.id, a.from, a.to]), [[`${GATE_ARROW_PREFIX}g`, 'g', 'a']]);
});

test('withGateArrows keeps user arrows and copies', () => {
  const src = data();
  const out = withGateArrows(src);
  assert.deepEqual(out.arrows!.map((a) => a.id), ['user', `${GATE_ARROW_PREFIX}g`]);
  assert.equal(src.arrows!.length, 1);
});

test('withoutGateArrows drops only temp arrows', () => {
  const out = withoutGateArrows(withGateArrows(data()));
  assert.deepEqual(out.arrows!.map((a) => a.id), ['user']);
});

test('mermaid escapes labels and dashes gate edges', () => {
  const text = toMermaid(data());
  assert.equal(text.split('\n')[0], 'graph LR');
  assert.ok(text.includes('n0["Root #quot;q#quot;"]'));
  assert.ok(text.includes('n1["A #lt;b#gt;"]'));
  assert.ok(text.includes('n0 --> n1'));
  assert.ok(text.includes('n2 -.-> n1'));
  assert.equal(text.includes('n3 -.->'), false);
});

test('adjacency lists child and gate edges', () => {
  const adj = toAdjacency(data());
  assert.equal(adj.nodes.length, 4);
  assert.deepEqual(adj.nodes.find((n) => n.id === 'g'), { id: 'g', topic: '⇒ A', isGate: true });
  assert.deepEqual(adj.edges.filter((e) => e.kind === 'gate'), [{ from: 'g', to: 'a', kind: 'gate' }]);
  assert.equal(adj.edges.filter((e) => e.kind === 'child').length, 3);
});

