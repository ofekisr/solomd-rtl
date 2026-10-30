import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EditorView } from '@codemirror/view';
import { stateWith, fakeView, fakeContext, type FakeContext } from '../editor/internal/cm-probe.ts';
import { defaults } from '../../stores/settings.ts';
import { en } from '../../i18n/en.ts';
import { currentFoldRanges } from '../../lib/cm-heading-fold.ts';
import { createFoldsFeature } from './contracts/index.ts';
import { applyFold, foldExtensionFor } from './internal/apply-fold.ts';

function defaultSettingKeys(): string[] {
  return Object.keys(defaults());
}


const DOC = '# A\ntext\n## B\nmore\n# C\nend';

function setup(foldingEnabled = true, anchor = 0) {
  const ctx0 = fakeContext({ settings: { foldingEnabled } });
  const fv = fakeView(stateWith(foldExtensionFor(ctx0, true), DOC, { anchor }));
  const ctx = fakeContext({ settings: { foldingEnabled }, view: () => fv as unknown as EditorView });
  return { ctx, fv };
}

test('all folds every foldable heading, none clears', () => {
  const { ctx, fv } = setup();
  applyFold(ctx, 'all');
  assert.equal(currentFoldRanges(fv.state).length, 3);
  applyFold(ctx, 'none');
  assert.equal(currentFoldRanges(fv.state).length, 0);
  assert.equal(fv.focused, 2);
});

test('level 2 folds only ## headings', () => {
  const { ctx, fv } = setup();
  applyFold(ctx, 'level', 2);
  const ranges = currentFoldRanges(fv.state);
  assert.equal(ranges.length, 1);
  assert.equal(DOC.slice(0, ranges[0].from).split('\n').pop(), '## B');
  assert.equal(DOC.slice(ranges[0].from, ranges[0].to), '\nmore');
  assert.equal(fv.focused, 1);
});

test('toggle folds the heading at the caret and unfolds on repeat', () => {
  const { ctx, fv } = setup(true, 0);
  applyFold(ctx, 'toggle');
  assert.equal(currentFoldRanges(fv.state).length, 1);
  applyFold(ctx, 'toggle');
  assert.equal(currentFoldRanges(fv.state).length, 0);
});

test('disabled folding toasts a hint and dispatches nothing', () => {
  const { ctx, fv } = setup(false);
  applyFold(ctx, 'all');
  assert.deepEqual((ctx as FakeContext).toasts, ['info:fold.disabledHint']);
  assert.equal(fv.dispatched.length, 0);
  assert.equal(fv.focused, 0);
});

test('applyFold without a view is a no-op', () => {
  const ctx = fakeContext({ settings: { foldingEnabled: true } });
  applyFold(ctx, 'all');
  assert.deepEqual(ctx.toasts, []);
});

test('foldExtensionFor(off) is empty', () => {
  assert.deepEqual(foldExtensionFor(fakeContext(), false), []);
});

test('fold memory round-trips across tab switches', () => {
  const feature = createFoldsFeature();
  const t1 = { id: 't1', filePath: '/n/fold-roundtrip-a.md' };
  const t2 = { id: 't2', filePath: '/n/fold-roundtrip-b.md' };
  const first = fakeContext({ settings: { foldingEnabled: true }, tabValue: t1 });
  const fv = fakeView(stateWith(foldExtensionFor(first, true), DOC, { anchor: 0 }));
  const view = fv as unknown as EditorView;
  feature.setup!(first);
  feature.onMount!(first, view);
  applyFold(fakeContext({ settings: { foldingEnabled: true }, view: () => view }), 'all');
  const before = currentFoldRanges(fv.state);
  assert.equal(before.length, 3);

  feature.beforeTabSwitch!(first, view, { oldId: 't1', newId: 't2' });
  const second = fakeContext({ settings: { foldingEnabled: true }, tabValue: t2 });
  const fv2 = fakeView(stateWith(foldExtensionFor(second, true), DOC, { anchor: 0 }));
  feature.onTabSwitch!(second, fv2 as unknown as EditorView, { oldId: 't1', newId: 't2' });
  assert.equal(currentFoldRanges(fv2.state).length, 0);

  feature.beforeTabSwitch!(second, fv2 as unknown as EditorView, { oldId: 't2', newId: 't1' });
  const back = fakeView(stateWith(foldExtensionFor(first, true), DOC, { anchor: 0 }));
  feature.onTabSwitch!(first, back as unknown as EditorView, { oldId: 't2', newId: 't1' });
  assert.deepEqual(currentFoldRanges(back.state), before);
});

test('restore does nothing when folding is disabled', () => {
  const feature = createFoldsFeature();
  const ctx = fakeContext({ settings: { foldingEnabled: false }, tabValue: { id: 'tx', filePath: '/n/fold-roundtrip-a.md' } });
  const fv = fakeView(stateWith(foldExtensionFor(ctx, true), DOC));
  feature.onMount!(ctx, fv as unknown as EditorView);
  assert.equal(currentFoldRanges(fv.state).length, 0);
});

test('fold slot builds from the setting; manifest resolves', () => {
  const feature = createFoldsFeature();
  const on = fakeContext({ settings: { foldingEnabled: true } });
  const off = fakeContext({ settings: { foldingEnabled: false } });
  const slot = feature.slots![0];
  assert.equal(slot.slot, 'fold');
  assert.equal(slot.deps(on), true);
  assert.deepEqual(slot.build(off), []);
  const known = defaultSettingKeys();
  for (const key of feature.settingsKeys) assert.ok(known.includes(key), key);
  for (const key of feature.i18nKeys) {
    const value = key.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown> | undefined)?.[p], en);
    assert.equal(typeof value, 'string', key);
  }
});

test('applyFold command defaults level to 2', () => {
  const { ctx, fv } = setup();
  createFoldsFeature().commands!.applyFold(ctx, 'level');
  assert.equal(currentFoldRanges(fv.state).length, 1);
});

test('beforeTabSwitch saves only when oldId is set', () => {
  const feature = createFoldsFeature();
  const ctx = fakeContext({ settings: { foldingEnabled: true }, tabValue: { id: 'q1', filePath: '/n/fold-oldid.md' } });
  const fv = fakeView(stateWith(foldExtensionFor(ctx, true), DOC));
  const view = fv as unknown as EditorView;
  feature.setup!(ctx);
  applyFold(fakeContext({ settings: { foldingEnabled: true }, view: () => view }), 'all');
  feature.beforeTabSwitch!(ctx, view, { newId: 'q2' });
  const fresh = fakeView(stateWith(foldExtensionFor(ctx, true), DOC));
  feature.onTabSwitch!(ctx, fresh as unknown as EditorView, { newId: 'q2' });
  assert.equal(currentFoldRanges(fresh.state).length, 0);
  feature.beforeTabSwitch!(ctx, view, { oldId: 'q1', newId: 'q2' });
  const again = fakeView(stateWith(foldExtensionFor(ctx, true), DOC));
  feature.onTabSwitch!(ctx, again as unknown as EditorView, { newId: 'q2' });
  assert.equal(currentFoldRanges(again.state).length, 3);
});
