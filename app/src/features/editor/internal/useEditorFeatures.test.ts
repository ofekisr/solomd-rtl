import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectScope, nextTick, reactive } from 'vue';
import { EditorState, type Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { createEditorFeatureRegistry } from './editor-feature-registry.service.ts';
import { useEditorFeatures } from './useEditorFeatures.ts';
import { fakeContext, fakeView } from './cm-probe.ts';
import type { EditorFeature } from '../contracts/editor-feature.port.ts';
import type { Tab } from '../../../types.ts';

function harness(extra: Partial<EditorFeature> = {}, withView = true) {
  const settings = reactive({ a: 1, b: 1 });
  const afters: Array<EditorView | null> = [];
  const log: string[] = [];
  const registry = createEditorFeatureRegistry([{
    id: 'x', settingsKeys: ['a', 'b'], i18nKeys: [],
    slots: [
      { slot: 'wrap', deps: () => settings.a, build: () => [] as Extension, after: (_c, v) => { log.push('wrap'); afters.push(v); } },
      { slot: 'font', deps: () => [settings.b, 'fixed'], build: () => [] as Extension, after: () => { log.push('font'); } },
    ],
    ...extra,
  }]);
  let view: ReturnType<typeof fakeView> | null = null;
  const ctx = fakeContext({ settings, view: () => view as unknown as EditorView });
  const scope = effectScope();
  const host = scope.run(() => useEditorFeatures(registry, ctx))!;
  if (withView) view = fakeView(EditorState.create({ extensions: host.extensions() }));
  return { settings, log, afters, scope, view: () => view! };
}

test('two slots changing in one tick → one dispatch, both afters', async () => {
  const h = harness();
  h.settings.a = 2; h.settings.b = 2;
  await nextTick();
  assert.equal(h.view().dispatched.length, 1);
  assert.deepEqual(h.log, ['wrap', 'font']);
  h.scope.stop();
});
test('array deps that stay element-wise equal do not reconfigure', async () => {
  const settings = reactive({ b: 1 });
  const log: string[] = [];
  const registry = createEditorFeatureRegistry([{
    id: 'x', settingsKeys: [], i18nKeys: [],
    slots: [{ slot: 'font', deps: () => { void settings.b; return ['fixed', 1]; }, build: () => [] as Extension, after: () => { log.push('font'); } }],
  }]);
  let view: ReturnType<typeof fakeView> | null = null;
  const ctx = fakeContext({ view: () => view as unknown as EditorView });
  const scope = effectScope();
  const host = scope.run(() => useEditorFeatures(registry, ctx))!;
  view = fakeView(EditorState.create({ extensions: host.extensions() }));
  settings.b = 2;
  await nextTick();
  assert.equal(view.dispatched.length, 0);
  assert.deepEqual(log, []);
  scope.stop();
});
test('extensions() reuses compartments so reconfigure applies to a state rebuilt from a later call', () => {
  const registry = createEditorFeatureRegistry([{
    id: 'c', settingsKeys: [], i18nKeys: [],
    slots: [{ slot: 'wrap', deps: () => 1, build: () => EditorState.readOnly.of(true) }],
  }]);
  let view: ReturnType<typeof fakeView> | null = null;
  const scope = effectScope();
  const host = scope.run(() => useEditorFeatures(registry, fakeContext({ view: () => view as unknown as EditorView })))!;
  host.extensions();
  view = fakeView(EditorState.create({ extensions: host.extensions() }));
  assert.equal(view.state.readOnly, true);
  host.reconfigure('c:wrap', EditorState.readOnly.of(false));
  assert.equal(view.state.readOnly, false);
  scope.stop();
});
test('changed slot with when() false is skipped in the dispatch but its after() runs', async () => {
  const settings = reactive({ a: 1, b: 1 });
  const log: string[] = [];
  const registry = createEditorFeatureRegistry([{
    id: 'x', settingsKeys: [], i18nKeys: [],
    slots: [
      { slot: 'wrap', deps: () => settings.a, build: () => [] as Extension, when: () => false, after: () => { log.push('wrap'); } },
      { slot: 'font', deps: () => settings.b, build: () => [] as Extension, after: () => { log.push('font'); } },
    ],
  }]);
  let view: ReturnType<typeof fakeView> | null = null;
  const ctx = fakeContext({ view: () => view as unknown as EditorView });
  const scope = effectScope();
  const host = scope.run(() => useEditorFeatures(registry, ctx))!;
  view = fakeView(EditorState.create({ extensions: host.extensions() }));
  settings.a = 2;
  await nextTick();
  assert.equal(view.dispatched.length, 0);
  assert.deepEqual(log, ['wrap']);
  settings.b = 2;
  await nextTick();
  assert.equal(view.dispatched.length, 1);
  assert.equal(Array.isArray(view.dispatched[0].effects) ? view.dispatched[0].effects.length : 0, 1);
  scope.stop();
});
test('lifecycle hooks fan out in registration order and run() delegates to the command', () => {
  const log: string[] = [];
  const mk = (id: string): EditorFeature => ({
    id, settingsKeys: [], i18nKeys: [],
    onMount: () => { log.push(`${id}:mount`); },
    beforeTabSwitch: (_c, _v, ids) => { log.push(`${id}:before:${ids.oldId}>${ids.newId}`); },
    onTabSwitch: (_c, _v, ids) => { log.push(`${id}:switch:${ids.newId}`); },
    onUnmount: () => { log.push(`${id}:unmount`); },
    commands: { [`${id}-cmd`]: (_c: unknown, n: unknown) => `${id}${String(n)}` },
  });
  const registry = createEditorFeatureRegistry([mk('a'), mk('b')]);
  const scope = effectScope();
  const host = scope.run(() => useEditorFeatures(registry, fakeContext()))!;
  const view = fakeView(EditorState.create({})) as unknown as EditorView;
  host.mount(view);
  host.beforeSwitchTab(view, { oldId: 'o', newId: 'n' });
  host.switchTab(view, { newId: 'n' });
  host.unmount(view);
  assert.deepEqual(log, [
    'a:mount', 'b:mount', 'a:before:o>n', 'b:before:o>n', 'a:switch:n', 'b:switch:n', 'a:unmount', 'b:unmount',
  ]);
  assert.equal(host.run('b-cmd', 7), 'b7');
  scope.stop();
});
test('setup cleanup runs on scope.stop()', () => {
  const calls: string[] = [];
  const h = harness({ setup: () => { calls.push('setup'); return () => { calls.push('cleanup'); }; } });
  assert.deepEqual(calls, ['setup']);
  h.scope.stop();
  assert.deepEqual(calls, ['setup', 'cleanup']);
});
test('a FeatureWatch runs once per tick with ctx.view()', async () => {
  const seen: unknown[] = [];
  const settings = reactive({ n: 0 });
  const registry = createEditorFeatureRegistry([{
    id: 'w', settingsKeys: [], i18nKeys: [],
    watches: [{ deps: () => settings.n, run: (_c, v) => { seen.push(v); } }],
  }]);
  const ctx = fakeContext({ view: () => null });
  const scope = effectScope();
  scope.run(() => useEditorFeatures(registry, ctx));
  settings.n = 1;
  settings.n = 2;
  await nextTick();
  assert.deepEqual(seen, [null]);
  scope.stop();
});
test('after runs with null when no view', async () => {
  const h = harness({}, false);
  h.settings.a = 2;
  await nextTick();
  assert.deepEqual(h.afters, [null]);
  h.scope.stop();
});
test('host.reconfigure dispatches one effect with a view, no throw without', () => {
  const h = harness();
  const registry = createEditorFeatureRegistry([]);
  const scope = effectScope();
  const withView = scope.run(() => useEditorFeatures(registry, fakeContext({ view: () => h.view() as unknown as EditorView })))!;
  withView.reconfigure('x:wrap', []);
  assert.equal(h.view().dispatched.length, 1);
  const noView = scope.run(() => useEditorFeatures(registry, fakeContext()))!;
  assert.doesNotThrow(() => noView.reconfigure('x:wrap', []));
  scope.stop();
  h.scope.stop();
});
test('fakeContext records reconfigure calls', () => {
  const ctx = fakeContext();
  ctx.reconfigure('a:b', []);
  assert.equal(ctx.reconfigured.length, 1);
});
test('a tab switch does not reconfigure slots on the outgoing doc', async () => {
  const current = reactive({ tab: { id: 'a', language: 'markdown' } });
  const log: string[] = [];
  const registry = createEditorFeatureRegistry([{
    id: 'x', settingsKeys: [], i18nKeys: [],
    slots: [{ slot: 'language', deps: (c) => c.tab().language, build: () => [] as Extension, after: () => { log.push('language'); } }],
  }]);
  let view: ReturnType<typeof fakeView> | null = null;
  const ctx = fakeContext({ view: () => view as unknown as EditorView, tab: () => current.tab as unknown as Tab });
  const scope = effectScope();
  const host = scope.run(() => useEditorFeatures(registry, ctx))!;
  view = fakeView(EditorState.create({ extensions: host.extensions() }));
  current.tab = { id: 'b', language: 'ts' };
  await nextTick();
  assert.equal(view.dispatched.length, 0);
  assert.deepEqual(log, []);
  current.tab = { id: 'b', language: 'json' };
  await nextTick();
  assert.equal(view.dispatched.length, 1);
  assert.deepEqual(log, ['language']);
  scope.stop();
});
