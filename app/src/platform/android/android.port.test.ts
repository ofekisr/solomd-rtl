import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { androidCommands } from './android.port.ts';
import { createWebAndroidPort } from './android.web.adapter.ts';

const fixtures: CatalogFixtures = {
  saf_create: { args: { treeUri: 'content://tree/primary%3ANotes', parentDocId: 'primary:Notes', mime: 'text/markdown', name: 'a.md' }, result: 'primary:Notes/a.md' },
  saf_list: { args: { treeUri: 'content://tree/primary%3ANotes', docId: 'primary:Notes' }, result: [{ name: 'a.md', docId: 'primary:Notes/a.md', isDir: false }] },
  saf_persisted_trees: { result: ['content://tree/primary%3ANotes'] },
  saf_pick_folder: { result: null },
  saf_poll_picked: { result: null },
  saf_read: { args: { treeUri: 'content://tree/primary%3ANotes', docId: 'primary:Notes/a.md' }, result: '# A' },
  saf_tree_name: { args: { treeUri: 'content://tree/primary%3ANotes', docId: 'primary:Notes' }, result: 'Notes' },
  saf_tree_root: { args: { treeUri: 'content://tree/primary%3ANotes' }, result: 'primary:Notes' },
  saf_write: { args: { treeUri: 'content://tree/primary%3ANotes', docId: 'primary:Notes/a.md', content: '# A' }, result: null },
  android_request_all_files_access: { result: null },
  android_restart_app: { result: null },
  android_system_insets: { result: { top: 72, bottom: 48 } },
};

test('android catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(androidCommands, fixtures), []);
});

test('android tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: androidCommands[command as keyof typeof androidCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.equal(await method(fixture.args), fixture.result);
  }
});

test('android web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebAndroidPort().safPickFolder(), PlatformUnsupportedError);
});
