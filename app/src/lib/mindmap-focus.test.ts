import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { buildFreezeStrip, canAnchor, getTabFocus, getTabStripRoot, pathTo, setTabFocus, setTabStripRoot } from './mindmap-focus.ts';

const MAP: NodeObj = {
  id: 'root', topic: 'Root', children: [
    { id: 'a', topic: 'Phase 8', icons: ['🚀'], tags: ['x', { text: 'y' }] as NodeObj['tags'], style: { color: '#f00' }, children: [
      { id: 'a1', topic: 'Lens', children: [{ id: 'a1x', topic: 'Matrix' }] },
    ] },
    { id: 'b', topic: 'שלב 9' },
  ],
} as NodeObj;

test('buildFreezeStrip returns null for a map with no level 2', () => {
  assert.equal(buildFreezeStrip({ id: 'root', topic: 'R' } as NodeObj, null), null);
});

test('without focus: root + every level-2 chip, nothing active, no breadcrumb', () => {
  const strip = buildFreezeStrip(MAP, null);
  assert.equal(strip?.root.topic, 'Root');
  assert.deepEqual(strip?.level2.map((c) => c.id), ['a', 'b']);
  assert.equal(strip?.activeLevel2Id, null);
  assert.deepEqual(strip?.breadcrumb, []);
});

test('chips carry icons, tag text and colors', () => {
  const chip = buildFreezeStrip(MAP, null)?.level2[0];
  assert.deepEqual(chip?.icons, ['🚀']);
  assert.deepEqual(chip?.tags, ['x', 'y']);
  assert.equal(chip?.color, '#f00');
});

test('deep focus highlights its level-2 ancestor and lists level 3 down to the focus', () => {
  const strip = buildFreezeStrip(MAP, 'a1x');
  assert.equal(strip?.activeLevel2Id, 'a');
  assert.deepEqual(strip?.breadcrumb.map((c) => c.topic), ['Lens', 'Matrix']);
});

test('focus on a level-2 node has no breadcrumb', () => {
  const strip = buildFreezeStrip(MAP, 'b');
  assert.equal(strip?.activeLevel2Id, 'b');
  assert.deepEqual(strip?.breadcrumb, []);
});

test('unknown focus id behaves like no focus', () => {
  assert.equal(buildFreezeStrip(MAP, 'gone')?.activeLevel2Id, null);
});

test('pathTo walks root to target', () => {
  assert.deepEqual(pathTo(MAP, 'a1x')?.map((n) => n.id), ['root', 'a', 'a1', 'a1x']);
  assert.equal(pathTo(MAP, 'gone'), null);
});

test('tab focus store is keyed and clearable', () => {
  setTabFocus('t1', 'a');
  assert.equal(getTabFocus('t1'), 'a');
  assert.equal(getTabFocus('t2'), null);
  setTabFocus('t1', null);
  assert.equal(getTabFocus('t1'), null);
});

test('a strip root re-anchors the strip on that node and lists the path above it', () => {
  const strip = buildFreezeStrip(MAP, null, 'a1');
  assert.deepEqual(strip?.ancestors.map((c) => c.id), ['root', 'a']);
  assert.equal(strip?.root.id, 'a1');
  assert.deepEqual(strip?.level2.map((c) => c.id), ['a1x']);
  assert.equal(strip?.branchIndex, 0);
});

test('focus inside the strip root highlights the child; focus outside highlights nothing', () => {
  assert.equal(buildFreezeStrip(MAP, 'a1x', 'a')?.activeLevel2Id, 'a1');
  assert.deepEqual(buildFreezeStrip(MAP, 'a1x', 'a')?.breadcrumb.map((c) => c.id), ['a1x']);
  assert.equal(buildFreezeStrip(MAP, 'b', 'a')?.activeLevel2Id, null);
});

test('a missing or leaf strip root falls back to the map root', () => {
  assert.equal(buildFreezeStrip(MAP, null, 'gone')?.root.id, 'root');
  assert.equal(buildFreezeStrip(MAP, null, 'b')?.root.id, 'root');
  assert.deepEqual(buildFreezeStrip(MAP, null, 'b')?.ancestors, []);
  assert.equal(canAnchor(MAP, 'b'), false);
  assert.equal(canAnchor(MAP, 'a1'), true);
  assert.equal(canAnchor(MAP, 'root'), true);
});

test('strip root is remembered per tab', () => {
  setTabStripRoot('tab-x', 'a');
  assert.equal(getTabStripRoot('tab-x'), 'a');
  setTabStripRoot('tab-x', null);
  assert.equal(getTabStripRoot('tab-x'), null);
});
