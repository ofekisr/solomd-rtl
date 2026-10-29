import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromUserTheme, paletteOf } from './from-studio.ts';
import { parseTheme } from './schema.ts';
import type { UserTheme } from '../user-theme.ts';

const ut: UserTheme = {
  id: 'ut-abc', name: 'Mine',
  light: { '--bg': '#ffffff', '--text': '#111111', '--accent': '#0066ff', '--syn-keyword': '#aa00aa' },
  dark: { '--bg': '#101010', '--text': '#eeeeee', '--accent': '#66aaff' },
  edited: { light: [], dark: [] }, radius: 2,
  gradient: { light: null, dark: { from: '#101010', to: '#202040', angle: 165 } },
};

test('converts both palettes into a valid two-variant theme', () => {
  const theme = fromUserTheme(ut);
  assert.equal(parseTheme(theme).ok, true);
  assert.equal(theme.variants.light.code?.colors?.keyword, '#aa00aa');
  assert.equal(theme.origin, 'studio');
});

test('radius and gradient become style props', () => {
  const theme = fromUserTheme(ut);
  assert.equal(theme.variants.dark.app.style?.radius, 2);
  assert.deepEqual(theme.variants.dark.surfaces?.style?.backdrop, [
    { kind: 'linear', angle: 165, stops: [{ color: '#101010', at: 0 }, { color: '#202040', at: 100 }] },
  ]);
  assert.equal(theme.variants.light.surfaces?.style?.backdrop, undefined);
});

const SOLOMD_LIGHT_BG = '#ffffff';

test('a palette missing the required basics falls back to the SoloMD base', () => {
  const theme = fromUserTheme({ ...ut, light: {} });
  assert.equal(parseTheme(theme).ok, true);
  assert.equal(theme.variants.light.app.colors.bg, SOLOMD_LIGHT_BG);
});

test('an empty name becomes Untitled theme', () => {
  assert.equal(fromUserTheme({ ...ut, name: '   ' }).name, 'Untitled theme');
});

test('paletteOf returns every Studio token as hex', () => {
  const p = paletteOf(fromUserTheme(ut).variants.dark);
  assert.equal(p['--bg'], '#101010');
  assert.match(p['--bg-hover'], /^#[0-9a-f]{6}$/);
});
