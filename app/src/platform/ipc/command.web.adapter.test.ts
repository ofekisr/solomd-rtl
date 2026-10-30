import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { PlatformUnsupportedError, type CommandCatalog } from './command.port.ts';
import { createWebPort } from './command.web.adapter.ts';

const catalog = {
  read_file: { args: z.object({ path: z.string() }), result: z.string() },
  list_things: { result: z.array(z.string()) },
} satisfies CommandCatalog;

test('every command rejects PlatformUnsupportedError naming the command', async () => {
  const port = createWebPort(catalog);
  await assert.rejects(port.readFile({ path: '/a' }), (e: unknown) => e instanceof PlatformUnsupportedError && e.operation === 'read_file');
  await assert.rejects(port.listThings(), PlatformUnsupportedError);
});

test('overrides win', async () => {
  const port = createWebPort(catalog, { listThings: () => Promise.resolve(['web']) });
  assert.deepEqual(await port.listThings(), ['web']);
});
