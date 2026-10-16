import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { workspace } from './fixtures.ts';

const SERVER_ENTRY = new URL('../src/index.ts', import.meta.url).pathname;
const FORBIDDEN_KEYS = ['oneOf', 'anyOf', 'allOf'];

interface ToolInfo { name: string; inputSchema: Record<string, unknown> }

function listTools(workspaceDir: string): Promise<ToolInfo[]> {
  const child = spawn('node', [SERVER_ENTRY, '--workspace', workspaceDir], { stdio: ['pipe', 'pipe', 'ignore'] });
  const send = (message: object): void => { child.stdin.write(`${JSON.stringify(message)}\n`); };
  return new Promise((resolve, reject) => {
    let buffer = '';
    child.on('error', reject);
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk;
      for (const line of buffer.split('\n').filter(Boolean)) {
        const message = JSON.parse(line);
        if (message.id === 1) {
          send({ jsonrpc: '2.0', method: 'notifications/initialized' });
          send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
        }
        if (message.id === 2) { child.kill(); resolve(message.result.tools); }
      }
    });
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  });
}

test('every tool schema is a plain object without top-level combinators', async () => {
  const { dir } = await workspace();
  const tools = await listTools(dir);
  assert.equal(tools.length, 9);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, 'object', tool.name);
    for (const key of FORBIDDEN_KEYS) assert.ok(!(key in tool.inputSchema), `${tool.name} has ${key}`);
  }
});
