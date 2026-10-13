import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeControlStyle } from './mindmap-icon-names.ts';
import { CLASSIC_GLYPHS, CLASSIC_PATHS } from './mindmap-classic-icons.ts';

test('control style defaults to classic for unknown values', () => {
  assert.equal(normalizeControlStyle('compact'), 'compact');
  assert.equal(normalizeControlStyle('classic'), 'classic');
  assert.equal(normalizeControlStyle(undefined), 'classic');
  assert.equal(normalizeControlStyle('neon'), 'classic');
});

test('every classic icon has either package paths or a glyph', () => {
  const names = ['lens-data', 'lens-map', 'lens-doc', 'dir-left', 'dir-right', 'dir-side', 'graph', 'lock', 'panel', 'undo', 'redo', 'export', 'more', 'fullscreen', 'center', 'zoom-out', 'zoom-in', 'fit', 'root', 'pan'] as const;
  for (const name of names) assert.ok(CLASSIC_PATHS[name] || CLASSIC_GLYPHS[name], name);
});
