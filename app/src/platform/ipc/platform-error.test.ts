import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from './platform-error.ts';

test('PlatformUnsupportedError names the operation', () => {
  const error = new PlatformUnsupportedError('read_file');
  assert.equal(error.operation, 'read_file');
  assert.equal(error.name, 'PlatformUnsupportedError');
  assert.match(error.message, /read_file/);
  assert.ok(error instanceof Error);
});
