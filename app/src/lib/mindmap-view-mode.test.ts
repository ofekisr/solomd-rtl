import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSourceExit, nextMindmapMode, normalizeMindmapMode, targetModeFor } from './mindmap-view-mode.ts';

test('normalizeMindmapMode falls back to map for unknown values', () => {
  assert.equal(normalizeMindmapMode(undefined), 'map');
  assert.equal(normalizeMindmapMode('graph'), 'map');
  assert.equal(normalizeMindmapMode('source'), 'source');
});

test('nextMindmapMode cycles map → source → outline → map', () => {
  assert.equal(nextMindmapMode('map'), 'source');
  assert.equal(nextMindmapMode('source'), 'outline');
  assert.equal(nextMindmapMode('outline'), 'map');
});

test('targetModeFor maps view actions and ignores others', () => {
  assert.equal(targetModeFor('mindmap.viewOutline', 'map'), 'outline');
  assert.equal(targetModeFor('mindmap.cycleView', 'outline'), 'map');
  assert.equal(targetModeFor('mindmap.fit', 'map'), null);
});

test('checkSourceExit passes the parser error through', () => {
  const ok = checkSourceExit('{}', () => ({ ok: true }));
  const bad = checkSourceExit('{', () => ({ ok: false, error: 'Invalid JSON: x' }));
  assert.deepEqual(ok, { ok: true });
  assert.deepEqual(bad, { ok: false, error: 'Invalid JSON: x' });
});
