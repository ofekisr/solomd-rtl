import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { PADDING_MAX, RADIUS_MAX, buildNodePatch, fontKeyOf, isSafeLink, parseBorder, parsePadding, setIcon, shapeKeyOf, toggleIcon } from './mindmap-node-style.ts';

const node: NodeObj = { id: 'n1', topic: 'A', style: { fontWeight: 'bold', color: '#111' } };

test('color merges into existing style', () => {
  assert.deepEqual(buildNodePatch(node, 'background', '#ffeeaa'), { ok: true, patch: { style: { fontWeight: 'bold', color: '#111', background: '#ffeeaa' } } });
});

test('null clears a style key to an empty string', () => {
  assert.deepEqual(buildNodePatch(node, 'color', null), { ok: true, patch: { style: { fontWeight: 'bold', color: '' } } });
});

test('cleared style key survives the reshapeNode merge', () => {
  const result = buildNodePatch(node, 'color', null);
  const merged = Object.assign({ ...node.style }, result.ok ? result.patch.style : {});
  assert.equal(merged.color, '');
  assert.equal(merged.fontWeight, 'bold');
});

test('unsafe color is rejected', () => {
  assert.deepEqual(buildNodePatch(node, 'color', 'url(x)'), { ok: false, reason: 'invalid' });
});

test('font size is clamped and written as px', () => {
  const result = buildNodePatch(node, 'fontSize', 99);
  assert.equal(result.ok && result.patch.style?.fontSize, '40px');
});

test('bold toggles fontWeight', () => {
  const result = buildNodePatch(node, 'bold', false);
  assert.deepEqual(result, { ok: true, patch: { style: { fontWeight: '', color: '#111' } } });
});

test('tags split on commas, trim, drop empties and angle brackets', () => {
  assert.deepEqual(buildNodePatch(node, 'tags', ' a, <b> ,, c '), { ok: true, patch: { tags: ['a', 'b', 'c'] } });
});

test('links must be http, https or mailto', () => {
  assert.equal(isSafeLink('https://x.dev'), true);
  assert.equal(isSafeLink('javascript:alert(1)'), false);
  assert.deepEqual(buildNodePatch(node, 'hyperLink', 'javascript:alert(1)'), { ok: false, reason: 'invalid' });
  assert.deepEqual(buildNodePatch(node, 'hyperLink', ''), { ok: true, patch: { hyperLink: undefined } });
});

test('note is stored as plain text', () => {
  assert.deepEqual(buildNodePatch(node, 'note', 'line 1\nline 2'), { ok: true, patch: { note: 'line 1\nline 2' } });
});

test('toggleIcon adds then removes', () => {
  assert.deepEqual(toggleIcon(undefined, '⭐'), ['⭐']);
  assert.deepEqual(toggleIcon(['⭐', '✅'], '⭐'), ['✅']);
});

test('icons patch keeps icons outside the grid', () => {
  assert.deepEqual(buildNodePatch(node, 'icons', ['custom,1', '⭐']), { ok: true, patch: { icons: ['custom,1', '⭐'] } });
});

test('icons patch drops blank and angle-bracket entries; empty gives undefined', () => {
  assert.deepEqual(buildNodePatch(node, 'icons', ['', '<x>', '✅']), { ok: true, patch: { icons: ['✅'] } });
  assert.deepEqual(buildNodePatch(node, 'icons', []), { ok: true, patch: { icons: undefined } });
});

test('toggleIcon keeps non-grid icons', () => {
  assert.deepEqual(toggleIcon(['custom', '⭐'], '⭐'), ['custom']);
  assert.deepEqual(toggleIcon(['custom'], '✅'), ['custom', '✅']);
});

