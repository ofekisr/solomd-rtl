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

test('copyStyle returns a detached copy with the branch color', () => {
  const node: NodeObj = { id: 'a', topic: 'A', style: { color: 'red' }, branchColor: '#00f' };
  const copied = copyStyle(node);
  copied.style.color = 'blue';
  assert.equal(node.style?.color, 'red');
  assert.equal(copied.branchColor, '#00f');
  assert.deepEqual(copyStyle({ id: 'b', topic: 'B' }), { style: {}, branchColor: undefined });
});

test('pasteStyle applies to changed nodes only', () => {
  const same: NodeObj = { id: 'a', topic: 'A', style: { color: 'red' } };
  const other: NodeObj = { id: 'b', topic: 'B', style: { background: 'x' } };
  assert.deepEqual(pasteStyle([same, other], { style: { color: 'red' } }).map((n) => n.id), ['b']);
  assert.deepEqual(other.style, { color: 'red' });
});

test('pasteStyle copies the branch color and clears empty values', () => {
  const node: NodeObj = { id: 'a', topic: 'A', style: { color: 'red' }, branchColor: '#f00' };
  pasteStyle([node], { style: {}, branchColor: '#0f0' });
  assert.equal(node.style, undefined);
  assert.equal(node.branchColor, '#0f0');
  pasteStyle([node], { style: {} });
  assert.equal('branchColor' in node, false);
});
