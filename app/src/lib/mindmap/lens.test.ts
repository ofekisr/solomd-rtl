import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cellHas, checkJsonExit, dataToggleTarget, isLensAction, lensCell, migrateLensKeybindings, nextLens,
  normalizeLens, resolveTabLens, targetLensFor, type CellPart, type MindmapLens,
} from './lens.ts';
import type { ViewMode } from '../../types.ts';

test('normalizeLens falls back to map', () => {
  assert.equal(normalizeLens('data'), 'data');
  assert.equal(normalizeLens('source'), 'map');
  assert.equal(normalizeLens(undefined), 'map');
});

test('resolveTabLens migrates the Phase 7 mindmapMode', () => {
  assert.equal(resolveTabLens({ mindmapMode: 'source' }), 'data');
  assert.equal(resolveTabLens({ mindmapMode: 'outline' }), 'doc');
  assert.equal(resolveTabLens({ mindmapMode: 'map' }), 'map');
  assert.equal(resolveTabLens({ mindmapMode: 'constructor' }), 'map');
  assert.equal(resolveTabLens({}), 'map');
});

test('resolveTabLens prefers mindmapLens over the legacy field', () => {
  assert.equal(resolveTabLens({ mindmapLens: 'doc', mindmapMode: 'source' }), 'doc');
  assert.equal(resolveTabLens({ mindmapLens: 'bogus', mindmapMode: 'source' }), 'map');
});

test('nextLens cycles data → map → doc → data', () => {
  assert.equal(nextLens('data'), 'map');
  assert.equal(nextLens('map'), 'doc');
  assert.equal(nextLens('doc'), 'data');
});

test('dataToggleTarget flips into data and back to the default lens', () => {
  assert.equal(dataToggleTarget('map'), 'data');
  assert.equal(dataToggleTarget('doc'), 'data');
  assert.equal(dataToggleTarget('data'), 'map');
});

test('targetLensFor maps lens commands and ignores others', () => {
  assert.equal(targetLensFor('mindmap.lensData', 'map'), 'data');
  assert.equal(targetLensFor('mindmap.lensDoc', 'map'), 'doc');
  assert.equal(targetLensFor('mindmap.cycleLens', 'doc'), 'data');
  assert.equal(targetLensFor('mindmap.fit', 'map'), null);
  assert.equal(targetLensFor('toString', 'map'), null);
  assert.equal(isLensAction('mindmap.lensMap'), true);
  assert.equal(isLensAction('mindmap.viewMap'), false);
  assert.equal(isLensAction('constructor'), false);
});

const MATRIX: ReadonlyArray<[ViewMode, MindmapLens, CellPart[]]> = [
  ['edit', 'data', ['json']],
  ['edit', 'map', ['outlineText']],
  ['edit', 'doc', ['outlineText']],
  ['split', 'data', ['json', 'map']],
  ['split', 'map', ['map', 'outlinePreview']],
  ['split', 'doc', ['outlineText', 'outlinePreview']],
  ['liveEdit', 'data', ['map']],
  ['liveEdit', 'map', ['map']],
  ['liveEdit', 'doc', ['outlinePreview']],
  ['preview', 'data', ['outlinePreview']],
  ['preview', 'map', ['outlinePreview']],
  ['preview', 'doc', ['outlinePreview']],
  ['reading', 'data', ['wideMap']],
  ['reading', 'map', ['wideMap']],
  ['reading', 'doc', ['outlineReading']],
];

test('lensCell covers all 15 lens × view pairs', () => {
  for (const [view, lens, parts] of MATRIX) {
    assert.deepEqual(lensCell(lens, view), parts, `${lens} · ${view}`);
  }
});

test('cellHas checks membership', () => {
  assert.equal(cellHas(['json', 'map'], 'map'), true);
  assert.equal(cellHas(['outlineText'], 'json'), false);
});

test('migrateLensKeybindings moves old ids to new ids', () => {
  const out = migrateLensKeybindings({ 'mindmap.viewSource': 'Mod+1', 'mindmap.cycleView': null, 'file.save': 'Mod+S' });
  assert.deepEqual(out, { 'mindmap.lensData': 'Mod+1', 'mindmap.cycleLens': null, 'file.save': 'Mod+S' });
});

test('migrateLensKeybindings keeps an existing new-id binding', () => {
  const out = migrateLensKeybindings({ 'mindmap.viewMap': 'Mod+1', 'mindmap.lensMap': 'Mod+2' });
  assert.deepEqual(out, { 'mindmap.lensMap': 'Mod+2' });
});

test('checkJsonExit passes the parser error through', () => {
  assert.deepEqual(checkJsonExit('{}', () => ({ ok: true })), { ok: true });
  assert.deepEqual(checkJsonExit('{', () => ({ ok: false, error: 'Invalid JSON: x' })), { ok: false, error: 'Invalid JSON: x' });
});
