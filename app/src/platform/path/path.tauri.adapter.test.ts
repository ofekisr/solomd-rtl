import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTauriPathPort, type FsModule, type PathModule } from './path.tauri.adapter.ts';

type Call = { fn: string; args: unknown[] };

function setup() {
  const calls: Call[] = [];
  const record = (fn: string, result: unknown) => (...args: unknown[]): unknown => {
    calls.push({ fn, args });
    return result;
  };
  const bytes = new Uint8Array([7]);
  const mod = {
    sep: record('sep', '/'),
    join: record('join', Promise.resolve('/a/b')),
    tempDir: record('tempDir', Promise.resolve('/tmp')),
    documentDir: record('documentDir', Promise.resolve('/docs')),
    desktopDir: record('desktopDir', Promise.resolve('/desk')),
    homeDir: record('homeDir', Promise.resolve('/home')),
  } as unknown as PathModule;
  const fs = {
    readFile: record('readFile', Promise.resolve(bytes)),
    exists: record('exists', Promise.resolve(true)),
    writeTextFile: record('writeTextFile', Promise.resolve()),
  } as unknown as FsModule;
  return { calls, bytes, port: createTauriPathPort(mod, () => Promise.resolve(fs)) };
}

test('path functions forward arguments and return raw values', async () => {
  const { calls, port } = setup();
  assert.equal(port.sep(), '/');
  assert.equal(await port.join('a', 'b'), '/a/b');
  assert.equal(await port.tempDir(), '/tmp');
  assert.equal(await port.documentDir(), '/docs');
  assert.equal(await port.desktopDir(), '/desk');
  assert.equal(await port.homeDir(), '/home');
  assert.deepEqual(calls.map((c) => c.fn), ['sep', 'join', 'tempDir', 'documentDir', 'desktopDir', 'homeDir']);
  assert.deepEqual(calls[1].args, ['a', 'b']);
});

test('fs functions load plugin-fs lazily and forward arguments', async () => {
  const { calls, bytes, port } = setup();
  assert.equal(await port.readFile('/f'), bytes);
  assert.equal(await port.exists('/f'), true);
  await port.writeTextFile('/f', 'x');
  assert.deepEqual(calls, [
    { fn: 'readFile', args: ['/f'] },
    { fn: 'exists', args: ['/f'] },
    { fn: 'writeTextFile', args: ['/f', 'x'] },
  ]);
});
