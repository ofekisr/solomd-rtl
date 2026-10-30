import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkFeatureBoundary } from './feature-boundary.rule.ts';
import { REPO_ROOT } from './scan.ts';

test("no file imports another feature's internal/", () => {
  const failures = checkFeatureBoundary(REPO_ROOT);
  assert.deepEqual(failures, [], failures.join('\n'));
});
