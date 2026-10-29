import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backdropCss, themeCss, themeVars } from './css.ts';
import { resolveVariant } from './resolve.ts';
import type { Variant } from './schema.ts';

const dark: Variant = { mode: 'dark', app: { colors: { bg: '#000000', text: '#ffffff', accent: '#ff9f40' } } };

test('maps colours to the existing variable names', () => {
  const vars = themeVars(resolveVariant(dark));
  assert.equal(vars['--bg'], '#000000');
  assert.equal(vars['--cm-bg'], '#000000');
  assert.equal(vars['--syn-constant'], vars['--syn-number']);
});

test('writes text styles as font variables', () => {
  const vars = themeVars(resolveVariant(dark));
  assert.equal(vars['--syn-comment-style'], 'italic');
  assert.equal(vars['--syn-keyword-weight'], 'normal');
  assert.equal(vars['--md-heading-weight'], 'bold');
});

test('radius scales the three radius variables', () => {
  const vars = themeVars(resolveVariant({ ...dark, app: { ...dark.app, style: { radius: 2 } } }));
  assert.equal(vars['--r-md'], '16px');
});

test('hidden active line is transparent', () => {
  const vars = themeVars(resolveVariant({ ...dark, editor: { style: { activeLine: false } } }));
  assert.equal(vars['--cm-active-line'], 'transparent');
});

test('backdrop layers become a CSS background list', () => {
  const css = backdropCss([
    { kind: 'radial', x: 15, y: 20, color: '#67e8b9', fade: 52 },
    { kind: 'linear', angle: 165, stops: [{ color: '#070b18', at: 0 }, { color: '#130f22', at: 100 }] },
  ]);
  assert.equal(css, 'radial-gradient(circle at 15% 20%, #67e8b9, transparent 52%), linear-gradient(165deg, #070b18 0%, #130f22 100%)');
});

test('panels show the backdrop through only when there is one', () => {
  assert.doesNotMatch(themeCss(resolveVariant(dark)), /backdrop-filter/);
  const withBackdrop: Variant = {
    ...dark,
    surfaces: { style: { backdrop: [{ kind: 'radial', x: 1, y: 1, color: '#ffffff', fade: 10 }], panelOpacity: 0, panelBlur: 6 } },
  };
  const css = themeCss(resolveVariant(withBackdrop));
  assert.match(css, /html:root\[data-theme\] body \{\n  background-image: var\(--bg-grad\);/);
  assert.match(css, /backdrop-filter: blur\(var\(--panel-blur\)\)/);
  assert.equal(themeVars(resolveVariant(withBackdrop))['--panel-blur'], '6px');
});

test('declares color-scheme for the mode', () => {
  assert.match(themeCss(resolveVariant(dark)), /color-scheme: dark;/);
});
