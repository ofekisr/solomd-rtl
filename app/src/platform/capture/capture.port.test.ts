import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/platform-error.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { captureCommands } from './capture.port.ts';
import { createWebCapturePort } from './capture.web.adapter.ts';

const captureState = { enabled: true, running: true, port: 7878, token: 't', inbox_folder: 'Inbox' };
const restState = { enabled: true, running: true, port: 7879, token: 't', allow_write: false };

const fixtures: CatalogFixtures = {
  capture_get_state: { result: captureState },
  capture_regenerate_token: { result: captureState },
  capture_set_enabled: { args: { enabled: true, port: 7878 }, result: captureState },
  capture_set_inbox_folder: { args: { folder: 'Inbox' }, result: captureState },
  capture_set_workspace: { args: { folder: null }, result: null },
  rest_get_state: { result: restState },
  rest_regenerate_token: { result: restState },
  rest_set_allow_write: { args: { allow: true }, result: restState },
  rest_set_enabled: { args: { enabled: true, port: 7879 }, result: restState },
  rest_set_workspace: { args: { folder: '/w' }, result: null },
  quick_capture_close: { result: null },
  quick_capture_open: { result: null },
  quick_capture_set_shortcut: { args: { accelerator: null }, result: null },
  quick_capture_write: { args: { content: 'note' }, result: '/w/Inbox/note.md' },
};

test('capture catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(captureCommands, fixtures), []);
});

test('capture catalog: optional port, title and tags parse', () => {
  assert.ok(captureCommands.capture_set_enabled.args.safeParse({ enabled: false }).success);
  assert.ok(captureCommands.quick_capture_write.args.safeParse({ title: 'T', content: 'c', tags: ['a'] }).success);
});

test('capture tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: captureCommands[command as keyof typeof captureCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.equal(await method(fixture.args), fixture.result);
  }
});

test('capture web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebCapturePort().captureGetState(), PlatformUnsupportedError);
});
