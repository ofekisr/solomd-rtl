import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_PAGE_KEYS } from '../lib/settings-nav.ts';
import { en } from '../i18n/en.ts';
import { defaults } from '../stores/settings.ts';
import { createEditorRegistry } from './editor-registry.service.ts';
import { SETTINGS_SLICES, settingsSliceKeys } from './settings-registry.service.ts';
import { SETTINGS_PAGES } from './settings-pages.ts';

const GROUP_SUFFIX = '.*';

function resolveI18n(key: string): unknown {
  const path = key.endsWith(GROUP_SUFFIX) ? key.slice(0, -GROUP_SUFFIX.length) : key;
  return path.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);
}

test('every settings key sits in exactly one slice', () => {
  const keys = settingsSliceKeys();
  const duplicated = keys.filter((key, index) => keys.indexOf(key) !== index);
  assert.deepEqual(duplicated, []);
  assert.deepEqual([...keys].sort(), Object.keys(defaults()).sort());
});

test('slice ids are unique', () => {
  const ids = SETTINGS_SLICES.map((slice) => slice.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('SETTINGS_PAGES lists the page keys in ALL_PAGE_KEYS order', () => {
  assert.deepEqual(SETTINGS_PAGES.map((page) => page.key), [...ALL_PAGE_KEYS]);
});

test('every registered editor feature declares only registered settings keys', () => {
  const known = new Set(settingsSliceKeys());
  for (const feature of createEditorRegistry().features) {
    for (const key of feature.settingsKeys) assert.ok(known.has(key), `${feature.id}: setting ${key}`);
  }
});

test('every registered editor feature declares only i18n keys present in en', () => {
  for (const feature of createEditorRegistry().features) {
    for (const key of feature.i18nKeys) {
      const value = resolveI18n(key);
      const expected = key.endsWith(GROUP_SUFFIX) ? 'object' : 'string';
      assert.equal(typeof value, expected, `${feature.id}: i18n ${key}`);
    }
  }
});
