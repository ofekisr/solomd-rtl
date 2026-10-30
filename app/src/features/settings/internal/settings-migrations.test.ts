import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SETTINGS_MIGRATIONS } from './settings-migrations.ts';

const DESKTOP = { isMobile: false };
const MOBILE = { isMobile: true };
const MARKERS = ['v4AgentPanelMigrated', 'fileTreeDefaultDesktopMigrated', 'smartQuotesOptInMigrated', 'v4810PreviewFontSynced', 'v491MobileLayoutMigrated'];

function up(raw: Record<string, unknown>, env = DESKTOP): Record<string, unknown> {
  return SETTINGS_MIGRATIONS[0].up(raw, env);
}

function allMarkers(): Record<string, unknown> {
  return Object.fromEntries(MARKERS.map((marker) => [marker, true]));
}

test('exactly one step, to version 2', () => {
  assert.deepEqual(SETTINGS_MIGRATIONS.map((migration) => migration.to), [2]);
});

test('an empty blob gets every marker and the one-time forced values', () => {
  const out = up({});
  for (const marker of MARKERS) assert.equal(out[marker], true, marker);
  assert.equal(out.showAgentPanel, true);
  assert.equal(out.showFileTree, true);
  assert.equal(out.smartQuotes, false);
});

test('markers make every step a no-op', () => {
  const raw = { ...allMarkers(), language: 'de', showAgentPanel: false, showFileTree: false, smartQuotes: true, fontSize: 20 };
  assert.deepEqual(up(raw), raw);
});

test('zh becomes en even when markers are set', () => {
  assert.equal(up({ ...allMarkers(), language: 'zh' }).language, 'en');
});

test('mobile keeps the file tree untouched and hides the right sidebar', () => {
  const out = up({ showFileTree: false }, MOBILE);
  assert.equal(out.showFileTree, false);
  assert.equal(out.rightSidebarHidden, true);
});

test('desktop never sets rightSidebarHidden', () => {
  assert.equal('rightSidebarHidden' in up({}), false);
});

test('preview font follows a customised editor font only while preview is at its old default', () => {
  assert.equal(up({ fontSize: 18 }).previewFontSize, 18);
  assert.equal(up({ fontSize: 99 }).previewFontSize, 32);
  assert.equal('previewFontSize' in up({ fontSize: 14 }), false);
  assert.equal(up({ fontSize: 18, previewFontSize: 17 }).previewFontSize, 17);
});

test('input is not mutated', () => {
  const raw = { fontSize: 18 };
  up(raw);
  assert.deepEqual(raw, { fontSize: 18 });
});
