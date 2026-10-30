import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeContext, fakeView, stateWith, type FakeContextInit } from '../../editor/internal/cm-probe.ts';
import { en } from '../../../i18n/en.ts';
import { formulaEditor } from '../../../lib/formula-editor-bus.ts';
import { tableEditor } from '../../../lib/table-editor-bus.ts';
import { createFormatFeature } from './format.feature.ts';

const CASE_EVENT = 'solomd:transform-case';
const FORMAT_EVENT = 'solomd:format-markdown';

function resolveKey(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);
}

function withWindow(run: (target: EventTarget) => void): void {
  const g = globalThis as Record<string, unknown>;
  const hadWindow = 'window' in g;
  const prev = g.window;
  const target = new EventTarget();
  g.window = target;
  try {
    run(target);
  } finally {
    if (hadWindow) g.window = prev;
    else delete g.window;
  }
}

function mount(doc: string, selection: { anchor: number; head?: number }, init: FakeContextInit = {}) {
  const view = fakeView(stateWith([], doc, selection));
  const ctx = fakeContext({ view: () => view as never, ...init });
  const cleanup = createFormatFeature().setup!(ctx) as () => void;
  return { view, ctx, cleanup };
}

function fire(target: EventTarget, name: string, detail: unknown): void {
  target.dispatchEvent(new CustomEvent(name, { detail }));
}

test('manifest', () => {
  const f = createFormatFeature();
  assert.equal(f.id, 'format');
  assert.deepEqual(f.settingsKeys, []);
  for (const k of f.i18nKeys) assert.equal(typeof resolveKey(k), 'string', k);
});

test('transform-case defaults to cycle and honors explicit mode', () => {
  withWindow((target) => {
    const { view } = mount('hello world', { anchor: 8 });
    fire(target, CASE_EVENT, undefined);
    assert.equal(view.state.doc.toString(), 'hello WORLD');
    fire(target, CASE_EVENT, { mode: 'lower' });
    assert.equal(view.state.doc.toString(), 'hello world');
  });
});

test('transform-case guards: inactive tab, no view', () => {
  withWindow((target) => {
    const inactive = mount('hello', { anchor: 0, head: 5 }, { activeTabId: () => 'other' });
    fire(target, CASE_EVENT, { mode: 'upper' });
    assert.equal(inactive.view.dispatched.length, 0);
    inactive.cleanup();
    const noView = mount('hello', { anchor: 0, head: 5 }, { view: () => null });
    assert.doesNotThrow(() => fire(target, CASE_EVENT, { mode: 'upper' }));
    noView.cleanup();
  });
});

test('format-markdown happy path and cleanup', () => {
  withWindow((target) => {
    const { view, cleanup } = mount('x', { anchor: 0, head: 1 });
    fire(target, FORMAT_EVENT, { kind: 'bold' });
    assert.equal(view.state.doc.toString(), '**x**');
    cleanup();
    fire(target, FORMAT_EVENT, { kind: 'italic' });
    fire(target, CASE_EVENT, { mode: 'upper' });
    assert.equal(view.state.doc.toString(), '**x**');
  });
});

test('format-markdown guards: unknown kind, inactive tab, non-markdown, no view', () => {
  withWindow((target) => {
    const cases: Array<[string, FakeContextInit, unknown]> = [
      ['unknown kind', {}, { kind: 'nope' }],
      ['missing detail', {}, undefined],
      ['inactive tab', { activeTabId: () => 'other' }, { kind: 'bold' }],
      ['non-markdown', { tabValue: { language: 'typescript' } }, { kind: 'bold' }],
    ];
    for (const [label, init, detail] of cases) {
      const { view, cleanup } = mount('x', { anchor: 0, head: 1 }, init);
      fire(target, FORMAT_EVENT, detail);
      assert.equal(view.dispatched.length, 0, label);
      cleanup();
    }
    const noView = mount('x', { anchor: 0, head: 1 }, { view: () => null });
    assert.doesNotThrow(() => fire(target, FORMAT_EVENT, { kind: 'bold' }));
    noView.cleanup();
  });
});

test('openTableAtCursor with no view toasts', () => {
  const ctx = fakeContext();
  createFormatFeature().commands!.openTableAtCursor(ctx);
  assert.deepEqual(ctx.toasts, ['info:tableEditor.notInTable']);
});

test('openTableAtCursor with a view opens a session that applies to the live view', () => {
  const doc = 'intro\n\n| a | b |\n| - | - |\n| 1 | 2 |\n';
  const view = fakeView(stateWith([], doc, { anchor: 14 }));
  const ctx = fakeContext({ view: () => view as never });
  createFormatFeature().commands!.openTableAtCursor(ctx);
  const session = tableEditor.session!;
  assert.equal(session.source, '| a | b |\n| - | - |\n| 1 | 2 |');
  session.apply('| z |');
  assert.equal(view.state.doc.toString(), 'intro\n\n| z |\n');
  tableEditor.session = null;
});

test('openFormulaAtCursor edits math under caret via the live view', () => {
  const doc = 'see $a+b$ here';
  let current: ReturnType<typeof fakeView> | null = fakeView(stateWith([], doc, { anchor: 6 }));
  const ctx = fakeContext({ view: () => current as never });
  createFormatFeature().commands!.openFormulaAtCursor(ctx);
  const session = formulaEditor.session!;
  assert.equal(session.latex, 'a+b');
  assert.equal(session.display, false);
  const view = current!;
  session.apply('c', false);
  assert.equal(view.state.doc.toString(), 'see $c$ here');
  current = null;
  assert.doesNotThrow(() => session.apply('d', false));
  formulaEditor.session = null;
});

test('openFormulaAtCursor with no view opens an empty inline formula', () => {
  createFormatFeature().commands!.openFormulaAtCursor(fakeContext());
  const session = formulaEditor.session!;
  assert.equal(session.latex, '');
  assert.equal(session.display, false);
  formulaEditor.session = null;
});
