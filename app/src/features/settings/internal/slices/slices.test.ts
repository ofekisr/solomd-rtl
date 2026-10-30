import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SettingsRecord, SettingsSlice } from '../../contracts/index.ts';
import { SETTINGS_VERSION, SettingsSliceManifestSchema } from '../../contracts/index.ts';
import { EXPECTED_DIR } from '../__fixtures__/golden-capture.fixture.ts';
import { withLocalStorage } from '../local-storage-stub.ts';
import { SETTINGS_SLICES } from '../settings-slices.ts';
import { SETTINGS_MIGRATIONS } from '../settings-migrations.ts';
import { loadSettings } from '../settings-load.service.ts';

const SLICE_COUNT = 14;
const NONE_KEYS_OMITTED = ['settingsVersion'];

function slice(id: string): SettingsSlice {
  const found = SETTINGS_SLICES.find((candidate) => candidate.id === id);
  assert.ok(found, id);
  return found;
}

function normalized(id: string, parsed: SettingsRecord): SettingsRecord {
  const target = slice(id);
  const merged: SettingsRecord = { ...target.defaults(), ...parsed };
  target.normalize?.(parsed, merged);
  return merged;
}

function pre(): { restore(): void } {
  return withLocalStorage({});
}

function noneKeys(): string[] {
  const expected = JSON.parse(readFileSync(`${EXPECTED_DIR}none.json`, 'utf8')) as SettingsRecord;
  return Object.keys(expected).filter((key) => !NONE_KEYS_OMITTED.includes(key)).sort();
}

test('registry: 14 slices, kebab-case unique ids', () => {
  assert.equal(SETTINGS_SLICES.length, SLICE_COUNT);
  const ids = SETTINGS_SLICES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(SettingsSliceManifestSchema.shape.id.safeParse(id).success, id);
});

test('partition: each key is in exactly one slice and schema keys equal default keys', () => {
  const stub = pre();
  try {
    const seen = new Map<string, string>();
    for (const s of SETTINGS_SLICES) {
      const defaultKeys = Object.keys(s.defaults()).sort();
      assert.deepEqual(Object.keys(s.schema.shape).sort(), defaultKeys, s.id);
      for (const key of defaultKeys) {
        assert.equal(seen.get(key), undefined, `${key} in ${seen.get(key)} and ${s.id}`);
        seen.set(key, s.id);
      }
    }
  } finally {
    stub.restore();
  }
});

test("union of slice defaults has today's keys (pre-wave captured defaults)", () => {
  const stub = pre();
  try {
    const union = SETTINGS_SLICES.flatMap((s) => Object.keys(s.defaults())).sort();
    assert.deepEqual(union, noneKeys());
  } finally {
    stub.restore();
  }
});

test('defaults() returns fresh arrays and objects every call', () => {
  const stub = pre();
  try {
    const first = slice('layout').defaults();
    const second = slice('layout').defaults();
    assert.notEqual(first.rsPaneOrder, second.rsPaneOrder);
    assert.deepEqual(first, second);
  } finally {
    stub.restore();
  }
});

test('export.normalize clamps pdfDefaults and rejects unknown enums', () => {
  const stub = pre();
  try {
    const out = normalized('export', { pdfDefaults: { fontSize: 99, customWidthMm: 1, pageSize: 'Tabloid', toc: 'yes' } });
    assert.deepEqual(out.pdfDefaults, {
      pageSize: 'A4', customWidthMm: 50, customHeightMm: 297, margin: 'Normal',
      customMarginTopMm: 15, customMarginRightMm: 15, customMarginBottomMm: 15, customMarginLeftMm: 15,
      fontFamily: '', fontSize: 16, footer: true, codeTheme: 'preview', toc: false,
    });
  } finally {
    stub.restore();
  }
});

