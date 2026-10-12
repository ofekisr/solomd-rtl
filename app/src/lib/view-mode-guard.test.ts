import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addViewModeGuard, isViewModeChangeAllowed } from './view-mode-guard.ts';

test('no guards allows every change', () => {
  assert.equal(isViewModeChangeAllowed('split'), true);
});

test('a blocking guard vetoes until removed', () => {
  const seen: string[] = [];
  const remove = addViewModeGuard((next) => { seen.push(next); return next !== 'reading'; });
  assert.equal(isViewModeChangeAllowed('split'), true);
  assert.equal(isViewModeChangeAllowed('reading'), false);
  remove();
  assert.equal(isViewModeChangeAllowed('reading'), true);
  assert.deepEqual(seen, ['split', 'reading']);
});

test('every guard must allow', () => {
  const removeA = addViewModeGuard(() => true);
  const removeB = addViewModeGuard(() => false);
  assert.equal(isViewModeChangeAllowed('edit'), false);
  removeA();
  removeB();
});