test('shape preset writes borderRadius and empty clears it', () => {
  const pill = buildNodePatch(node, 'shape', 'pill');
  assert.equal(pill.ok && (pill.patch.style as Record<string, string>).borderRadius, '999px');
  const cleared = buildNodePatch(node, 'shape', '');
  assert.equal(cleared.ok && (cleared.patch.style as Record<string, string>).borderRadius, '');
  assert.deepEqual(buildNodePatch(node, 'shape', 'blob'), { ok: false, reason: 'invalid' });
});

test('font family maps a key to its stack and rejects free text', () => {
  const serif = buildNodePatch(node, 'fontFamily', 'serif');
  assert.match((serif.ok && serif.patch.style?.fontFamily) || '', /Georgia/);
  assert.deepEqual(buildNodePatch(node, 'fontFamily', 'Comic Sans'), { ok: false, reason: 'invalid' });
});

test('text decoration accepts only known values', () => {
  const under = buildNodePatch(node, 'textDecoration', 'underline');
  assert.equal(under.ok && under.patch.style?.textDecoration, 'underline');
  assert.deepEqual(buildNodePatch(node, 'textDecoration', 'blink'), { ok: false, reason: 'invalid' });
});

test('width is clamped and written as px', () => {
  const wide = buildNodePatch(node, 'width', 5000);
  assert.equal(wide.ok && wide.patch.style?.width, '800px');
});

test('border is validated and round-trips through parseBorder', () => {
  const ok = buildNodePatch(node, 'border', '2px dashed #ff0000');
  assert.equal(ok.ok && ok.patch.style?.border, '2px dashed #ff0000');
  assert.deepEqual(parseBorder('2px dashed #ff0000'), { width: 2, style: 'dashed', color: '#ff0000' });
  assert.deepEqual(buildNodePatch(node, 'border', '2px groove red'), { ok: false, reason: 'invalid' });
  assert.deepEqual(buildNodePatch(node, 'border', '50px solid red'), { ok: false, reason: 'invalid' });
});

test('setIcon adds or removes regardless of current state', () => {
  assert.deepEqual(setIcon(['⭐'], '⭐', true), ['⭐']);
  assert.deepEqual(setIcon(undefined, '⭐', true), ['⭐']);
  assert.deepEqual(setIcon(['⭐', '🔥'], '⭐', false), ['🔥']);
});

test('fontKeyOf and shapeKeyOf reverse-map stored CSS', () => {
  const serif = buildNodePatch(node, 'fontFamily', 'serif');
  assert.equal(fontKeyOf(serif.ok ? serif.patch.style?.fontFamily : undefined), 'serif');
  assert.equal(shapeKeyOf('50%'), 'circle');
  assert.equal(shapeKeyOf('3px'), '');
});

test('parsePadding reads 1, 2 and 4 value forms', () => {
  assert.deepEqual(parsePadding('8px'), { vertical: 8, horizontal: 8 });
  assert.deepEqual(parsePadding('8px 25px'), { vertical: 8, horizontal: 25 });
  assert.deepEqual(parsePadding('8px 25px 8px 25px'), { vertical: 8, horizontal: 25 });
  assert.equal(parsePadding('1em'), null);
  assert.equal(parsePadding(undefined), null);
});

test('padding and radius patches clamp, format and clear', () => {
  const node: NodeObj = { id: 'a', topic: 'A' };
  assert.deepEqual(buildNodePatch(node, 'padding', '500px 4px'), { ok: true, patch: { style: { padding: `${PADDING_MAX}px 4px` } } });
  assert.deepEqual(buildNodePatch(node, 'padding', 'x'), { ok: false, reason: 'invalid' });
  assert.deepEqual(buildNodePatch(node, 'radius', 20.4), { ok: true, patch: { style: { borderRadius: '20px' } } });
  assert.deepEqual(buildNodePatch(node, 'radius', 5000), { ok: true, patch: { style: { borderRadius: `${RADIUS_MAX}px` } } });
  assert.deepEqual(buildNodePatch(node, 'radius', null), { ok: true, patch: { style: { borderRadius: '' } } });
});
