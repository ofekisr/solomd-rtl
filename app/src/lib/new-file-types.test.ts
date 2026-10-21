import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_NEW_FILE_EXT, NEW_FILE_TYPES, newFilePlaceholder } from './new-file-types.ts';

test('offers the requested file types in order', () => {
  assert.deepEqual(
    NEW_FILE_TYPES.map((t) => t.ext),
    ['md', 'mmap', 'json', 'yaml', 'html', 'js', 'ts', 'py', 'sh'],
  );
});

test('placeholder defaults to markdown', () => {
  assert.equal(DEFAULT_NEW_FILE_EXT, 'md');
  assert.equal(newFilePlaceholder(), 'untitled.md');
});

test('placeholder uses the chosen extension', () => {
  assert.equal(newFilePlaceholder('py'), 'untitled.py');
  assert.equal(newFilePlaceholder('mmap'), 'untitled.mmap');
});
