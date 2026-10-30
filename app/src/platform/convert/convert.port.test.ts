import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/platform-error.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { convertCommands } from './convert.port.ts';
import { createWebConvertPort } from './convert.web.adapter.ts';

const fixtures: CatalogFixtures = {
  convert_file_to_markdown: { args: { path: '/docs/a.docx' }, result: '# A' },
  pandoc_detect: { result: { path: '/usr/local/bin/pandoc', version: 'pandoc 3.1' } },
  pandoc_export: { args: { args: { input_markdown: '# A', format: 'epub', output_path: '/out/a.epub', bibliography: null, csl: null, template: null, extra_args: [] } }, result: null },
  upload_image: { args: { config: { kind: 'smms', token: '' }, path: '/img/a.png' }, result: 'https://i.imgur.test/a.png' },
  print_webview: { result: null },
};

test('convert catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(convertCommands, fixtures), []);
});

test('convert tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: convertCommands[command as keyof typeof convertCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.equal(await method(fixture.args), fixture.result);
  }
});

test('convert web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebConvertPort().printWebview(), PlatformUnsupportedError);
});
