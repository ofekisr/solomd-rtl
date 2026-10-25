import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { copyStyle, cssColorToHex, nodePathText, nodePathsText, pasteStyle, type RenderedLook } from './mindmap-node-copy.ts';

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

const PILL_LOOK: RenderedLook = {
  color: 'rgb(255, 255, 255)',
  backgroundColor: 'rgb(60, 60, 90)',
  borderTopWidth: '2px',
  borderTopStyle: 'solid',
  borderTopColor: 'rgb(120, 120, 200)',
  borderTopLeftRadius: '999px',
  fontSize: '18px',
  fontWeight: '400',
  paddingTop: '8px',
  paddingRight: '25px',
  paddingBottom: '8px',
  paddingLeft: '25px',
};

test('copyStyle with a rendered look captures theme defaults the node never saved', () => {
  const copied = copyStyle({ id: 'm', topic: 'Main' }, PILL_LOOK);
  assert.deepEqual(copied.style, {
    color: '#ffffff',
    background: '#3c3c5a',
    border: '2px solid #7878c8',
    borderRadius: '999px',
    fontSize: '18px',
    fontWeight: '400',
    padding: '8px 25px',
  });
});

test('copyStyle lets saved style win over the rendered look and skips cleared values', () => {
  const copied = copyStyle({ id: 'm', topic: 'Main', style: { color: '#f00', background: '' } }, PILL_LOOK);
  assert.equal(copied.style.color, '#f00');
  assert.equal(copied.style.background, '#3c3c5a');
});

test('a rendered copy differs from an unstyled target, so paste applies it', () => {
  const leaf: NodeObj = { id: 'l', topic: 'Leaf' };
  const copied = copyStyle({ id: 'm', topic: 'Main' }, PILL_LOOK);
  assert.deepEqual(pasteStyle([leaf], copied).map((n) => n.id), ['l']);
  assert.equal((leaf.style as Record<string, string>).borderRadius, '999px');
});

test('cssColorToHex converts rgb/rgba and maps zero alpha to transparent', () => {
  assert.equal(cssColorToHex('rgb(76, 79, 105)'), '#4c4f69');
  assert.equal(cssColorToHex('rgba(0, 0, 0, 0)'), 'transparent');
  assert.equal(cssColorToHex('rgba(255, 0, 0, 0.5)'), '#ff0000');
  assert.equal(cssColorToHex('#abc'), '#abc');
});

test('rendered border rounds fractional widths and drops invisible borders', () => {
  const fractional = copyStyle({ id: 'a', topic: 'A' }, { ...PILL_LOOK, borderTopWidth: '1.764706px' });
  assert.equal(fractional.style.border, '2px solid #7878c8');
  const none = copyStyle({ id: 'b', topic: 'B' }, { ...PILL_LOOK, borderTopStyle: 'none', borderTopWidth: '0px' });
  assert.equal(none.style.border, 'none');
});

test('rendered padding keeps four values when sides differ', () => {
  const copied = copyStyle({ id: 'a', topic: 'A' }, { ...PILL_LOOK, paddingLeft: '10.4px' });
  assert.equal(copied.style.padding, '8px 25px 8px 10px');
});
