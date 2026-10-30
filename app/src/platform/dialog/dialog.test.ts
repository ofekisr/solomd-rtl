import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import { createTauriDialogPort } from './dialog.tauri.adapter.ts';
import { createWebDialogPort } from './dialog.web.adapter.ts';

type FakeModule = Parameters<typeof createTauriDialogPort>[0];

test('tauri adapter forwards open/save options and returns raw values', async () => {
  const calls: Record<string, unknown[]> = {};
  const fake = {
    open: (o: unknown): Promise<string[]> => ((calls.open = [o]), Promise.resolve(['/a', '/b'])),
    save: (o: unknown): Promise<null> => ((calls.save = [o]), Promise.resolve(null)),
  };
  const port = createTauriDialogPort(fake as unknown as FakeModule);
  const openOptions = { multiple: true, defaultPath: '/x', filters: [{ name: 'MD', extensions: ['md'] }] };
  const saveOptions = { defaultPath: 'a.md' };
  assert.deepEqual(await port.open(openOptions), ['/a', '/b']);
  assert.equal(await port.save(saveOptions), null);
  assert.deepEqual(calls, { open: [openOptions], save: [saveOptions] });
});

test('web adapter rejects PlatformUnsupportedError for open and save', async () => {
  const port = createWebDialogPort();
  await assert.rejects(port.open(), (e: unknown) => e instanceof PlatformUnsupportedError && e.operation === 'dialog.open');
  await assert.rejects(port.save(), (e: unknown) => e instanceof PlatformUnsupportedError && e.operation === 'dialog.save');
});
