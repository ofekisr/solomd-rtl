import assert from 'node:assert/strict';
import { test } from 'node:test';

import { reorderFor, destinationFor } from './tree-reorder.ts';

test('reorderFor ignores no row, the dragged row and rows of the other kind', () => {
  assert.equal(reorderFor(null, '/v/a.md', false), null);
  assert.equal(reorderFor({ path: '/v/a.md', isDir: false, frac: 0.1 }, '/v/a.md', false), null);
  assert.equal(reorderFor({ path: '/v/d', isDir: true, frac: 0.1 }, '/v/a.md', false), null);
});

test('reorderFor ignores rows in another folder', () => {
  assert.equal(reorderFor({ path: '/v/x/b.md', isDir: false, frac: 0.1 }, '/v/a.md', false), null);
});

test('file rows split in half', () => {
  assert.deepEqual(reorderFor({ path: '/v/b.md', isDir: false, frac: 0.49 }, '/v/a.md', false), { path: '/v/b.md', pos: 'before' });
  assert.deepEqual(reorderFor({ path: '/v/b.md', isDir: false, frac: 0.5 }, '/v/a.md', false), { path: '/v/b.md', pos: 'after' });
});

test('folder rows only reorder on the outer quarters', () => {
  assert.deepEqual(reorderFor({ path: '/v/d', isDir: true, frac: 0.2 }, '/v/e', true), { path: '/v/d', pos: 'before' });
  assert.equal(reorderFor({ path: '/v/d', isDir: true, frac: 0.5 }, '/v/e', true), null);
  assert.equal(reorderFor({ path: '/v/d', isDir: true, frac: 0.75 }, '/v/e', true), null);
  assert.deepEqual(reorderFor({ path: '/v/d', isDir: true, frac: 0.8 }, '/v/e', true), { path: '/v/d', pos: 'after' });
});

test('destinationFor: folders and the root area are targets, files are not', () => {
  assert.equal(destinationFor(null, '/v'), null);
  assert.equal(destinationFor({ kind: 'row', path: '/v/d', isDir: true }, '/v'), '/v/d');
  assert.equal(destinationFor({ kind: 'row', path: '/v/a.md', isDir: false }, '/v'), null);
  assert.equal(destinationFor({ kind: 'root-area' }, '/v'), '/v');
  assert.equal(destinationFor({ kind: 'root-area' }, undefined), null);
});
