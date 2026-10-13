import assert from 'node:assert/strict';
import { test } from 'node:test';
import { branchColorAt, readFrameVars } from './mindmap-frame-style.ts';

test('branch colour prefers the node own colour, then cycles the palette', () => {
  assert.equal(branchColorAt(['#a', '#b'], 3, '#own'), '#own');
  assert.equal(branchColorAt(['#a', '#b'], 3), '#b');
  assert.equal(branchColorAt([], 0), undefined);
});

test('readFrameVars keeps only non-empty trimmed values', () => {
  const vars = readFrameVars((name) => (name === '--root-bgcolor' ? '  #123 ' : ''));
  assert.deepEqual(vars, { '--root-bgcolor': '#123' });
});
