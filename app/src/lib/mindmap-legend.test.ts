import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { findNode } from './mindmap-gates.ts';
import { markNode, readLegend, withLegend } from './mindmap-legend.ts';

const map = (): MindElixirData => ({ nodeData: { id: 'r', topic: 'Root', children: [{ id: 'a', topic: 'A' }] } });

test('withLegend stores safe entries on the root and readLegend reads them', () => {
  const data = withLegend(map(), [{ meaning: 'blocked', background: '#fde2e2', color: '#b91c1c' }, { meaning: 'bad', color: 'url(x)' }, { meaning: 'blocked' }]);
  assert.deepEqual(readLegend(data.nodeData), [{ meaning: 'blocked', background: '#fde2e2', color: '#b91c1c' }, { meaning: 'bad' }]);
});

test('markNode applies legend style and records the meaning', () => {
  const data = withLegend(map(), [{ meaning: 'done', background: '#dcfce7' }]);
  const res = markNode(data, 'a', 'done');
  assert.ok(res.ok);
  const a = findNode(res.data.nodeData, 'a')!;
  assert.equal((a.metadata as { mark: string }).mark, 'done');
  assert.equal(a.style?.background, '#dcfce7');
});

test('markNode refuses unknown meanings and clears with null', () => {
  const data = withLegend(map(), [{ meaning: 'done', background: '#dcfce7' }]);
  const miss = markNode(data, 'a', 'later');
  assert.ok(!miss.ok && miss.error.includes('done'));
  const marked = markNode(data, 'a', 'done');
  assert.ok(marked.ok);
  const cleared = markNode(marked.data, 'a', null);
  assert.ok(cleared.ok);
  const a = findNode(cleared.data.nodeData, 'a')!;
  assert.equal(a.style, undefined);
  assert.equal(a.metadata, undefined);
});

import { parseMindmap, serializeMindmap } from './mindmap-format.ts';

test('legend and marks survive the SoloMD codec round-trip', () => {
  const res = markNode(withLegend(map(), [{ meaning: 'done', background: '#dcfce7' }]), 'a', 'done');
  assert.ok(res.ok);
  const back = parseMindmap(serializeMindmap(res.data), 'x');
  assert.ok(back.ok);
  assert.equal(readLegend(back.data.nodeData)[0].meaning, 'done');
  assert.equal((findNode(back.data.nodeData, 'a')!.metadata as { mark: string }).mark, 'done');
});

const styled = (style: Record<string, string>): MindElixirData => ({ nodeData: { id: 'r', topic: 'Root', children: [{ id: 'a', topic: 'A', style }] } });

test('clearing an unmarked node leaves its manual style untouched', () => {
  const res = markNode(styled({ fontSize: '20', color: '#111111' }), 'a', null);
  assert.ok(res.ok);
  assert.deepEqual(findNode(res.data.nodeData, 'a')!.style, { fontSize: '20', color: '#111111' });
});

test('marking merges legend colours into manual style and clearing keeps other keys', () => {
  const data = withLegend(styled({ fontSize: '20' }), [{ meaning: 'done', background: '#dcfce7' }]);
  const marked = markNode(data, 'a', 'done');
  assert.ok(marked.ok);
  assert.deepEqual(findNode(marked.data.nodeData, 'a')!.style, { fontSize: '20', background: '#dcfce7' });
  const cleared = markNode(marked.data, 'a', null);
  assert.ok(cleared.ok);
  assert.deepEqual(findNode(cleared.data.nodeData, 'a')!.style, { fontSize: '20' });
});

test('markNode trims the meaning before the legend lookup', () => {
  const res = markNode(withLegend(map(), [{ meaning: 'done', background: '#dcfce7' }]), 'a', ' done ');
  assert.ok(res.ok);
  assert.equal((findNode(res.data.nodeData, 'a')!.metadata as { mark: string }).mark, 'done');
});
