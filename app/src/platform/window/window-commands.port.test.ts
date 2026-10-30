import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/platform-error.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { windowCommands } from './window-commands.port.ts';
import { createWebWindowCommandsPort } from './window-commands.web.adapter.ts';

const fixtures: CatalogFixtures = {
  set_menu_config: { args: { lang: 'he', accels: { 'file.new': 'CmdOrCtrl+N', 'file.open': '' } }, result: null },
  force_close_window: { result: null },
  drain_pending_opens: { result: ['/w/a.md'] },
  set_max_button_rect: { args: { x: 0, y: 0, w: 46, h: 32, scale: 1.5 }, result: null },
  open_devtools: { result: null },
};

test('window commands catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(windowCommands, fixtures), []);
});

test('window commands tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: windowCommands[command as keyof typeof windowCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.deepEqual(await method(fixture.args), fixture.result);
  }
});

test('window commands web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebWindowCommandsPort().drainPendingOpens(), PlatformUnsupportedError);
});
