import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirInstance, NodeObj } from 'mind-elixir';

type Summary = MindElixirInstance['summaries'][number];
import { remapSummaries, sortChildrenByTopic } from './sort.ts';

const node = (topic: string, children: NodeObj[] = []): NodeObj => ({ id: topic, topic, children });
const topics = (n: NodeObj): string[] => (n.children ?? []).map((c) => c.topic);

test('sorts direct children A to Z with numeric awareness', () => {
  const root = node('r', [node('Item 10'), node('banana'), node('Item 2'), node('Apple')]);
  assert.equal(sortChildrenByTopic(root), 'asc');
  assert.deepEqual(topics(root), ['Apple', 'banana', 'Item 2', 'Item 10']);
});

test('sorting an already ascending list flips it to Z to A', () => {
  const root = node('r', [node('a'), node('b'), node('c')]);
  assert.equal(sortChildrenByTopic(root), 'desc');
  assert.deepEqual(topics(root), ['c', 'b', 'a']);
});

test('hebrew topics sort alphabetically', () => {
  const root = node('r', [node('גימל'), node('אלף'), node('בית')]);
  sortChildrenByTopic(root);
  assert.deepEqual(topics(root), ['אלף', 'בית', 'גימל']);
});

test('grandchildren keep their order', () => {
  const root = node('r', [node('b', [node('z'), node('y')]), node('a')]);
  sortChildrenByTopic(root);
  assert.deepEqual(topics(root.children![1]), ['z', 'y']);
});

test('fewer than two children is a no-op', () => {
  assert.equal(sortChildrenByTopic(node('r', [node('x')])), null);
  assert.equal(sortChildrenByTopic(node('r')), null);
});

const summary = (id: string, parent: string, start: number, end: number): Summary => ({ id, parent, start, end, label: id });
const pool = (letters: string[]): Map<string, NodeObj> => new Map(letters.map((l) => [l, node(l)]));
const pick = (nodes: Map<string, NodeObj>, order: string): NodeObj[] => [...order].map((l) => nodes.get(l)!);

test('remapSummaries follows a contiguous block to its new position', () => {
  const nodes = pool(['a', 'b', 'c']);
  const result = remapSummaries([summary('s', 'p', 0, 1)], 'p', pick(nodes, 'bac'), pick(nodes, 'abc'));
  assert.deepEqual(result.kept, [summary('s', 'p', 0, 1)]);
  assert.equal(result.droppedCount, 0);
});

test('remapSummaries remaps after a reversal', () => {
  const nodes = pool(['a', 'b', 'c']);
  const result = remapSummaries([summary('s', 'p', 0, 1)], 'p', pick(nodes, 'abc'), pick(nodes, 'cba'));
  assert.deepEqual(result.kept, [summary('s', 'p', 1, 2)]);
});

test('remapSummaries drops a summary whose nodes are no longer adjacent', () => {
  const nodes = pool(['a', 'x', 'b']);
  const result = remapSummaries([summary('s', 'p', 0, 1)], 'p', pick(nodes, 'axb'), pick(nodes, 'xba'));
  assert.deepEqual(result.kept, []);
  assert.equal(result.droppedCount, 1);
});

test('remapSummaries leaves other parents untouched', () => {
  const nodes = pool(['a', 'b']);
  const other = summary('o', 'q', 0, 1);
  const result = remapSummaries([other], 'p', pick(nodes, 'ab'), pick(nodes, 'ba'));
  assert.deepEqual(result.kept, [other]);
  assert.equal(result.droppedCount, 0);
});
