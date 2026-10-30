import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileNameFromSavedPath, mergeTabsDedup } from './tabs-helpers.ts';

const tab = (id: string, filePath?: string) => ({ id, filePath }) as never;

test('fileNameFromSavedPath', () => {
  assert.equal(fileNameFromSavedPath('/a/b/note.md', 'x'), 'note.md');
  assert.equal(fileNameFromSavedPath('C:\\a\\note.md', 'x'), 'note.md');
  assert.equal(fileNameFromSavedPath('content://p/doc/primary%3ADocs%2Fnote.md', 'x'), 'note.md');
  assert.equal(fileNameFromSavedPath('content://p/%E0%A4%A', 'x'), '%E0%A4%A');
});

test('mergeTabsDedup keeps carried first, drops duplicate ids and paths', () => {
  const merged = mergeTabsDedup(
    [tab('1', '/a'), tab('u')],
    [tab('u'), tab('2', '/a'), tab('3', '/b')],
  ) as unknown as { id: string }[];
  assert.deepEqual(merged.map((t) => t.id), ['1', 'u', '3']);
});

test('persist helpers', async () => {
  const store = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    window: {},
  });
  const p = await import('./tabs-persist.ts');
  assert.equal(p.inFolder('/a/b/c.md', '/a/b/'), true);
  assert.equal(p.inFolder('/a/bc/c.md', '/a/b'), false);
  assert.equal(p.inFolder('C:\\Users\\X\\n.md', 'c:/users/x'), true);
  assert.equal(p.inFolder(undefined, '/a'), false);
  assert.equal(p.bucketKey('/w'), 'solomd.tabs.v1::/w');
  assert.equal(p.bucketKey(null), 'solomd.tabs.v1::__none__');
  assert.equal(p.currentWindowLabel(), 'main');
  assert.equal(p.windowScopeSuffix(), '');
  assert.deepEqual(p.loadPersisted(() => false), { tabs: [], activeId: '' });
});
