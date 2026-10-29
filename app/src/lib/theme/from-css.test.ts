import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { convertMarketplaceCss } from './from-css.ts';
import { parseBackdrop, parseRules } from './css-vars.ts';

const aurora = readFileSync(new URL('./__fixtures__/aurora.css', import.meta.url), 'utf8');
const AURORA_META = { id: 'mk-aurora', name: 'Aurora' };
const MARKET_DIR = new URL('../../../../web/public/themes/', import.meta.url);

test('parses top-level rules and strips comments', () => {
  const rules = parseRules('/* x */ :root { --bg: #000; } .a, .b { color: red; }');
  assert.deepEqual(rules[0], { selectors: [':root'], decls: { '--bg': '#000' } });
  assert.deepEqual(rules[1].selectors, ['.a', '.b']);
});

test('parses radial and linear gradients into layers', () => {
  const layers = parseBackdrop('radial-gradient(circle at 15% 20%, rgba(103, 232, 185, 0.22), transparent 52%), linear-gradient(165deg, #070b18 0%, #0d1424 60%, #130f22 100%)');
  assert.deepEqual(layers, [
    { kind: 'radial', x: 15, y: 20, color: 'rgba(103, 232, 185, 0.22)', fade: 52 },
    { kind: 'linear', angle: 165, stops: [{ color: '#070b18', at: 0 }, { color: '#0d1424', at: 60 }, { color: '#130f22', at: 100 }] },
  ]);
});

test('Aurora becomes one valid dark variant with its palette', () => {
  const { theme } = convertMarketplaceCss(aurora, AURORA_META);
  assert.deepEqual(Object.keys(theme.variants), ['dark']);
  const v = theme.variants.dark;
  assert.equal(v.app.colors.bg, '#0d1424');
  assert.equal(v.app.colors.accent, '#67e8b9');
  assert.equal(v.code?.colors?.keyword, '#c084fc');
  assert.equal(theme.source, 'mine');
  assert.equal(theme.origin, 'marketplace');
});

test('Aurora keeps its 6-layer backdrop and see-through panels', () => {
  const v = convertMarketplaceCss(aurora, AURORA_META).theme.variants.dark;
  assert.equal(v.surfaces?.style?.backdrop?.length, 6);
  assert.equal(v.surfaces?.style?.panelOpacity, 0);
});

test('reports dropped rules and unknown variables', () => {
  const { dropped } = convertMarketplaceCss(aurora, AURORA_META);
  assert.ok(dropped.includes('.cm-editor .cm-gutters'));
  assert.ok(dropped.includes('--md-code-border'));
  assert.ok(!dropped.includes('body'));
});

test('separate light and dark blocks become two variants', () => {
  const css = ':root[data-theme="light"] { --bg: #ffffff; --text: #111111; --accent: #0066ff; }\n' +
    ':root[data-theme="dark"] { --bg: #111111; --text: #eeeeee; --accent: #66aaff; }';
  const { theme } = convertMarketplaceCss(css, { id: 'mk-x', name: 'X' });
  assert.deepEqual(Object.keys(theme.variants).sort(), ['dark', 'light']);
});

test('variant mode follows background luminance, not the selector', () => {
  const css = ':root[data-theme="dark"] { --bg: #fafafa; --text: #222222; --accent: #0066ff; }';
  const { theme } = convertMarketplaceCss(css, { id: 'mk-y', name: 'Y' });
  assert.deepEqual(Object.keys(theme.variants), ['light']);
});

test('an invalid optional colour is dropped and reported, not thrown', () => {
  const css = ':root { --bg: #000000; --text: #ffffff; --accent: #0066ff; --text-muted: url(x); }';
  const { theme, dropped } = convertMarketplaceCss(css, { id: 'mk-z', name: 'Z' });
  assert.ok(dropped.includes('--text-muted'));
  assert.equal(theme.variants.dark.app.colors.textMuted, undefined);
});

test('throws when required colours are missing', () => {
  assert.throws(() => convertMarketplaceCss(':root { --bg: #000000; }', { id: 'mk-w', name: 'W' }));
});

test('every marketplace theme converts to a valid theme', () => {
  for (const file of readdirSync(MARKET_DIR).filter((f) => f.endsWith('.css'))) {
    const css = readFileSync(new URL(file, MARKET_DIR), 'utf8');
    assert.doesNotThrow(() => convertMarketplaceCss(css, { id: `mk-${file.replace('.css', '')}`, name: file }), file);
  }
});
