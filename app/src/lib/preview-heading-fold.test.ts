import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingKeys, hiddenBlocks, type FoldBlock } from './preview-heading-fold.ts';

const doc: FoldBlock[] = [
  { level: 1, key: 'A#0' },
  { level: null },
  { level: 2, key: 'B#0' },
  { level: null },
  { level: 3, key: 'C#0' },
  { level: null },
  { level: 2, key: 'D#0' },
  { level: null },
  { level: 1, key: 'E#0' },
  { level: null },
];

test('nothing folded hides nothing', () => {
  assert.ok(hiddenBlocks(doc, new Set()).every((h) => !h));
});

test('folding a heading hides up to the next same-or-shallower heading', () => {
  assert.deepEqual(
    hiddenBlocks(doc, new Set(['B#0'])),
    [false, false, false, true, true, true, false, false, false, false],
  );
});

test('a top-level fold swallows nested folds', () => {
  assert.deepEqual(
    hiddenBlocks(doc, new Set(['A#0', 'C#0'])),
    [false, true, true, true, true, true, true, true, false, false],
  );
});

test('duplicate titles get distinct keys', () => {
  assert.deepEqual(headingKeys(['Intro', 'Notes', 'Intro']), ['Intro#0', 'Notes#0', 'Intro#1']);
});
