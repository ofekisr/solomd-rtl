import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLE = fileURLToPath(new URL('../dist/index.mjs', import.meta.url));
const TIMEOUT_MS = 10_000;
const LIST_ID = 2;

function listTools(server: string, workspace: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [server, '--workspace', workspace], { stdio: ['pipe', 'pipe', 'ignore'] });
    const timer = setTimeout(() => { child.kill(); reject(new Error('no tools/list reply')); }, TIMEOUT_MS);
    let buffer = '';
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const msg = JSON.parse(line);
        if (msg.id !== LIST_ID) continue;
        clearTimeout(timer);
        child.kill();
        resolve(msg.result.tools.map((t: { name: string }) => t.name));
      }
    });
    const send = (m: object): void => { child.stdin.write(`${JSON.stringify(m)}\n`); };
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'bundle-test', version: '0' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: LIST_ID, method: 'tools/list' });
  });
}

test('bundle runs outside the repo and lists the mmap tools', async () => {
  const isolated = mkdtempSync(join(tmpdir(), 'mmap-bundle-'));
  const server = join(isolated, 'index.mjs');
  copyFileSync(BUNDLE, server);
  const names = await listTools(server, mkdtempSync(join(tmpdir(), 'mmap-ws-')));
  assert.ok(names.includes('mmap_outline'));
  assert.ok(names.includes('mmap_add'));
});
