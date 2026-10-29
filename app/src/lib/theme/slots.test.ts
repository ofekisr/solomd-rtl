import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canApplyMigration, findVariant, legacyAfterCss, legacyForMigration, normalizeSlotRef, pickSlot, slotsForPick } from './slots.ts';
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

test('a failed css conversion drops the css path so slots fall back to the legacy theme', () => {
  const legacy = { theme: 'nord', customCssPath: '/a/b.css' };
  assert.equal(legacyAfterCss(legacy, true)?.customCssPath, '/a/b.css');
  assert.deepEqual(legacyAfterCss(legacy, false), { theme: 'nord', customCssPath: '' });
  assert.equal(legacyAfterCss(null, false), null);
});

test('migration is applied only when every write succeeded', () => {
  assert.equal(canApplyMigration([]), true);
  assert.equal(canApplyMigration(['My Theme']), false);
});

const twoDark = (): Theme => {
  const base = load('nord');
  const dark = Object.values(base.variants)[0];
  return { ...base, variants: { first: dark, second: { ...dark, label: 'Second' } } };
};

test('picking a variant fills its mode with that variant, not the last of the same mode', () => {
  const picks = slotsForPick(twoDark(), 'first');
  assert.deepEqual(picks.dark, { themeId: 'nord', variant: 'first' });
  assert.equal(picks.light, undefined);
});

test('the other mode gets the first variant of that mode', () => {
  const picks = slotsForPick(load('solomd'), 'dark');
  assert.deepEqual(picks.dark, { themeId: 'solomd', variant: 'dark' });
  assert.deepEqual(picks.light, { themeId: 'solomd', variant: 'light' });
});

test('an unknown variant key falls back to the first variant', () => {
  assert.deepEqual(slotsForPick(twoDark(), 'nope').dark, { themeId: 'nord', variant: 'first' });
});

test('slot refs from storage are normalised per mode', () => {
  const good = { themeId: 'nord', variant: 'dark' };
  assert.deepEqual(normalizeSlotRef(good, 'dark'), good);
  for (const bad of [null, undefined, 'nord', 5, [], {}, { themeId: 1, variant: 'x' }, { themeId: 'a' }, { themeId: '', variant: 'x' }]) {
    assert.deepEqual(normalizeSlotRef(bad, 'light'), { themeId: 'solomd', variant: 'light' });
  }
  assert.deepEqual(normalizeSlotRef(null, 'dark'), { themeId: 'solomd', variant: 'dark' });
});
