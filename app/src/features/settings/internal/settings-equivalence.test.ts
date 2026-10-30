import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { z } from 'zod';
import type { SettingsRecord, SettingsSlice } from '../contracts/index.ts';
import { SETTINGS_VERSION } from '../contracts/index.ts';
import { EXPECTED_DIR, listBlobNames, readBlob } from './__fixtures__/golden-capture.fixture.ts';
import { loadSettings } from './settings-load.service.ts';
import { withLocalStorage } from './local-storage-stub.ts';
import { SETTINGS_MIGRATIONS } from './settings-migrations.ts';

const MIGRATION_OWNED_KEYS = [
  'language', 'showAgentPanel', 'showFileTree', 'smartQuotes', 'previewFontSize', 'rightSidebarHidden',
  'v4AgentPanelMigrated', 'fileTreeDefaultDesktopMigrated', 'smartQuotesOptInMigrated', 'v4810PreviewFontSynced', 'v491MobileLayoutMigrated',
] as const;

async function todaysDefaults(): Promise<SettingsRecord> {
  const stub = withLocalStorage({});
  try {
    const { defaults } = await import('../../../stores/settings.ts');
    return defaults() as unknown as SettingsRecord;
  } finally {
    stub.restore();
  }
}

function wholeSchemaSlice(defaults: SettingsRecord): SettingsSlice<SettingsRecord> {
  return { id: 'whole-schema', schema: z.object({}) as SettingsSlice<SettingsRecord>['schema'], defaults: () => ({ ...defaults }) };
}

function pick(record: SettingsRecord, keys: readonly string[]): SettingsRecord {
  return Object.fromEntries(keys.map((key) => [key, record[key]]));
}

function readExpected(name: string): SettingsRecord {
  return JSON.parse(readFileSync(`${EXPECTED_DIR}${name}.json`, 'utf8')) as SettingsRecord;
}

for (const name of listBlobNames()) {
  test(`${name}: migrations reproduce today's migration-owned keys`, async () => {
    const slice = wholeSchemaSlice(await todaysDefaults());
    const { settings } = loadSettings(readBlob(name), [slice], SETTINGS_MIGRATIONS, { isMobile: false });
    assert.deepEqual(pick(settings, MIGRATION_OWNED_KEYS), pick(readExpected(name), MIGRATION_OWNED_KEYS));
  });
}

test('a v2 blob with markers set changes nothing but settingsVersion ', async () => {
  const slice = wholeSchemaSlice(await todaysDefaults());
  const markers = Object.fromEntries(MIGRATION_OWNED_KEYS.filter((key) => key.endsWith('Migrated') || key.endsWith('Synced')).map((key) => [key, true]));
  const stored = { ...markers, settingsVersion: SETTINGS_VERSION, language: 'ja', fontSize: 20, showFileTree: false, smartQuotes: true };
  const { settings } = loadSettings(JSON.stringify(stored), [slice], SETTINGS_MIGRATIONS, { isMobile: false });
  assert.deepEqual(pick(settings, Object.keys(stored)), stored);
});
