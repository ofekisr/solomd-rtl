import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ClipboardImage } from './clipboard.port.ts';
import { createTauriClipboardPort, type ClipboardModule, type ImageModule } from './clipboard.tauri.adapter.ts';

type Call = { fn: string; args: unknown[] };

function setup() {
  const calls: Call[] = [];
  const record = (fn: string, result: unknown) => (...args: unknown[]): Promise<unknown> => {
    calls.push({ fn, args });
    return Promise.resolve(result);
  };
  const mod = {
    readText: record('readText', 'clip'),
    writeText: record('writeText', undefined),
    writeHtml: record('writeHtml', undefined),
    writeImage: record('writeImage', undefined),
  } as unknown as ClipboardModule;
  const handle = { handle: true };
  const loadImage = (): Promise<ImageModule> =>
    Promise.resolve({ Image: { fromBytes: record('fromBytes', handle) } } as unknown as ImageModule);
  return { calls, handle, port: createTauriClipboardPort(mod, loadImage) };
}

test('readText and writeText forward and return raw values', async () => {
  const { calls, port } = setup();
  assert.equal(await port.readText(), 'clip');
  await port.writeText('hi');
  assert.deepEqual(calls, [{ fn: 'readText', args: [] }, { fn: 'writeText', args: ['hi'] }]);
});

test('writeHtml forwards html and altText', async () => {
  const { calls, port } = setup();
  await port.writeHtml('<b>x</b>', 'x');
  assert.deepEqual(calls, [{ fn: 'writeHtml', args: ['<b>x</b>', 'x'] }]);
});

test('imageFromBytes loads the image module and writeImage forwards the handle', async () => {
  const { calls, handle, port } = setup();
  const bytes = new Uint8Array([1, 2]);
  const image = await port.imageFromBytes(bytes);
  assert.equal(image as unknown, handle);
  await port.writeImage(image as ClipboardImage);
  assert.deepEqual(calls, [{ fn: 'fromBytes', args: [bytes] }, { fn: 'writeImage', args: [handle] }]);
});
