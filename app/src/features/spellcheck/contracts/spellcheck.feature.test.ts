import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorView } from '@codemirror/view';
import { fakeContext, stateWith } from '../../editor/contracts/testkit.ts';
import { createSpellcheckFeature } from './spellcheck.feature.ts';

const spellcheckAttr = (spellCheck: boolean) => {
  const slot = createSpellcheckFeature().slots?.[0];
  assert.ok(slot);
  const state = stateWith(slot.build(fakeContext({ props: { spellCheck } })));
  return state.facet(EditorView.contentAttributes);
};

test('manifest: id and no i18n keys', () => {
  const feature = createSpellcheckFeature();
  assert.equal(feature.id, 'spellcheck');
  assert.deepEqual(feature.i18nKeys, []);
});

test('spellcheck-attr: true/false from props', () => {
  assert.ok(spellcheckAttr(true).some((a) => a.spellcheck === 'true'));
  assert.ok(spellcheckAttr(false).some((a) => a.spellcheck === 'false'));
});

test('spellcheck-attr deps read props().spellCheck', () => {
  const slot = createSpellcheckFeature().slots?.[0];
  assert.equal(slot?.slot, 'spellcheck-attr');
  assert.equal(slot?.deps(fakeContext({ props: { spellCheck: false } })), false);
  assert.equal(slot?.deps(fakeContext({ props: { spellCheck: true } })), true);
});

test('md-spellcheck is empty for non-markdown, populated for markdown', () => {
  const build = createSpellcheckFeature().extensions?.['md-spellcheck'];
  assert.ok(build);
  const settings = { spellcheckEnabled: true };
  assert.deepEqual(build(fakeContext({ settings, tabValue: { language: 'ts' } })), []);
  const md = build(fakeContext({ settings, tabValue: { language: 'markdown' } }));
  assert.ok(Array.isArray(md) && md.length > 0);
  assert.doesNotThrow(() => stateWith(md));
});
