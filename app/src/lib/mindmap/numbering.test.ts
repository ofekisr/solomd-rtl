import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { applyNumbers, numberingGroups, stripNumber } from './numbering.ts';

function tree(topic: string, kids: string[] = []): NodeObj {
  const node: NodeObj = { id: topic, topic, children: [] };
  node.children = kids.map((k) => ({ id: k, topic: k, children: [], parent: node }));
  return node;
}
const never = (): boolean => false;
const topics = (nodes: readonly NodeObj[]): string[] => nodes.map((n) => n.topic);

test('stripNumber removes one leading "N." or "N)" prefix only', () => {
  assert.equal(stripNumber('3. Plan'), 'Plan');
  assert.equal(stripNumber('12) Plan'), 'Plan');
  assert.equal(stripNumber('2024 goals'), '2024 goals');
  assert.equal(stripNumber('1.5 release'), '1.5 release');
});

test('children scope numbers direct children in current order and renumbers old prefixes', () => {
  const root = tree('r', ['b', '7. a', 'c']);
  const changed = applyNumbers(numberingGroups([root], 'children'), true, never);
  assert.deepEqual(topics(root.children!), ['1. b', '2. a', '3. c']);
  assert.equal(changed.length, 3);
});

test('selves scope numbers selected siblings per parent in sibling order', () => {
  const a = tree('A', ['x', 'y', 'z']);
  const b = tree('B', ['q']);
  const [x, , z] = a.children!;
  applyNumbers(numberingGroups([z, b.children![0], x], 'selves'), true, never);
  assert.deepEqual(topics(a.children!), ['1. x', 'y', '2. z']);
  assert.equal(b.children![0].topic, '1. q');
});

test('selves scope skips the root', () => {
  assert.deepEqual(numberingGroups([tree('r', ['a'])], 'selves'), []);
});

test('remove numbering strips prefixes; skipped nodes are untouched and not counted', () => {
  const root = tree('r', ['1. a', 'gate', '3. b']);
  const isGateNode = (n: NodeObj): boolean => n.topic === 'gate';
  applyNumbers(numberingGroups([root], 'children'), true, isGateNode);
  assert.deepEqual(topics(root.children!), ['1. a', 'gate', '2. b']);
  applyNumbers(numberingGroups([root], 'children'), false, isGateNode);
  assert.deepEqual(topics(root.children!), ['a', 'gate', 'b']);
});

test('unchanged topics are not reported as changed', () => {
  const root = tree('r', ['1. a', '2. b']);
  assert.equal(applyNumbers(numberingGroups([root], 'children'), true, never).length, 0);
});
