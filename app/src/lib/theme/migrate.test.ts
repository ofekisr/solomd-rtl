import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planMigration, marketplaceIdFor } from './migrate.ts';
import type { UserTheme } from '../user-theme.ts';

const ut: UserTheme = {
  id: 'ut-1', name: 'Mine', light: { '--bg': '#ffffff', '--text': '#111111', '--accent': '#0066ff' },
  dark: { '--bg': '#101010', '--text': '#eeeeee', '--accent': '#66aaff' }, edited: { light: [], dark: [] },
  radius: 1, gradient: { light: null, dark: null },
};

test('fresh install follows the system with SoloMD in both slots', () => {
  const p = planMigration(null);
  assert.equal(p.appearance, 'system');
  assert.deepEqual(p.lightSlot, { themeId: 'solomd', variant: 'light' });
  assert.deepEqual(p.darkSlot, { themeId: 'solomd', variant: 'dark' });
});

test('a dark-only built-in fills the dark slot and keeps SoloMD light', () => {
  const p = planMigration({ theme: 'nord' });
  assert.equal(p.appearance, 'dark');
  assert.deepEqual(p.darkSlot, { themeId: 'nord', variant: 'dark' });
  assert.deepEqual(p.lightSlot, { themeId: 'solomd', variant: 'light' });
});

test('light and dark map to SoloMD with that appearance', () => {
  assert.equal(planMigration({ theme: 'light' }).appearance, 'light');
  assert.deepEqual(planMigration({ theme: 'dark' }).darkSlot, { themeId: 'solomd', variant: 'dark' });
});

test('solarized light fills the light slot', () => {
  assert.deepEqual(planMigration({ theme: 'solarized-light' }).lightSlot, { themeId: 'solarized', variant: 'light' });
});

test('a two-variant built-in fills both slots with its own variants', () => {
  const p = planMigration({ theme: 'solarized-light' });
  assert.deepEqual(p.darkSlot, { themeId: 'solarized', variant: 'dark' });
});

test('every Theme Studio theme is written; the active one fills both slots', () => {
  const p = planMigration({ theme: 'dark', userThemes: [ut], activeUserThemeId: 'ut-1' });
  assert.equal(p.themesToWrite.length, 1);
  assert.deepEqual(p.lightSlot, { themeId: 'ut-1', variant: 'light' });
  assert.deepEqual(p.darkSlot, { themeId: 'ut-1', variant: 'dark' });
});

test('a custom CSS path is queued for conversion and fills both slots by its id', () => {
  const p = planMigration({ theme: 'dark', customCssPath: '/x/themes/aurora.css' });
  assert.equal(p.cssToConvert, '/x/themes/aurora.css');
  assert.equal(p.darkSlot.themeId, 'mk-aurora');
});

test('Theme Studio wins over custom CSS, as it does today', () => {
  const p = planMigration({ theme: 'dark', userThemes: [ut], activeUserThemeId: 'ut-1', customCssPath: '/a.css' });
  assert.equal(p.cssToConvert, null);
  assert.equal(p.darkSlot.themeId, 'ut-1');
});

test('unknown legacy names fall back to defaults', () => {
  assert.deepEqual(planMigration({ theme: 'bogus' }).darkSlot, { themeId: 'solomd', variant: 'dark' });
});

test('marketplace ids are slugged from the file name', () => {
  assert.equal(marketplaceIdFor('C:\\t\\Pure Black OLED.css'), 'mk-pure-black-oled');
});
