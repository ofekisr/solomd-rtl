import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlatformWebview, PlatformWebviewWindow, PlatformWindow, WebviewWindowOptions } from './window.port.ts';
import { createTauriWindowPort, type TauriWindowModules } from './window.tauri.adapter.ts';

const fakeWindow = { label: 'main' } as PlatformWindow;
const fakeWebview = { name: 'wv' } as unknown as PlatformWebview;
const fakeWebviewWindow = { name: 'ww' } as unknown as PlatformWebviewWindow;

function makeModules(calls: unknown[][]): TauriWindowModules {
  return {
    getCurrentWindow: () => fakeWindow,
    getCurrentWebview: () => fakeWebview,
    createWebviewWindow: (label: string, options: WebviewWindowOptions) => {
      calls.push(['create', label, options]);
      return fakeWebviewWindow;
    },
    getVersion: async () => '1.2.3',
    loadDeepLink: async () => ({
      onOpenUrl: async (handler) => {
        calls.push(['onOpenUrl', handler]);
        return () => undefined;
      },
      getCurrent: async () => ['solomd://a'],
    }),
  };
}

test('current window and webview are returned synchronously and unchanged', () => {
  const port = createTauriWindowPort(makeModules([]));
  assert.equal(port.currentWindow(), fakeWindow);
  assert.equal(port.currentWebview(), fakeWebview);
});

test('createWebviewWindow forwards label and options', () => {
  const calls: unknown[][] = [];
  const options = { url: '/', title: 'T', width: 1, height: 2 };
  const result = createTauriWindowPort(makeModules(calls)).createWebviewWindow('l', options);
  assert.equal(result, fakeWebviewWindow);
  assert.deepEqual(calls, [['create', 'l', options]]);
});

test('getVersion returns the module value', async () => {
  assert.equal(await createTauriWindowPort(makeModules([])).getVersion(), '1.2.3');
});

test('deepLink loads lazily and forwards', async () => {
  const calls: unknown[][] = [];
  const modules = makeModules(calls);
  let loads = 0;
  const original = modules.loadDeepLink;
  modules.loadDeepLink = () => {
    loads += 1;
    return original();
  };
  const port = createTauriWindowPort(modules);
  assert.equal(loads, 0);
  const handler = (): void => undefined;
  await port.deepLink.onOpenUrl(handler);
  assert.deepEqual(calls, [['onOpenUrl', handler]]);
  assert.deepEqual(await port.deepLink.getCurrent(), ['solomd://a']);
  assert.equal(loads, 2);
});
