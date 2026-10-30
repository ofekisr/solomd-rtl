import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadBaseline } from './baseline-file.ts';
import { checkFeaturePurity, collectFeaturePurityViolations } from './feature-purity.rule.ts';
import { REPO_ROOT } from './scan.ts';

test('no new features/ file outside ui/, use*.ts and *.store.ts imports vue or pinia', () => {
  const violations = collectFeaturePurityViolations(REPO_ROOT);
  const modules = new Map(violations.map((violation) => [violation.path, violation.module]));
  const failures = checkFeaturePurity(violations.map((violation) => violation.path), loadBaseline().featurePurity, modules);
  assert.deepEqual(failures, [], failures.join('\n'));
});
