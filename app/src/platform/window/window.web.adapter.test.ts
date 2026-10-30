import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import { createWebWindowPort } from './window.web.adapter.ts';

const isUnsupported = (operation: string) => (e: unknown): boolean =>
  e instanceof PlatformUnsupportedError && e.operation === operation;

test('sync entry points throw PlatformUnsupportedError', () => {
  const port = createWebWindowPort();
  assert.throws(() => port.currentWindow(), isUnsupported('window.getCurrentWindow'));
  assert.throws(() => port.currentWebview(), isUnsupported('webview.getCurrentWebview'));
  assert.throws(() => port.createWebviewWindow('a', {}), isUnsupported('webviewWindow.WebviewWindow'));
});

test('async entry points reject PlatformUnsupportedError', async () => {
  const port = createWebWindowPort();
  await assert.rejects(port.getVersion(), isUnsupported('app.getVersion'));
  await assert.rejects(port.deepLink.onOpenUrl(() => undefined), isUnsupported('deep-link.onOpenUrl'));
  await assert.rejects(port.deepLink.getCurrent(), isUnsupported('deep-link.getCurrent'));
});
