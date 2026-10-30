import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError, snakeToCamel } from './command.port.ts';

test('snakeToCamel converts command names', () => {
  assert.equal(snakeToCamel('read_file'), 'readFile');
  assert.equal(snakeToCamel('ai_list_models'), 'aiListModels');
  assert.equal(snakeToCamel('cjk_proofread'), 'cjkProofread');
  assert.equal(snakeToCamel('open_devtools'), 'openDevtools');
  assert.equal(snakeToCamel('list'), 'list');
});

test('PlatformUnsupportedError names the operation', () => {
  const error = new PlatformUnsupportedError('read_file');
  assert.equal(error.operation, 'read_file');
  assert.equal(error.name, 'PlatformUnsupportedError');
  assert.match(error.message, /read_file/);
  assert.ok(error instanceof Error);
});
