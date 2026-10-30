import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/platform-error.ts';
import { createWebWindowPort } from './window.web.adapter.ts';

const isUnsupported = (operation: string) => (e: unknown): boolean =>
  e instanceof PlatformUnsupportedError && e.operation === operation;

test('sync entry points throw PlatformUnsupportedError', () => {
  const port = createWebWindowPort();
  assert.throws(() => port.currentWindow(), isUnsupported('window.getCurrentWindow'));
  assert.throws(() => port.currentWebview(), isUnsupported('webview.getCurrentWebview'));
});

test('async entry points reject PlatformUnsupportedError', async () => {
  const port = createWebWindowPort();
  await assert.rejects(port.getVersion(), isUnsupported('app.getVersion'));
  await assert.rejects(port.deepLink.onOpenUrl(() => undefined), isUnsupported('deep-link.onOpenUrl'));
  await assert.rejects(port.deepLink.getCurrent(), isUnsupported('deep-link.getCurrent'));
});

test('createWebviewWindow does not throw and reports tauri://error asynchronously', async () => {
  const win = createWebWindowPort().createWebviewWindow('a', {});
  const payload = await new Promise<unknown>((resolve) => {
    void win.once('tauri://error', (event) => resolve(event.payload));
  });
  assert.ok(isUnsupported('webviewWindow.WebviewWindow')(payload));
});

test('createWebviewWindow never fires tauri://created', async () => {
  const win = createWebWindowPort().createWebviewWindow('a', {});
  let created = false;
  await win.once('tauri://created', () => {
    created = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(created, false);
});
