import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { mindElixirToPlaintext, plaintextToMindElixir } from 'mind-elixir/plaintextConverter';
import { attachGatesFromTopics, gatesToTopics } from './mindmap-gate-plaintext.ts';
import { findNode, readGate, walkNodes } from './mindmap-gates.ts';

const ROOT = 'Mind Map';
const parse = (text: string): MindElixirData => attachGatesFromTopics(plaintextToMindElixir(text, ROOT));

test('=> ref becomes a gate to the anchored node', () => {
  const data = parse('- Root\n  - Alpha [^a1]\n  - => a1');
  const alpha = walkNodes(data.nodeData).find((n) => n.topic === 'Alpha')!;
  const gate = data.nodeData.children![1];
  assert.deepEqual(readGate(gate), { target: alpha.id });
});

test('unknown ref keeps missingRef and round-trips', () => {
  const data = parse('- Root\n  - => ghost');
  assert.deepEqual(readGate(data.nodeData.children![0]), { target: '', missingRef: 'ghost' });
  assert.ok(mindElixirToPlaintext(gatesToTopics(data)).includes('- => ghost'));
});

test('serialize writes => ref and adds a refId to unanchored targets', () => {
  const data: MindElixirData = { nodeData: { id: 'r', topic: 'Root', children: [
    { id: 'abc123', topic: 'Alpha' },
    { id: 'g', topic: '⇒ Alpha', metadata: { gate: { target: 'abc123' } } },
  ] } };
  const text = mindElixirToPlaintext(gatesToTopics(data));
  assert.ok(text.includes('- Alpha [^abc123]'));
  assert.ok(text.includes('- => abc123'));
  assert.equal(findNode(data.nodeData, 'abc123')?.metadata, undefined, 'input not mutated');
});

test('existing refId is reused and survives a full round-trip', () => {
  const first = parse('- Root\n  - Alpha [^a1]\n  - => a1');
  const text = mindElixirToPlaintext(gatesToTopics(first));
  assert.ok(text.includes('[^a1]') && text.includes('- => a1'));
  const again = parse(text);
  const alpha = walkNodes(again.nodeData).find((n) => n.topic === 'Alpha')!;
  assert.equal(readGate(walkNodes(again.nodeData).find((n) => readGate(n) !== null)!)?.target, alpha.id);
});

test('gate whose target was deleted survives serialize as a broken gate', () => {
  const data = parse('- Root\n  - Alpha [^a1]\n  - => a1');
  const alpha = walkNodes(data.nodeData).find((n) => n.topic === 'Alpha')!;
  data.nodeData.children = data.nodeData.children!.filter((n) => n.id !== alpha.id);
  walkNodes(data.nodeData).filter((n) => readGate(n)).forEach((n) => { n.topic = '⇒ ⚠ missing target'; });
  const text = mindElixirToPlaintext(gatesToTopics(data));
  assert.ok(/- => [\w-]+/u.test(text), text);
  const again = parse(text);
  const gate = walkNodes(again.nodeData).find((n) => readGate(n) !== null)!;
  assert.equal(readGate(gate)?.target, '');
  assert.ok(readGate(gate)?.missingRef);
});

test('orphaned gate with an unsafe target emits no gate line', () => {
  const data: MindElixirData = {
    nodeData: { id: 'r', topic: 'Root', children: [{ id: 'g', topic: 'Gate', metadata: { gate: { target: 'x\n- injected' } } }] },
  } as MindElixirData;
  const topics = [...walkNodes(gatesToTopics(data).nodeData)].map((n) => n.topic);
  assert.ok(topics.every((t) => !t.includes('\n') && !t.startsWith('=>')), topics.join('|'));
});

test('a gate targeting an unsafe node id emits no injected line', () => {
  const data: MindElixirData = { nodeData: { id: 'root', topic: 'R', children: [
    { id: 'x]\n- injected [^y', topic: 'T' },
    { id: 'g', topic: 'G', metadata: { gate: { target: 'x]\n- injected [^y' } } },
  ] } };
  const out = mindElixirToPlaintext(gatesToTopics(data));
  assert.ok(!out.includes('injected'));
});
