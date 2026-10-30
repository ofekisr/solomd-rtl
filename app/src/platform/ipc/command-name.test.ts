import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snakeToCamel } from './command-name.ts';

test('snakeToCamel converts command names', () => {
  assert.equal(snakeToCamel('read_file'), 'readFile');
  assert.equal(snakeToCamel('ai_list_models'), 'aiListModels');
  assert.equal(snakeToCamel('cjk_proofread'), 'cjkProofread');
  assert.equal(snakeToCamel('open_devtools'), 'openDevtools');
  assert.equal(snakeToCamel('list'), 'list');
});
