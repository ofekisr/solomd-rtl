import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import type { CommandCatalog } from './command.port.ts';
import { createTauriPort } from './command.tauri.adapter.ts';
import { createValidation } from './validation.service.ts';

const catalog = {
  read_file: { args: z.object({ path: z.string() }), result: z.string() },
  list_things: { result: z.array(z.object({ name: z.string() })) },
} satisfies CommandCatalog;

type Call = { cmd: string; args: unknown; arity: number };

function fakeInvoke(result: unknown, calls: Call[]) {
  return (...params: [string, Record<string, unknown>?]): Promise<unknown> => {
    calls.push({ cmd: params[0], args: params[1], arity: params.length });
    return Promise.resolve(result);
  };
}

test('calls invoke with the snake command and args', async () => {
  const calls: Call[] = [];
  const port = createTauriPort(catalog, fakeInvoke('# hi', calls), createValidation('strict'));
  assert.equal(await port.readFile({ path: '/a.md' }), '# hi');
  assert.deepEqual(calls, [{ cmd: 'read_file', args: { path: '/a.md' }, arity: 2 }]);
});

test('no-arg commands call invoke with the command only', async () => {
  const calls: Call[] = [];
  const port = createTauriPort(catalog, fakeInvoke([], calls), createValidation('strict'));
  await port.listThings();
  assert.deepEqual(calls, [{ cmd: 'list_things', args: undefined, arity: 1 }]);
});

test('returns the raw result, not the parsed one', async () => {
  const raw = [{ name: 'a', extra: 1 }];
  const port = createTauriPort(catalog, fakeInvoke(raw, []), createValidation('strict'));
  assert.equal(await port.listThings(), raw);
});

test('passes invoke rejections through unchanged', async () => {
  const failure = 'No such file';
  const port = createTauriPort(catalog, () => Promise.reject(failure), createValidation('strict'));
  await assert.rejects(port.readFile({ path: '/x' }), (e: unknown) => e === failure);
});

test('report mode logs drift and still returns raw', async () => {
  const seen: string[] = [];
  const port = createTauriPort(catalog, fakeInvoke(42, []), createValidation('report', (m) => seen.push(m)));
  assert.equal(await port.readFile({ path: '/a' }), 42);
  assert.equal(seen.length, 1);
});

test('strict mode rejects on result drift', async () => {
  const port = createTauriPort(catalog, fakeInvoke(42, []), createValidation('strict'));
  await assert.rejects(port.readFile({ path: '/a' }), /\[platform:drift\] read_file result/);
});
