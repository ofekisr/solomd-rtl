import assert from 'node:assert/strict';
import { test } from 'node:test';

import { joinPath, rootRelative, segmentsUnderRoot, orderKey, orderFilePath, pathFromRelative } from './tree-paths.ts';

test('joinPath keeps the separator the parent uses', () => {
  assert.equal(joinPath('/a/b', 'c.md'), '/a/b/c.md');
  assert.equal(joinPath('/a/b/', 'c.md'), '/a/b/c.md');
  assert.equal(joinPath('C:\\a', 'c.md'), 'C:\\a\\c.md');
  assert.equal(joinPath('C:\\a\\', 'c.md'), 'C:\\a\\c.md');
});

test('rootRelative is empty outside the root and slash-normalised inside', () => {
  assert.equal(rootRelative('/v', '/v/a/b.md'), 'a/b.md');
  assert.equal(rootRelative('/v/', '/v/a'), 'a');
  assert.equal(rootRelative('/v', '/other/a'), '');
  assert.equal(rootRelative('C:\\v', 'C:\\v\\a\\b.md'), 'a/b.md');
  assert.equal(rootRelative('/v', '/v'), '');
});

test('segmentsUnderRoot', () => {
  assert.equal(segmentsUnderRoot(undefined, '/v/a'), null);
  assert.deepEqual(segmentsUnderRoot('/v', '/v'), []);
  assert.deepEqual(segmentsUnderRoot('/v', '/v/a/b.md'), ['a', 'b.md']);
  assert.equal(segmentsUnderRoot('/v', '/vault/a'), null);
  assert.deepEqual(segmentsUnderRoot('C:\\v', 'C:\\v\\a\\b'), ['a', 'b']);
});

test('orderKey is empty for the root and relative for subfolders', () => {
  assert.equal(orderKey('/v', '/v'), '');
  assert.equal(orderKey('/v', '/v/a/b'), 'a/b');
  assert.equal(orderKey(null, '/v/a'), 'v/a');
});

test('orderFilePath and pathFromRelative', () => {
  assert.equal(orderFilePath('/v'), '/v/.solomd/order.json');
  assert.equal(pathFromRelative('/v', ''), '/v');
  assert.equal(pathFromRelative('/v', 'a/b'), '/v/a/b');
});
