import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { EXTENSION_SLOTS } from '../../contracts/editor-feature.port.ts';
import type { EditorFeature, EditorFeatureContext, ReconfigurableSlot } from '../../contracts/editor-feature.port.ts';
import { fakeContext, stateWith } from '../cm-probe.ts';
import { createAppearanceFeature, LANGUAGE_SLOT_KEY } from './appearance.feature.ts';
import { createCoreFeature, DEFAULT_CURSOR_BLINK_MS, SOLID_CURSOR_BLINK_MS } from './core.feature.ts';
import { createLiveRenderFeature, liveBlocksOptions } from './live-render.feature.ts';


const SETTINGS = {
  solidCursor: false, highlightCurrentLine: true, showLineNumbers: true, wordWrap: true,
  fontSize: 16, fontFamily: 'system', viewMode: 'liveEdit', livePreview: true, alwaysShowMarkers: false,
  plantumlEnabled: false, plantumlServer: '', language: 'en',
};

function ctxWith(settings: Record<string, unknown> = {}, language = 'markdown'): EditorFeatureContext {
  return fakeContext({ settings: { ...SETTINGS, ...settings }, tabValue: { language: language as never } });
}
async function waitUntil(done: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!done() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
}
function withWindow(run: (target: EventTarget) => void): void {
  const globals = globalThis as unknown as { window?: EventTarget };
  const hadWindow = 'window' in globals;
  if (!hadWindow) globals.window = new EventTarget();
  try { run(globals.window!); } finally { if (!hadWindow) delete globals.window; }
}
function slotOf(feature: EditorFeature, name: string): ReconfigurableSlot {
  const slot = feature.slots?.find((s) => s.slot === name);
  assert.ok(slot, `slot ${name}`);
  return slot;
}
function flatBindings(ext: Extension): Array<{ key?: string }> {
  return stateWith(ext).facet(keymap).flat();
}

test('core: static extensions build an EditorState', () => {
  const core = createCoreFeature();
  for (const [name, build] of Object.entries(core.extensions ?? {})) {
    const ext = build?.(ctxWith());
    assert.doesNotThrow(() => EditorState.create({ extensions: ext }), name);
  }
  assert.deepEqual(Object.keys(core.extensions ?? {}), ['ime-guard', 'history', 'drag-aware', 'selection-tools', 'keymap', 'task-list', 'stable-click']);
});

test('core: keymap drops Mod-i (#296) and keeps history bindings', () => {
  const bindings = flatBindings(createCoreFeature().extensions!.keymap!(ctxWith()));
  assert.equal(bindings.some((b) => b.key === 'Mod-i'), false);
  assert.equal(bindings.some((b) => b.key === 'Mod-z'), true);
  assert.equal(bindings.some((b) => b.key === 'Tab'), true);
  assert.equal(bindings.some((b) => b.key === 'Mod-f'), true);
});

test('core: cursor slot builds for solid and blinking', () => {
  const slot = slotOf(createCoreFeature(), 'cursor');
  assert.equal(SOLID_CURSOR_BLINK_MS, 0);
  assert.equal(DEFAULT_CURSOR_BLINK_MS, 1200);
  for (const solid of [true, false]) {
    const ctx = ctxWith({ solidCursor: solid });
    assert.equal(slot.deps(ctx), solid);
    assert.doesNotThrow(() => stateWith(slot.build(ctx)));
  }
});

test('core: active-line, line-numbers, wrap slots toggle', () => {
  const core = createCoreFeature();
  const on = ctxWith();
  const off = ctxWith({ highlightCurrentLine: false, showLineNumbers: false, wordWrap: false });
  assert.deepEqual(slotOf(core, 'active-line').build(off), []);
  assert.doesNotThrow(() => stateWith(slotOf(core, 'active-line').build(on)));
  assert.deepEqual(slotOf(core, 'line-numbers').build(off), []);
  assert.notDeepEqual(slotOf(core, 'line-numbers').build(on), []);
  assert.deepEqual(slotOf(core, 'wrap').build(off), []);
  assert.equal(slotOf(core, 'wrap').build(on), EditorView.lineWrapping);
  assert.equal(slotOf(core, 'wrap').deps(on), true);
});

test('appearance: direction is ltr for code, auto for markdown/plaintext', () => {
  const slot = slotOf(createAppearanceFeature(), 'direction');
  const dirOf = (language: string, doc: string): unknown => {
    const state = stateWith(slot.build(ctxWith({}, language)), doc);
    return state.facet(EditorView.contentAttributes).map((a) => (a as { dir?: string }).dir).find(Boolean);
  };
  assert.equal(dirOf('typescript', 'שלום עולם'), 'ltr');
  assert.equal(dirOf('markdown', 'שלום עולם'), 'rtl');
  assert.equal(dirOf('plaintext', 'שלום עולם'), 'rtl');
  assert.equal(dirOf('markdown', 'hello'), 'ltr');
  assert.equal(slot.deps(ctxWith({}, 'typescript')), 'typescript');
});

test('appearance: language slot builds and exposes the reconfigure key', () => {
  const slot = slotOf(createAppearanceFeature(), 'language');
  assert.equal(LANGUAGE_SLOT_KEY, 'appearance:language');
  assert.doesNotThrow(() => stateWith(slot.build(ctxWith({}, 'markdown'))));
});

