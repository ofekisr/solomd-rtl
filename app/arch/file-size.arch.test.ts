import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadBaseline } from './baseline-file.ts';
import { checkFileSize, collectFileSize } from './file-size.rule.ts';
import { REPO_ROOT } from './scan.ts';

test('no file grows past its size budget or baseline', () => {
  const failures = checkFileSize(collectFileSize(REPO_ROOT), loadBaseline().fileSize);
  assert.deepEqual(failures, [], failures.join('\n'));
});
