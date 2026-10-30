import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Tab } from '../../../types.ts';
import { createEditorFeatureRegistry } from './editor-feature-registry.service.ts';
import { createEditorContext, type EditorContextSources } from './editor-context.ts';
import type { EditorFeaturesHost } from './useEditorFeatures.ts';

const tab = { id: 't1', content: '' } as Tab;

function sources(): EditorContextSources {
  return {
    props: { tab, focusMode: true, typewriterMode: false, spellCheck: true },
    settings: {} as EditorContextSources['settings'],
    themeMode: () => 'light',
    t: (k) => k,
    tabs: { setContent: () => {}, tabs: [tab], activeId: 't1' },
    toasts: { info: () => {}, success: () => {}, error: () => {} },
    view: () => null,
    citations: () => [],
  };
}

test('reads props live and finds tabs', () => {
  const ctx = createEditorContext(sources());
  assert.equal(ctx.props().focusMode, true);
  assert.equal(ctx.findTab('t1'), tab);
  assert.equal(ctx.findTab('zz'), undefined);
  assert.equal(ctx.activeTabId(), 't1');
});

test('run throws before bind, dispatches after', () => {
  const ctx = createEditorContext(sources());
  assert.throws(() => ctx.run('ping'), /before bind/);
  const registry = createEditorFeatureRegistry([
    { id: 'x', settingsKeys: [], i18nKeys: [], commands: { ping: (_c, n) => Number(n) + 1 } },
  ]);
  ctx.bind({ reconfigure: () => {} } as unknown as EditorFeaturesHost, registry);
  assert.equal(ctx.run('ping', 1), 2);
});

test('reconfigure forwards to the host', () => {
  const ctx = createEditorContext(sources());
  const seen: string[] = [];
  const registry = createEditorFeatureRegistry([]);
  ctx.bind({ reconfigure: (k: string) => { seen.push(k); } } as unknown as EditorFeaturesHost, registry);
  ctx.reconfigure('a:b', []);
  assert.deepEqual(seen, ['a:b']);
});
