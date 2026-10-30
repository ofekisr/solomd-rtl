import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/platform-error.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { cloudCommands } from './cloud.port.ts';
import { createWebCloudPort } from './cloud.web.adapter.ts';

const fixtures: CatalogFixtures = {
  cloud_folder_detect: { args: { folder: '/Users/a/Dropbox/notes' }, result: { provider: 'dropbox', label: 'Dropbox' } },
  device_id_get_or_create: { result: '6f1c2d3e-aaaa-bbbb-cccc-1234567890ab' },
  session_list_others: { args: { folder: '/w', ourDeviceId: 'dev-1' }, result: [{ device_id: 'dev-2', device_label: 'Mac', saved_at: 1760000000, tab_count: 2 }] },
  session_load: {
    args: { folder: '/w', deviceId: 'dev-2' },
    result: { device_id: 'dev-2', device_label: 'Mac', saved_at: 1760000000, active_index: 0, tabs: [{ file_path: '/w/a.md', file_name: 'a.md', cursor_line: 3, cursor_col: null, rel_path: null }] },
  },
  session_save: {
    args: { folder: '/w', payload: { device_id: 'dev-1', device_label: 'Mac', saved_at: 1760000000, active_index: 0, tabs: [{ file_path: null, file_name: 'Untitled', cursor_line: null, cursor_col: null }] } },
    result: null,
  },
};

test('cloud catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(cloudCommands, fixtures), []);
});

test('cloud tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: cloudCommands[command as keyof typeof cloudCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.equal(await method(fixture.args), fixture.result);
  }
});

test('cloud web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebCloudPort().deviceIdGetOrCreate(), PlatformUnsupportedError);
});
