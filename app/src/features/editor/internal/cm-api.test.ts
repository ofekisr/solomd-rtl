import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cmGetLineSelection } from './cm-api.ts';
import { fakeView, stateWith } from './cm-probe.ts';

const DOC = 'one\ntwo\nthree';

test('empty selection reports the caret line', () => {
  const sel = cmGetLineSelection(fakeView(stateWith([], DOC, { anchor: 5 })));
  assert.deepEqual(sel, { fromLine: 2, toLine: 2, headLine: 2, isEmpty: true });
});

test('multi-line selection spans lines', () => {
  const sel = cmGetLineSelection(fakeView(stateWith([], DOC, { anchor: 1, head: 10 })));
  assert.deepEqual(sel, { fromLine: 1, toLine: 3, headLine: 3, isEmpty: false });
});

test('selection ending at a line start excludes that line', () => {
  const sel = cmGetLineSelection(fakeView(stateWith([], DOC, { anchor: 0, head: 8 })));
  assert.deepEqual(sel, { fromLine: 1, toLine: 2, headLine: 3, isEmpty: false });
});
