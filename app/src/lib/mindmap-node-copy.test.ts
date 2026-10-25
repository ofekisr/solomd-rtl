import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { copyStyle, nodePathText, nodePathsText, pasteStyle } from './mindmap-node-copy.ts';

const root: NodeObj = { id: 'r', topic: 'Root' };
const mid: NodeObj = { id: 'm', topic: 'Mid', parent: root };
const leaf: NodeObj = { id: 'l', topic: 'Leaf', parent: mid };

test('nodePathText includes the node itself after its ancestors', () => {
  assert.equal(nodePathText(leaf), 'Root › Mid › Leaf');
  assert.equal(nodePathText(root), 'Root');
});

test('nodePathsText puts one path per line', () => {
  assert.equal(nodePathsText([mid, leaf]), 'Root › Mid\nRoot › Mid › Leaf');
});

test('copyStyle returns a detached copy, empty when unstyled', () => {
  const node: NodeObj = { id: 'a', topic: 'A', style: { color: 'red' } };
  const style = copyStyle(node);
  style.color = 'blue';
  assert.equal(node.style?.color, 'red');
  assert.deepEqual(copyStyle({ id: 'b', topic: 'B' }), {});
});

test('pasteStyle applies to changed nodes only and clears on empty style', () => {
  const same: NodeObj = { id: 'a', topic: 'A', style: { color: 'red' } };
  const other: NodeObj = { id: 'b', topic: 'B', style: { background: 'x' } };
  assert.deepEqual(pasteStyle([same, other], { color: 'red' }).map((n) => n.id), ['b']);
  assert.deepEqual(other.style, { color: 'red' });
  assert.deepEqual(pasteStyle([other], {}).map((n) => n.id), ['b']);
  assert.equal(other.style, undefined);
});
