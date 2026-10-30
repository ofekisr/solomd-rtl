import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { EditorView } from '@codemirror/view';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => { map.delete(k); },
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), configurable: true });

const { stateWith, fakeView, fakeContext } = await import('../editor/contracts/testkit.ts');
const { writeSession, readSession } = await import('../../lib/cm/session-restore.ts');
const { createSessionFeature } = await import('./contracts/index.ts');
const { maybeRestoreSession } = await import('./internal/restore-session.ts');

before(() => { assert.ok(globalThis.localStorage); });
beforeEach(() => { localStorage.clear(); });

test('restores into an empty tab and empty doc', () => {
  writeSession('t1', 'saved text');
  const fv = fakeView(stateWith([], ''));
  maybeRestoreSession(fakeContext({ tabValue: { id: 't1', content: '' } }), fv);
  assert.equal(fv.state.doc.toString(), 'saved text');
});

test('leaves a tab with content untouched', () => {
  writeSession('t1', 'saved text');
  const fv = fakeView(stateWith([], ''));
  maybeRestoreSession(fakeContext({ tabValue: { id: 't1', content: 'real' } }), fv);
  assert.equal(fv.dispatched.length, 0);
});

test('leaves a non-empty doc untouched', () => {
  writeSession('t1', 'saved text');
  const fv = fakeView(stateWith([], 'already'));
  maybeRestoreSession(fakeContext({ tabValue: { id: 't1', content: '' } }), fv);
  assert.equal(fv.state.doc.toString(), 'already');
});

test('no saved session does nothing', () => {
  const fv = fakeView(stateWith([], ''));
  maybeRestoreSession(fakeContext({ tabValue: { id: 'none', content: '' } }), fv);
  assert.equal(fv.dispatched.length, 0);
});

test('mount and tab-switch hooks both restore', () => {
  writeSession('t1', 'abc');
  const feature = createSessionFeature();
  const ctx = fakeContext({ tabValue: { id: 't1', content: '' } });
  const a = fakeView(stateWith([], ''));
  feature.onMount!(ctx, a as unknown as EditorView);
  const b = fakeView(stateWith([], ''));
  feature.onTabSwitch!(ctx, b as unknown as EditorView, { newId: 't1' });
  assert.equal(a.state.doc.toString(), 'abc');
  assert.equal(b.state.doc.toString(), 'abc');
});

test('watch clears the session when content equals savedContent', () => {
  writeSession('t1', 'abc');
  const watch = createSessionFeature().watches![0];
  const dirty = fakeContext({ tabValue: { id: 't1', content: 'x', savedContent: 'y' } });
  assert.deepEqual(watch.deps(dirty), ['x', 'y']);
  watch.run(dirty, null);
  assert.equal(readSession('t1'), 'abc');
  const clean = fakeContext({ tabValue: { id: 't1', content: 'x', savedContent: 'x' } });
  watch.run(clean, null);
  assert.equal(readSession('t1'), null);
});

test('manifest and session slot', () => {
  const feature = createSessionFeature();
  assert.equal(feature.id, 'session');
  assert.deepEqual(feature.settingsKeys, []);
  assert.ok(feature.extensions?.session);
});

test('session extension is a valid CM extension bound to the tab', () => {
  const ext = createSessionFeature().extensions!.session!(fakeContext({ tabValue: { id: 'ext1' } }));
  assert.ok(ext);
  const state = stateWith(ext, 'doc');
  assert.equal(state.doc.toString(), 'doc');
});
