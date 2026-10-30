import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AA_TEXT_CONTRAST, MAP_THEMES, MAP_THEME_IDS, PALETTE_SIZE, contrastRatio, isMapThemeId, mapThemeVariant, type ThemeFamily } from './themes.ts';

const HEX6 = /^#[0-9a-f]{6}$/i;
const FAMILIES: readonly ThemeFamily[] = ['light', 'dark'];
const TEXT_PAIRS: ReadonlyArray<[string, string]> = [['--color', '--bgcolor'], ['--main-color', '--main-bgcolor'], ['--root-color', '--root-bgcolor']];

test('there are five presets in a fixed order', () => {
  assert.deepEqual(MAP_THEME_IDS, ['default', 'ocean', 'forest', 'mono', 'highContrast']);
  assert.deepEqual(MAP_THEMES.map((p) => p.id), MAP_THEME_IDS);
});

test('every variant has an 8-color palette and 7 hex css vars', () => {
  for (const preset of MAP_THEMES) {
    for (const family of FAMILIES) {
      const v = preset[family];
      assert.equal(v.palette.length, PALETTE_SIZE, `${preset.id}/${family}`);
      for (const color of v.palette) assert.match(color, HEX6);
      assert.equal(Object.keys(v.cssVar).length, 7);
      for (const color of Object.values(v.cssVar)) assert.match(color, HEX6);
    }
  }
});

test('mapThemeVariant returns a typed copy', () => {
  const theme = mapThemeVariant('ocean', 'dark');
  assert.equal(theme.type, 'dark');
  assert.equal(theme.name, 'solomd-ocean-dark');
  theme.palette[0] = '#000000';
  assert.notEqual(mapThemeVariant('ocean', 'dark').palette[0], '#000000');
});

test('contrastRatio matches WCAG reference values', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
  assert.equal(contrastRatio('#777777', '#777777'), 1);
});

test('high contrast meets AA for all text in both variants', () => {
  for (const family of FAMILIES) {
    const vars = mapThemeVariant('highContrast', family).cssVar as Record<string, string>;
    for (const [fg, bg] of TEXT_PAIRS) {
      assert.ok(contrastRatio(vars[fg], vars[bg]) >= AA_TEXT_CONTRAST, `${family} ${fg}/${bg}`);
    }
  }
});

test('isMapThemeId rejects unknown and prototype keys', () => {
  assert.equal(isMapThemeId('forest'), true);
  assert.equal(isMapThemeId('neon'), false);
  assert.equal(isMapThemeId('toString'), false);
});
