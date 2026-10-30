import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadBaseline } from './baseline-file.ts';
import { checkLibPurity, collectLibPurity } from './lib-purity.rule.ts';
import { REPO_ROOT } from './scan.ts';

test('no new lib/ file imports vue, pinia or @tauri-apps/*', () => {
  const failures = checkLibPurity(collectLibPurity(REPO_ROOT), loadBaseline().libPurity);
  assert.deepEqual(failures, [], failures.join('\n'));
});