test('app.normalize clamps auto-save delay, falls back on bad conflict choice, keeps only string/null keybindings', () => {
  const stub = pre();
  try {
    const out = normalized('app', { autoSaveDelayMs: 1, convertConflictChoice: 'bogus', keybindings: { a: 'Mod-k', b: null, c: 5 } });
    assert.equal(out.autoSaveDelayMs, 300);
    assert.equal(out.convertConflictChoice, slice('app').defaults().convertConflictChoice);
    assert.deepEqual(out.keybindings, { a: 'Mod-k', b: null });
    assert.equal(normalized('app', { autoSaveDelayMs: 'x' }).autoSaveDelayMs, 1000);
  } finally {
    stub.restore();
  }
});

test('app.normalize drops non-object keybindings to an empty map', () => {
  const stub = pre();
  try {
    assert.deepEqual(normalized('app', { keybindings: 'nope' }).keybindings, {});
  } finally {
    stub.restore();
  }
});

test('ai.normalize clamps delays and only accepts a literal true for the warning flag', () => {
  const stub = pre();
  try {
    const out = normalized('ai', { aiReleaseDelayMs: 999_999, aiStaleTimeoutMs: 1, aiWarningAlwaysMinimized: 'true' });
    assert.equal(out.aiReleaseDelayMs, 60_000);
    assert.equal(out.aiStaleTimeoutMs, 5_000);
    assert.equal(out.aiWarningAlwaysMinimized, false);
    assert.equal(normalized('ai', { aiWarningAlwaysMinimized: true }).aiWarningAlwaysMinimized, true);
  } finally {
    stub.restore();
  }
});

test('appearance.normalize resets an unknown mode and a dangling active theme id', () => {
  const stub = pre();
  try {
    const out = normalized('appearance', { appearance: 'neon', activeUserThemeId: 'gone', userThemes: 'x' });
    assert.equal(out.appearance, 'system');
    assert.equal(out.activeUserThemeId, '');
    assert.deepEqual(out.userThemes, []);
  } finally {
    stub.restore();
  }
});

test('mindmap.normalize keeps default tag rules unless the blob has the key', () => {
  const stub = pre();
  try {
    const defaultRules = slice('mindmap').defaults().mindmapFolderTagRules;
    assert.deepEqual(normalized('mindmap', {}).mindmapFolderTagRules, defaultRules);
    assert.deepEqual(normalized('mindmap', { mindmapFolderTagRules: [] }).mindmapFolderTagRules, []);
    assert.equal(normalized('mindmap', { mindmapControlStyle: 'bogus' }).mindmapControlStyle, slice('mindmap').defaults().mindmapControlStyle);
  } finally {
    stub.restore();
  }
});

test('writing.normalize maps any engine but codemirror to native', () => {
  const stub = pre();
  try {
    assert.equal(normalized('writing', { windowsEditorEngine: 'x' }).windowsEditorEngine, 'native');
    assert.equal(normalized('writing', { windowsEditorEngine: 'codemirror' }).windowsEditorEngine, 'codemirror');
  } finally {
    stub.restore();
  }
});

test('explorer.normalize keeps only valid sort modes', () => {
  const stub = pre();
  try {
    const out = normalized('explorer', { explorerSortByFolder: { '/a': 'name-desc', '/b': 'bogus' } });
    assert.deepEqual(out.explorerSortByFolder, { '/a': 'name-desc' });
    assert.deepEqual(normalized('explorer', { explorerSortByFolder: 7 }).explorerSortByFolder, {});
  } finally {
    stub.restore();
  }
});

test('git.normalize keeps only string repo roots', () => {
  const stub = pre();
  try {
    assert.deepEqual(normalized('git', { gitTrustedRepos: ['/a', 3, null, '/b'] }).gitTrustedRepos, ['/a', '/b']);
    assert.deepEqual(normalized('git', { gitTrustedRepos: 'x' }).gitTrustedRepos, []);
  } finally {
    stub.restore();
  }
});

test('general.normalize maps a stored language zh to en on every load, even at the current version', () => {
  assert.equal(normalized('general', { language: 'zh' }).language, 'en');
  assert.equal(normalized('general', { language: 'ja' }).language, 'ja');
  const { settings } = loadSettings(JSON.stringify({ settingsVersion: SETTINGS_VERSION, language: 'zh' }), SETTINGS_SLICES, SETTINGS_MIGRATIONS);
  assert.equal(settings.language, 'en');
});
