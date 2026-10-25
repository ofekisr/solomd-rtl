import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { SplitDirection, TileNode } from '../types';
import { outermostLeaf, placeTabOnSide, type PlaceIds } from './pane-place.ts';

const leaf = (id: string, activeTabId = 't0'): TileNode => ({ type: 'leaf', id, activeTabId });
const branch = (id: string, direction: SplitDirection, a: TileNode, b: TileNode): TileNode => ({
  type: 'branch',
  id,
  direction,
  sizes: [50, 50],
  children: [a, b],
});
const ids = (): PlaceIds => {
  let n = 0;
  return { pane: () => `new${n++}`, branch: () => `br${n++}` };
};

/** Compact shape: leaves as `id:tab`, branches as `h(...)` / `v(...)`. */
const shape = (node: TileNode): string =>
  node.type === 'leaf'
    ? `${node.id}:${node.activeTabId}`
    : `${node.direction[0]}(${shape(node.children[0])},${shape(node.children[1])})`;

const sideBySide = (): TileNode => branch('b', 'horizontal', leaf('L'), leaf('R'));
const stacked = (): TileNode => branch('b', 'vertical', leaf('T'), leaf('B'));
const threeColumns = (): TileNode =>
  branch('b1', 'horizontal', leaf('L'), branch('b2', 'horizontal', leaf('M'), leaf('R')));

test('one pane: left/right/up/down split it and put the new pane on that side', () => {
  const cases: [Parameters<typeof placeTabOnSide>[1], string][] = [
    ['left', 'h(new0:x,P:t0)'],
    ['right', 'h(P:t0,new0:x)'],
    ['up', 'v(new0:x,P:t0)'],
    ['down', 'v(P:t0,new0:x)'],
  ];
  for (const [side, expected] of cases) {
    const result = placeTabOnSide(leaf('P'), side, 'x', ids());
    assert.equal(shape(result.root), expected, side);
    assert.equal(result.paneId, 'new0');
  }
});

test('two side-by-side panes: left/right add a full-height third column on that edge', () => {
  const left = placeTabOnSide(sideBySide(), 'left', 'x', ids());
  assert.equal(shape(left.root), 'h(h(new0:x,L:t0),R:t0)');
  const right = placeTabOnSide(sideBySide(), 'right', 'x', ids());
  assert.equal(shape(right.root), 'h(L:t0,h(R:t0,new0:x))');
  assert.equal(right.paneId, 'new0');
});

test('two stacked panes: up/down add a full-width third row on that edge', () => {
  assert.equal(shape(placeTabOnSide(stacked(), 'up', 'x', ids()).root), 'v(v(new0:x,T:t0),B:t0)');
  assert.equal(shape(placeTabOnSide(stacked(), 'down', 'x', ids()).root), 'v(T:t0,v(B:t0,new0:x))');
});

test('three panes on the axis: open in the outermost pane without splitting', () => {
  const left = placeTabOnSide(threeColumns(), 'left', 'x', ids());
  assert.equal(shape(left.root), 'h(L:x,h(M:t0,R:t0))');
  assert.equal(left.paneId, 'L');
  const right = placeTabOnSide(threeColumns(), 'right', 'x', ids());
  assert.equal(shape(right.root), 'h(L:t0,h(M:t0,R:x))');
  assert.equal(right.paneId, 'R');
});

test('two stacked panes: left/right open in an existing pane, the focused one first', () => {
  const toFocused = placeTabOnSide(stacked(), 'right', 'x', ids(), 'B');
  assert.equal(shape(toFocused.root), 'v(T:t0,B:x)');
  assert.equal(toFocused.paneId, 'B');
  assert.equal(placeTabOnSide(stacked(), 'left', 'x', ids()).paneId, 'T');
});

test('two side-by-side panes: up/down open in the focused column', () => {
  const result = placeTabOnSide(sideBySide(), 'down', 'x', ids(), 'R');
  assert.equal(shape(result.root), 'h(L:t0,R:x)');
});

test('file already open in the target pane: activate it, layout untouched', () => {
  const root = branch('b1', 'horizontal', leaf('L', 'x'), branch('b2', 'horizontal', leaf('M'), leaf('R')));
  const result = placeTabOnSide(root, 'left', 'x', ids());
  assert.equal(result.root, root);
  assert.equal(result.paneId, 'L');
});

test('outermostLeaf walks through nested mixed splits', () => {
  const root = branch('b1', 'vertical', branch('b2', 'horizontal', leaf('A'), leaf('B')), leaf('C'));
  assert.equal(outermostLeaf(root, 'right').id, 'B');
  assert.equal(outermostLeaf(root, 'down').id, 'C');
  assert.equal(outermostLeaf(root, 'left', 'C').id, 'C');
});
