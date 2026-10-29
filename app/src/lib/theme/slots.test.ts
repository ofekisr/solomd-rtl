import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { findVariant, legacyForMigration, pickSlot } from './slots.ts';
import type { Theme } from './schema.ts';

const load = (id: string): Theme => JSON.parse(readFileSync(new URL(`./builtin/${id}.json`, import.meta.url), 'utf8'));
const themes = [load('solomd'), load('nord')];

test('appearance picks the slot; system follows the OS', () => {
  assert.equal(pickSlot('light', true), 'light');
  assert.equal(pickSlot('system', true), 'dark');
  assert.equal(pickSlot('system', false), 'light');
});

test('finds the variant a slot names', () => {
  assert.equal(findVariant(themes, { themeId: 'nord', variant: 'dark' }, 'dark').theme.id, 'nord');
});

test('a missing theme falls back to SoloMD of the same mode', () => {
  const r = findVariant(themes, { themeId: 'gone', variant: 'dark' }, 'dark');
  assert.equal(r.theme.id, 'solomd');
  assert.equal(r.variantKey, 'dark');
});

test('a missing variant falls back to SoloMD when the theme has none of that mode', () => {
  const r = findVariant(themes, { themeId: 'nord', variant: 'light' }, 'light');
  assert.equal(r.theme.id, 'solomd');
});

test('a fresh install migrates from nothing, so appearance stays system', () => {
  assert.equal(legacyForMigration(false, { theme: 'light' }), null);
});

test('an existing install migrates from its stored legacy settings', () => {
  const legacy = { theme: 'nord', customCssPath: '', activeUserThemeId: '', userThemes: [] };
  assert.deepEqual(legacyForMigration(true, legacy), legacy);
});
