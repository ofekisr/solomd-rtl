import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { copyMapText, graftMap, parseMapText, subtreeData } from './payload.ts';

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
