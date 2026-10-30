import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/platform-error.ts';
import { createTauriEventsPort } from './events.tauri.adapter.ts';
import { createWebEventsPort } from './events.web.adapter.ts';
import type { PlatformEvent, UnlistenFn } from './events.port.ts';

test('tauri adapter forwards listen args and returns the unlisten fn unchanged', async () => {
  const unlisten: UnlistenFn = () => {};
  const calls: unknown[][] = [];
  const handler = (_e: PlatformEvent<string>): void => {};
  const fake = {
    listen: (...args: unknown[]): Promise<UnlistenFn> => {
      calls.push(args);
      return Promise.resolve(unlisten);
    },
  };
  const port = createTauriEventsPort(fake as unknown as Parameters<typeof createTauriEventsPort>[0]);
  assert.equal(await port.listen('file-changed', handler), unlisten);
  assert.deepEqual(calls, [['file-changed', handler]]);
});

test('web adapter listen rejects PlatformUnsupportedError', async () => {
  await assert.rejects(
    createWebEventsPort().listen('x', () => {}),
    (e: unknown) => e instanceof PlatformUnsupportedError && e.operation === 'event.listen',
  );
});
