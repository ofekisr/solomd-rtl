import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLight } from './color.ts';
import { resolveVariant } from './resolve.ts';
import { SOLOMD_CODE } from './defaults.ts';
import type { Variant } from './schema.ts';

const dark: Variant = { mode: 'dark', app: { colors: { bg: '#000000', text: '#ffffff', accent: '#ff9f40' } } };

test('editor background falls back to app bg', () => {
  assert.equal(resolveVariant(dark).colors.editor.background, '#000000');
});

test('gutter background follows the editor background', () => {
  const v: Variant = { ...dark, editor: { colors: { background: '#111111' } } };
  assert.equal(resolveVariant(v).colors.editor.gutterBg, '#111111');
});

test('diagram line falls back to the surface border', () => {
  const v: Variant = { ...dark, surfaces: { colors: { border: '#333333' } } };
  assert.equal(resolveVariant(v).colors.diagrams.line, '#333333');
});

test('code constant falls back to code number', () => {
  const v: Variant = { ...dark, code: { colors: { number: '#123456' } } };
  assert.equal(resolveVariant(v).colors.code.constant, '#123456');
});

test('missing code colours come from the SoloMD palette of the same mode', () => {
  assert.equal(resolveVariant(dark).colors.code.keyword, SOLOMD_CODE.dark.keyword);
});

test('surfaces mix bg toward text', () => {
  const r = resolveVariant(dark);
  assert.equal(r.colors.surfaces.hover, '#0f0f0f');
});

test('non-hex inputs mix with color-mix()', () => {
  const v: Variant = { mode: 'dark', app: { colors: { bg: 'rgb(0, 0, 0)', text: '#ffffff', accent: '#ff9f40' } } };
  assert.match(resolveVariant(v).colors.surfaces.hover, /^color-mix\(in srgb, rgb\(0, 0, 0\) 94%, #ffffff\)$/);
});

test('style defaults apply and explicit values win', () => {
  const v: Variant = { ...dark, app: { ...dark.app, style: { radius: 0 } } };
  const r = resolveVariant(v);
  assert.equal(r.style.radius, 0);
  assert.deepEqual(r.style.comment, { italic: true });
  assert.equal(r.style.activeLine, true);
});

test('links are underlined and quotes italic by default', () => {
  const r = resolveVariant(dark);
  assert.deepEqual(r.style.link, { underline: true });
  assert.deepEqual(r.style.quote, { italic: true });
});

test('isLight reads hex and rgb colours', () => {
  assert.equal(isLight('#fafafa'), true);
  assert.equal(isLight('#141414'), false);
  assert.equal(isLight('rgb(250, 250, 250)'), true);
  assert.equal(isLight('rgb(20, 20, 20)'), false);
});

test('isLight is false for notations it cannot read', () => {
  assert.equal(isLight('hsl(0 0% 98%)'), false);
  assert.equal(isLight('color-mix(in srgb, #fff 90%, #000)'), false);
});
