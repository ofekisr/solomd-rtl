import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeContext, stateWith } from '../../editor/contracts/testkit.ts';
import { createVimFeature } from './vim.feature.ts';

const slot = () => {
  const found = createVimFeature().slots?.[0];
  assert.ok(found);
  return found;
};

test('manifest: id and no i18n keys', () => {
  const feature = createVimFeature();
  assert.equal(feature.id, 'vim');
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
