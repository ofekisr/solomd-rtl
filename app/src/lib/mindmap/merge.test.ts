import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { filePrefix, prefixMindmapIds, mergeMindmaps } from './merge.ts';

const sample = (): MindElixirData => ({
  nodeData: {
    id: 'root', topic: 'A', children: [
      { id: 'n1', topic: 'x', metadata: { refId: 'n1', source: { line: 2 } } },
      { id: 'n2', topic: 'gate', metadata: { gate: { target: 'n1' } } },
      { id: 'n3', topic: 'broken', metadata: { gate: { target: '', missingRef: 'zz' } } },
    ],
  },
  arrows: [{ id: 'a1', label: '', from: 'n1', to: 'n2', delta1: { x: 0, y: 0 }, delta2: { x: 0, y: 0 } }],
  summaries: [{ id: 's1', label: 'S', parent: 'root', start: 0, end: 1 }],
});

test('filePrefix pads to two digits', () => {
  assert.equal(filePrefix(0), 'f01-');
  assert.equal(filePrefix(99), 'f100-');
});

test('prefix rewrites ids, refIds, gate targets, arrows and summaries without mutating', () => {
  const input = sample();
  const out = prefixMindmapIds(input, 'f01-');
  const [x, gate, broken] = out.nodeData.children ?? [];
  assert.equal(out.nodeData.id, 'f01-root');
  assert.deepEqual(x.metadata, { refId: 'f01-n1', source: { line: 2 } });
  assert.deepEqual(gate.metadata, { gate: { target: 'f01-n1' } });
  assert.deepEqual(broken.metadata, { gate: { target: '', missingRef: 'zz' } });
  assert.deepEqual([out.arrows?.[0].from, out.arrows?.[0].to, out.arrows?.[0].id], ['f01-n1', 'f01-n2', 'f01-a1']);
  assert.deepEqual([out.summaries?.[0].parent, out.summaries?.[0].id], ['f01-root', 'f01-s1']);
  assert.equal(input.nodeData.id, 'root');
});

test('merge groups consecutive entries and keeps arrows', () => {
  const out = mergeMindmaps('Folder', [{ data: sample(), group: 'part1' }, { data: sample(), group: 'part1' }, { data: sample() }]);
  const [group, third] = out.nodeData.children ?? [];
  assert.equal(out.nodeData.id, 'root');
  assert.deepEqual([group.id, group.topic, group.children?.map((c) => c.id)], ['g01', 'part1', ['f01-root', 'f02-root']]);
  assert.equal(third.id, 'f03-root');
  assert.equal(out.arrows?.length, 3);
  assert.equal(out.summaries?.length, 3);
});

test('merge omits empty arrow and summary lists', () => {
  const out = mergeMindmaps('F', [{ data: { nodeData: { id: 'root', topic: 'a' } } }]);
  assert.equal('arrows' in out, false);
  assert.equal('summaries' in out, false);
});