test('appearance: lazy language reconfigures only while the tab keeps that language', async () => {
  const feature = createAppearanceFeature();
  const kept = fakeContext({ settings: SETTINGS, tabValue: { language: 'lua' as never } });
  const switched = fakeContext({ settings: SETTINGS, tabValue: { language: 'lua' as never } });
  const preloaded = fakeContext({ settings: SETTINGS, tabValue: { language: 'python' as never } });
  feature.onMount?.(kept, null as never);
  feature.onTabSwitch?.(switched, null as never, { newId: 't1' });
  (switched.tab() as { language: string }).language = 'markdown';
  feature.onMount?.(preloaded, null as never);
  await waitUntil(() => kept.reconfigured.length > 0);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(kept.reconfigured.map(([k]) => k), [LANGUAGE_SLOT_KEY]);
  assert.deepEqual(switched.reconfigured, []);
  assert.deepEqual(preloaded.reconfigured, []);
});

test('appearance: theme.after dispatches solomd:cm-relayout', () => {
  const fired: string[] = [];
  const slot = slotOf(createAppearanceFeature(), 'theme');
  withWindow((win) => {
    win.addEventListener('solomd:cm-relayout', () => fired.push('relayout'));
    slot.after?.(ctxWith(), null);
  });
  assert.deepEqual(fired, ['relayout']);
  assert.equal(slot.deps(ctxWith()), 'light');
  assert.doesNotThrow(() => stateWith(slot.build(ctxWith())));
});

test('appearance: font deps is a 2-tuple and build applies the size', () => {
  const slot = slotOf(createAppearanceFeature(), 'font');
  assert.deepEqual(slot.deps(ctxWith()), [16, 'system']);
  assert.doesNotThrow(() => stateWith(slot.build(ctxWith())));
});

test('live-render: markdown liveEdit and livePreview variants build', () => {
  const slot = slotOf(createLiveRenderFeature(), 'rich');
  for (const overrides of [{ viewMode: 'liveEdit' }, { viewMode: 'liveEdit', alwaysShowMarkers: true }, { viewMode: 'edit', livePreview: true }, { viewMode: 'edit', livePreview: false }]) {
    const ext = slot.build(ctxWith(overrides));
    assert.notDeepEqual(ext, [], JSON.stringify(overrides));
    assert.doesNotThrow(() => stateWith(ext), JSON.stringify(overrides));
  }
});

test('live-render: non-markdown language builds nothing', () => {
  assert.deepEqual(slotOf(createLiveRenderFeature(), 'rich').build(ctxWith({}, 'typescript')), []);
});

test('live-render: rich deps track language, markers, livePreview, viewMode', () => {
  assert.deepEqual(slotOf(createLiveRenderFeature(), 'rich').deps(ctxWith()), ['markdown', false, true, 'liveEdit']);
});

test('live-render: plantuml watch deps and relayout run', () => {
  const [watch] = createLiveRenderFeature().watches ?? [];
  assert.deepEqual(watch.deps(ctxWith()), [false, '']);
  let fired = 0;
  withWindow((win) => {
    win.addEventListener('solomd:cm-relayout', () => { fired += 1; });
    watch.run(ctxWith(), null);
  });
  assert.equal(fired, 1);
});

test('live-render: onBoardEdit stays bound to the tab it was built for', () => {
  const tabA = { id: 'a', content: '', language: 'markdown' };
  const tabB = { id: 'b', content: '', language: 'markdown' };
  let current = tabA;
  const written: string[] = [];
  const ctx = fakeContext({
    settings: SETTINGS,
    tab: () => current as never,
    findTab: (id) => [tabA, tabB].find((t) => t.id === id) as never,
    setContent: (id) => { written.push(id); },
  });
  const opts = liveBlocksOptions(ctx);
  current = tabB;
  opts.onBoardEdit?.('board', '{}');
  assert.equal(opts.getTabId?.(), 'a');
  assert.ok(written.length <= 1 && written.every((id) => id === 'a'));
});

test('live-render: setup does not throw and manifest lists the copy label key', () => {
  const feature = createLiveRenderFeature();
  assert.doesNotThrow(() => feature.setup?.(ctxWith()));
  assert.ok(feature.i18nKeys.includes('toolbar.copy'));
});

test('golden: core + appearance + live-render slot names follow EXTENSION_SLOTS order', () => {
  const features = [createCoreFeature(), createAppearanceFeature(), createLiveRenderFeature()];
  const used = features.flatMap((f) => [...Object.keys(f.extensions ?? {}), ...(f.slots ?? []).map((s) => s.slot)]);
  const order = (name: string): number => EXTENSION_SLOTS.indexOf(name as never);
  assert.equal(new Set(used).size, used.length, 'no slot claimed twice');
  assert.ok(used.every((s) => order(s) >= 0));
  const sorted = [...used].sort((a, b) => order(a) - order(b));
  assert.deepEqual(sorted, [
    'ime-guard', 'history', 'direction', 'drag-aware', 'cursor', 'active-line', 'selection-tools',
    'keymap', 'line-numbers', 'wrap', 'language', 'rich', 'theme', 'font', 'task-list', 'stable-click',
  ]);
});
