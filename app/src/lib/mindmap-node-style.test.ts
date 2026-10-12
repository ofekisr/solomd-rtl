import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { buildNodePatch, isSafeLink, toggleIcon } from './mindmap-node-style.ts';

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
