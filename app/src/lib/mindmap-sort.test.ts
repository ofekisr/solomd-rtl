import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { sortChildrenByTopic } from './mindmap-sort.ts';

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
