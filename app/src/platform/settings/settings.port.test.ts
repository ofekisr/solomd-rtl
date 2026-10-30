import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/platform-error.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { settingsCommands } from './settings.port.ts';
import { createWebSettingsPort } from './settings.web.adapter.ts';

const manifest = {
  sourceFile: 'a.json',
  schemaVersion: 1,
  grammar: { opening: '{{', marker: '@', closing: '}}', pairSeparator: ',', keyValueSeparator: ':' },
  directives: [{ key: 'k', type: 'enum', values: ['x'], default: null, label: null, description: 'd' }],
};

const fixtures: CatalogFixtures = {
  theme_install: { args: { id: 'nord', css: 'body{}' }, result: { path: '/cfg/themes/nord.css' } },
  theme_json_list: { result: [{ id: 'mine', json: '{}' }] },
  theme_json_remove: { args: { id: 'mine' }, result: null },
  theme_json_save: { args: { id: 'mine', json: '{}' }, result: null },
  theme_list_installed: { result: [{ id: 'nord', path: '/cfg/themes/nord.css' }] },
  theme_uninstall: { args: { id: 'nord' }, result: null },
  spellcheck_check: { args: { text: 'helo world' }, result: [{ word: 'helo', start: 0, end: 4 }] },
  spellcheck_dicts_dir: { result: '/cfg/dicts' },
  spellcheck_init: { args: { lang: 'en' }, result: 12345 },
  spellcheck_list_dicts: { result: ['en', 'he'] },
  directive_completions_load: { result: { directory: '/cfg/completions', manifests: [manifest], warnings: [{ sourceFile: 'b.json', reason: 'bad' }] } },
  directive_completions_open_folder: { result: '/cfg/completions' },
  save_language_preference: { args: { lang: 'he' }, result: null },
  set_as_default_markdown_editor: { result: 'Set as default' },
};

test('settings catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(settingsCommands, fixtures), []);
});

test('settings tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: settingsCommands[command as keyof typeof settingsCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.equal(await method(fixture.args), fixture.result);
  }
});

test('settings web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebSettingsPort().themeListInstalled(), PlatformUnsupportedError);
});
