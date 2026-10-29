import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTheme } from './schema.ts';

type Loose = Record<string, unknown>;

const minimal = {
  id: 'mini', name: 'Mini', version: 1, source: 'mine',
  variants: { dark: { mode: 'dark', app: { colors: { bg: '#000000', text: '#ffffff', accent: '#ff9f40' } } } },
};

const fresh = (): Loose => structuredClone(minimal) as Loose;
const child = (node: Loose, key: string): Loose => node[key] as Loose;
const darkOf = (theme: Loose): Loose => child(child(theme, 'variants'), 'dark');
const appOf = (theme: Loose): Loose => child(darkOf(theme), 'app');
const appColorsOf = (theme: Loose): Loose => child(appOf(theme), 'colors');

test('accepts a theme with only the required app colours', () => {
  assert.equal(parseTheme(minimal).ok, true);
});

test('accepts rgb, hsl and color-mix colours', () => {
  const t = fresh();
  appColorsOf(t).bg = 'rgb(1, 2, 3)';
  appColorsOf(t).text = 'hsl(10 20% 30%)';
  appColorsOf(t).accent = 'color-mix(in srgb, #fff 20%, transparent)';
  assert.equal(parseTheme(t).ok, true);
});

test('rejects a CSS injection in a colour and names the field', () => {
  const t = fresh();
  appColorsOf(t).bg = 'red; } body { display: none';
  const r = parseTheme(t);
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.error, /variants\.dark\.app\.colors\.bg/);
});

test('rejects radius out of range', () => {
  const t = fresh();
  appOf(t).style = { radius: 3 };
  assert.equal(parseTheme(t).ok, false);
});

test('rejects unknown keys', () => {
  const t = fresh();
  appOf(t).extraCss = 'body{}';
  const r = parseTheme(t);
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.error, /extraCss/);
});

test('rejects a missing required colour', () => {
  const t = fresh();
  delete appColorsOf(t).accent;
  assert.equal(parseTheme(t).ok, false);
});

test('rejects a theme with no variants', () => {
  assert.equal(parseTheme({ ...minimal, variants: {} }).ok, false);
});
