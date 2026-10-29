import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromUserTheme, inheritCssBackdrop, paletteOf, studioToTheme, withInheritedBackdrops } from './from-studio.ts';
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

test('an inherit backdrop takes the custom CSS theme surfaces style', () => {
  const css = fromUserTheme({ ...ut, id: 'mk-aurora', gradient: { light: null, dark: { from: '#000000', to: '#123456', angle: 90 } } });
  const inheriting: UserTheme = { ...ut, gradient: { light: 'inherit', dark: 'inherit' } };
  const theme = inheritCssBackdrop(fromUserTheme(inheriting), inheriting, css);
  assert.deepEqual(theme.variants.dark.surfaces?.style, css.variants.dark.surfaces?.style);
  assert.equal(theme.variants.dark.app.colors.bg, '#101010');
  assert.equal(parseTheme(theme).ok, true);
});

test('an own gradient is kept when a CSS theme is present', () => {
  const css = fromUserTheme({ ...ut, id: 'mk-aurora', gradient: { light: null, dark: { from: '#000000', to: '#123456', angle: 90 } } });
  const theme = inheritCssBackdrop(fromUserTheme(ut), ut, css);
  assert.deepEqual(theme.variants.dark.surfaces?.style, fromUserTheme(ut).variants.dark.surfaces?.style);
});

test('withInheritedBackdrops only touches Studio themes and needs a CSS theme', () => {
  const inheriting: UserTheme = { ...ut, gradient: { light: 'inherit', dark: 'inherit' } };
  const css = fromUserTheme({ ...ut, id: 'mk-aurora', gradient: { light: null, dark: { from: '#000000', to: '#123456', angle: 90 } } });
  const studio = fromUserTheme(inheriting);
  assert.deepEqual(withInheritedBackdrops([studio], [inheriting], null), [studio]);
  const [out] = withInheritedBackdrops([studio], [inheriting], css);
  assert.deepEqual(out.variants.dark.surfaces?.style, css.variants.dark.surfaces?.style);
});

test('studioToTheme keeps the saved layered backdrop for inherit modes', () => {
  const inheriting: UserTheme = { ...ut, gradient: { light: null, dark: 'inherit' } };
  const saved = fromUserTheme({ ...ut, gradient: { light: null, dark: { from: '#000000', to: '#123456', angle: 90 } } });
  assert.deepEqual(studioToTheme(inheriting, saved).variants.dark.surfaces?.style, saved.variants.dark.surfaces?.style);
  assert.equal(studioToTheme(inheriting, undefined).variants.dark.surfaces?.style, undefined);
  assert.deepEqual(studioToTheme(ut, saved), fromUserTheme(ut));
});

test('paletteOf returns every Studio token as hex', () => {
  const p = paletteOf(fromUserTheme(ut).variants.dark);
  assert.equal(p['--bg'], '#101010');
  assert.match(p['--bg-hover'], /^#[0-9a-f]{6}$/);
});
