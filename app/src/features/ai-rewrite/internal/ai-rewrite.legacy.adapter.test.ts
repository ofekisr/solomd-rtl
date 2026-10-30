import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAiActivity } from '../../../lib/ai-activity.ts';
import { stateWith } from '../../editor/contracts/testkit.ts';
import { legacyAiRewriteAdapter } from './ai-rewrite.legacy.adapter.ts';

test('isLocked delegates to the ai-activity state', () => {
  const path = '/adapter-test.md';
  assert.equal(legacyAiRewriteAdapter.isLocked(path), false);
  assert.equal(legacyAiRewriteAdapter.isLocked(undefined), false);
  applyAiActivity({ path, active: true, holder: 'test' });
  assert.equal(legacyAiRewriteAdapter.isLocked(path), true);
});

test('extension builds into an editor state', () => {
  const ext = legacyAiRewriteAdapter.extension('Mod-j');
  assert.ok(Array.isArray(ext) && ext.length > 0);
  assert.doesNotThrow(() => stateWith(ext));
});
