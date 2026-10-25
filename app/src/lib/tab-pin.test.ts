import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clampReorderIndex, closableIds, pinnedCount, togglePinned } from './tab-pin.ts';

const fresh = (): { id: string; pinned?: boolean }[] => [
  { id: 'p1', pinned: true },
  { id: 'p2', pinned: true },
  { id: 'a' },
  { id: 'b' },
];
const tabs = fresh();
const labels = (list: { id: string; pinned?: boolean }[]): string[] => list.map((t) => `${t.id}${t.pinned ? '*' : ''}`);

test('pinnedCount counts the pinned group', () => {
  assert.equal(pinnedCount(tabs), 2);
  assert.equal(pinnedCount([]), 0);
});

test('closableIds drops pinned tabs from a bulk close', () => {
  assert.deepEqual(closableIds(['p1', 'a', 'p2', 'b'], tabs), ['a', 'b']);
});

test('clampReorderIndex keeps each tab inside its own group', () => {
  assert.equal(clampReorderIndex(tabs, 'p1', 4), 2);
  assert.equal(clampReorderIndex(tabs, 'p2', 0), 0);
  assert.equal(clampReorderIndex(tabs, 'b', 0), 2);
  assert.equal(clampReorderIndex(tabs, 'a', 4), 4);
  assert.equal(clampReorderIndex(tabs, 'missing', 1), 1);
});

test('togglePinned appends a newly pinned tab to the pinned group', () => {
  const list = fresh();
  togglePinned(list, 'b');
  assert.deepEqual(labels(list), ['p1*', 'p2*', 'b*', 'a']);
});

test('togglePinned puts an unpinned tab first among the unpinned', () => {
  const list = fresh();
  togglePinned(list, 'p1');
  assert.deepEqual(labels(list), ['p2*', 'p1', 'a', 'b']);
});

test('togglePinned on an unknown id leaves the order alone', () => {
  const list = fresh();
  const before = [...list];
  togglePinned(list, 'zz');
  assert.deepEqual(list, before);
  list.forEach((t, i) => assert.equal(t, before[i]));
});
