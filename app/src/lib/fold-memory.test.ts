import { test } from 'node:test';
import assert from 'node:assert/strict';

import { foldRangeAtLine } from './heading-fold.ts';
import {
  anchorSnapshot,
  captureFolds,
  foldAnchorsFor,
  foldRangesFor,
  recallFolds,
  rememberFolds,
} from './fold-memory.ts';

const DOC = ['# Title', '', 'Intro.', '', '## A', '', 'Body A.', '', '## B', '', 'Body B.'].join('\n');

test('unchanged text restores the exact ranges, including non-heading folds', () => {
  const heading = foldRangeAtLine(DOC, 4)!;
  const code = { from: 10, to: 12 };
  const snap = captureFolds(DOC, [heading, code]);
  assert.deepEqual(foldRangesFor(DOC, snap), [heading, code]);
});

test('heading folds are captured as anchors', () => {
  const snap = captureFolds(DOC, [foldRangeAtLine(DOC, 8)!]);
  assert.deepEqual(snap.anchors, [{ line: 8, title: '## B' }]);
});

test('changed text re-matches heading folds by title and drops the rest', () => {
  const snap = captureFolds(DOC, [foldRangeAtLine(DOC, 8)!, { from: 10, to: 12 }]);
  const edited = `New first line\n\n${DOC}`;
  assert.deepEqual(foldRangesFor(edited, snap), [foldRangeAtLine(edited, 10)!]);
});

test('a heading that disappeared is not refolded', () => {
  const snap = captureFolds(DOC, [foldRangeAtLine(DOC, 8)!]);
  assert.deepEqual(foldRangesFor(DOC.replace('## B', '## Renamed'), snap), []);
});

test('anchor snapshots restore plain-editor folds', () => {
  const snap = anchorSnapshot(DOC, [{ line: 4, title: '## A' }]);
  assert.deepEqual(foldAnchorsFor(`x\n${DOC}`, snap), [{ line: 5, title: '## A' }]);
});

test('remember / recall per key; empty snapshots forget', () => {
  rememberFolds('/a.md', captureFolds(DOC, [foldRangeAtLine(DOC, 4)!]));
  assert.equal(recallFolds('/a.md')?.anchors.length, 1);
  assert.equal(recallFolds('/b.md'), null);
  rememberFolds('/a.md', captureFolds(DOC, []));
  assert.equal(recallFolds('/a.md'), null);
});
