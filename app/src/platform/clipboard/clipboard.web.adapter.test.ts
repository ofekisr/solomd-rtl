import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import type { ClipboardImage } from './clipboard.port.ts';
import { createWebClipboardPort } from './clipboard.web.adapter.ts';

test('every clipboard function rejects with PlatformUnsupportedError', async () => {
  const port = createWebClipboardPort();
  const image = {} as ClipboardImage;
  const attempts = [
    port.readText(),
    port.writeText('a'),
    port.writeHtml('<b/>'),
    port.writeImage(image),
    port.imageFromBytes(new Uint8Array()),
  ];
  for (const attempt of attempts) {
    await assert.rejects(attempt, PlatformUnsupportedError);
  }
});
