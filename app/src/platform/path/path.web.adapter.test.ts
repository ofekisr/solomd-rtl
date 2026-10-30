import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/platform-error.ts';
import { createWebPathPort } from './path.web.adapter.ts';

test('sep throws synchronously', () => {
  assert.throws(() => createWebPathPort().sep(), PlatformUnsupportedError);
});

test('convertFileSrc throws synchronously', () => {
  assert.throws(() => createWebPathPort().convertFileSrc('/f'), PlatformUnsupportedError);
});

test('async path and fs functions reject with PlatformUnsupportedError', async () => {
  const port = createWebPathPort();
  const attempts = [
    port.join('a'), port.tempDir(), port.documentDir(), port.desktopDir(), port.homeDir(),
    port.readFile('/f'), port.exists('/f'), port.writeTextFile('/f', 'x'),
  ];
  for (const attempt of attempts) {
    await assert.rejects(attempt, PlatformUnsupportedError);
  }
});
