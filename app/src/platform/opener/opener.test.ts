import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import { createTauriOpenerPort } from './opener.tauri.adapter.ts';
import { createWebOpenerPort } from './opener.web.adapter.ts';

test('tauri adapter lazily loads the module and forwards each call', async () => {
  const calls: string[][] = [];
  let loads = 0;
  const record = (name: string) => (arg: string): Promise<void> => (calls.push([name, arg]), Promise.resolve());
  const fake = { openUrl: record('openUrl'), openPath: record('openPath'), revealItemInDir: record('revealItemInDir') };
  const port = createTauriOpenerPort(() => (loads++, Promise.resolve(fake as never)));
  assert.equal(loads, 0);
  assert.equal(await port.openUrl('https://a'), undefined);
  await port.openPath('/p');
  await port.revealItemInDir('/q');
  assert.deepEqual(calls, [['openUrl', 'https://a'], ['openPath', '/p'], ['revealItemInDir', '/q']]);
  assert.equal(loads, 3);
});

test('web adapter rejects PlatformUnsupportedError for each function', async () => {
  const port = createWebOpenerPort();
  for (const [op, call] of [
    ['opener.openUrl', port.openUrl('u')],
    ['opener.openPath', port.openPath('p')],
    ['opener.revealItemInDir', port.revealItemInDir('p')],
  ] as const) {
    await assert.rejects(call, (e: unknown) => e instanceof PlatformUnsupportedError && e.operation === op);
  }
});
