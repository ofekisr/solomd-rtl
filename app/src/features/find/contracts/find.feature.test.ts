import assert from 'node:assert/strict';
import test from 'node:test';
import { getSearchQuery } from '@codemirror/search';
import { fakeContext, stateWith } from '../../editor/contracts/testkit.ts';
import { createFindFeature } from './find.feature.ts';

test('manifest: id find, no settings, no i18n', () => {
  const feature = createFindFeature();
  assert.deepEqual([feature.id, feature.settingsKeys, feature.i18nKeys], ['find', [], []]);
});

test('search slot builds a state carrying the search config', () => {
  const ctx = fakeContext({ tabValue: { filePath: '/tmp/a.md' } });
  const ext = createFindFeature().extensions?.search?.(ctx);
  assert.ok(ext);
  const state = stateWith(ext, 'hello');
  assert.equal(getSearchQuery(state).search, '');
});

test('openFind without a view does nothing', () => {
  const ctx = fakeContext({ view: () => null });
  assert.doesNotThrow(() => createFindFeature().commands?.openFind?.(ctx));
});
