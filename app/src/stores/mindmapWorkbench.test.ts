import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';

const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(), key: () => null, length: 0,
} as Storage;

const { useMindmapWorkbenchStore } = await import('./mindmapWorkbench.ts');

beforeEach(() => { mem.clear(); setActivePinia(createPinia()); });

test('add persists and survives a fresh store', () => {
  useMindmapWorkbenchStore().add({ kind: 'file', path: '/a.mmap', label: 'a' });
  setActivePinia(createPinia());
  assert.equal(useMindmapWorkbenchStore().entries.length, 1);
});

test('selection is preserved across reload; removeSelected removes only checked', () => {
  const s = useMindmapWorkbenchStore();
  s.add({ kind: 'file', path: '/a.mmap', label: 'a' });
  s.add({ kind: 'file', path: '/b.mmap', label: 'b' });
  s.toggle(s.entries[0].id);
  setActivePinia(createPinia());
  const r = useMindmapWorkbenchStore();
  assert.deepEqual(r.entries.map((e) => e.selected), [false, true]);
  r.removeSelected();
  assert.deepEqual(r.entries.map((e) => e.label), ['a']);
});

test('corrupt storage → empty workbench', () => {
  mem.set('solomd.mindmapWorkbench.v1', '{nope');
  assert.deepEqual(useMindmapWorkbenchStore().entries, []);
});

test('quota error on persist does not throw; in-memory state still updates', () => {
  const original = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  const originalError = console.error;
  console.error = () => {};
  try {
    const s = useMindmapWorkbenchStore();
    s.add({ kind: 'file', path: '/a.mmap', label: 'a' });
    assert.equal(s.entries.length, 1);
  } finally {
    globalThis.localStorage.setItem = original;
    console.error = originalError;
  }
});
