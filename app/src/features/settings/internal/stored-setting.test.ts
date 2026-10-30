import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readStoredSetting } from './stored-setting.ts';
import { SETTINGS_STORAGE_KEY } from '../contracts/settings-slice.port.ts';

const store = new Map<string, string>();
let isThrowing = false;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string): string | null {
      if (isThrowing) throw new Error('blocked');
      return store.get(key) ?? null;
    },
  },
});

afterEach(() => {
  store.clear();
  isThrowing = false;
});

test('missing blob returns undefined', () => {
  assert.equal(readStoredSetting('restoreSession'), undefined);
});

test('bad JSON returns undefined', () => {
  store.set(SETTINGS_STORAGE_KEY, '{not json');
  assert.equal(readStoredSetting('restoreSession'), undefined);
});

test('non-object blob returns undefined', () => {
  store.set(SETTINGS_STORAGE_KEY, '42');
  assert.equal(readStoredSetting('restoreSession'), undefined);
  store.set(SETTINGS_STORAGE_KEY, 'null');
  assert.equal(readStoredSetting('restoreSession'), undefined);
});

test('absent key returns undefined', () => {
  store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ perWorkspaceTabs: false }));
  assert.equal(readStoredSetting('restoreSession'), undefined);
});

test('returns the raw stored value, even of the wrong type', () => {
  store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ restoreSession: false, perWorkspaceTabs: 'yes' }));
  assert.equal(readStoredSetting('restoreSession'), false);
  assert.equal(readStoredSetting('perWorkspaceTabs'), 'yes');
});

test('storage that throws returns undefined', () => {
  isThrowing = true;
  assert.equal(readStoredSetting('restoreSession'), undefined);
});
