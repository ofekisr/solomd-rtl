import assert from 'node:assert/strict';
import test from 'node:test';
import { defaults } from '../../../stores/settings.ts';
import { fakeContext, stateWith } from '../../editor/internal/cm-probe.ts';
import { createVimFeature } from './vim.feature.ts';

const slot = () => {
  const found = createVimFeature().slots?.[0];
  assert.ok(found);
  return found;
};

test('manifest: settingsKeys exist in defaults()', () => {
  const feature = createVimFeature();
  assert.equal(feature.id, 'vim');
  for (const key of feature.settingsKeys) assert.ok(key in defaults(), key);
  assert.deepEqual(feature.i18nKeys, []);
});

test('vim slot: vimMode false builds nothing', () => {
  assert.deepEqual(slot().build(fakeContext({ settings: { vimMode: false } })), []);
});

test('vim slot: vimMode true builds an extension an EditorState accepts', () => {
  const ext = slot().build(fakeContext({ settings: { vimMode: true } }));
  assert.notDeepEqual(ext, []);
  assert.doesNotThrow(() => stateWith(ext));
});

test('vim slot deps read settings.vimMode', () => {
  assert.equal(slot().slot, 'vim');
  assert.equal(slot().deps(fakeContext({ settings: { vimMode: true } })), true);
});
