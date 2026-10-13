import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasOpenBranch, planSelectionToggle, setDescendantsExpanded, type CollapsibleNode } from './mindmap-collapse.ts';

interface TestNode { id: string; expanded?: boolean; children?: TestNode[]; parent?: TestNode }

function tree(): { root: TestNode; a: TestNode; a1: TestNode; b: TestNode; leaf: TestNode } {
  const a1: TestNode = { id: 'a1', children: [{ id: 'a1x' }] };
  const a: TestNode = { id: 'a', children: [a1] };
  const b: TestNode = { id: 'b', children: [{ id: 'b1' }] };
  const leaf: TestNode = { id: 'leaf' };
  const root: TestNode = { id: 'root', children: [a, b, leaf] };
  const link = (node: TestNode): void => node.children?.forEach((child) => { child.parent = node; link(child); });
  link(root);
  return { root, a, a1, b, leaf };
}

test('any open selected node collapses the selection; nested selections keep their state', () => {
  const { a, a1, b } = tree();
  b.expanded = false;
  assert.deepEqual(planSelectionToggle([a, a1, b] as CollapsibleNode[], 'root'), [
    { id: 'a', expanded: false }, { id: 'b', expanded: false },
  ]);
});

test('all closed selected nodes expand, shallowest first', () => {
  const { a, a1 } = tree();
  a.expanded = false;
  a1.expanded = false;
  assert.deepEqual(planSelectionToggle([a1, a] as CollapsibleNode[], 'root'), [
    { id: 'a', expanded: true }, { id: 'a1', expanded: true },
  ]);
});

test('leaves and the displayed root are ignored', () => {
  const { root, leaf } = tree();
  assert.deepEqual(planSelectionToggle([root, leaf] as CollapsibleNode[], 'root'), []);
});

test('collapse-all keeps root and its children visible, expand-all opens every branch', () => {
  const { root, a, a1, b } = tree();
  assert.equal(hasOpenBranch(root), true);
  setDescendantsExpanded(root, false);
  assert.deepEqual([root.expanded, a.expanded, a1.expanded, b.expanded], [undefined, false, false, false]);
  assert.equal(hasOpenBranch(root), false);
  setDescendantsExpanded(root, true);
  assert.deepEqual([a.expanded, a1.expanded, b.expanded], [true, true, true]);
});
