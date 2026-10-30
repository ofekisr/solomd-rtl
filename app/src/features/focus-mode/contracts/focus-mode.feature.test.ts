import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeContext, stateWith } from '../../editor/contracts/testkit.ts';
import { createFocusModeFeature } from './focus-mode.feature.ts';

const slotNamed = (name: string) => {
  const slot = createFocusModeFeature().slots?.find((s) => s.slot === name);
  assert.ok(slot);
  return slot;
};

test('manifest: id focus-mode, no settings, no i18n', () => {
  const feature = createFocusModeFeature();
  assert.deepEqual([feature.id, feature.settingsKeys, feature.i18nKeys], ['focus-mode', [], []]);
  assert.deepEqual(feature.slots?.map((s) => s.slot), ['focus', 'typewriter']);
});

for (const [slot, prop] of [['focus', 'focusMode'], ['typewriter', 'typewriterMode']] as const) {
  test(`${slot}: off builds nothing`, () => {
    assert.deepEqual(slotNamed(slot).build(fakeContext({ props: { [prop]: false } })), []);
  });

  test(`${slot}: on builds an extension an EditorState accepts`, () => {
    const ext = slotNamed(slot).build(fakeContext({ props: { [prop]: true } }));
    assert.notDeepEqual(ext, []);
    assert.doesNotThrow(() => stateWith(ext, 'one\n\ntwo'));
  });

  test(`${slot}: deps read props().${prop}`, () => {
    assert.equal(slotNamed(slot).deps(fakeContext({ props: { [prop]: true } })), true);
    assert.equal(slotNamed(slot).deps(fakeContext({ props: { [prop]: false } })), false);
  });
}
