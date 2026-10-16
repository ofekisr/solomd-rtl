import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { workspace } from './fixtures.ts';
import { parseArgs } from '../src/config.ts';

test('parseArgs reads workspace and allow-write', () => {
  assert.deepEqual(parseArgs(['--workspace', '/w', '--allow-write']), { workspace: '/w', allowWrite: true });
  assert.throws(() => parseArgs([]), /--workspace/);
});

test('resolve refuses escapes and non-mmap files', async () => {
  const { store } = await workspace();
  assert.throws(() => store.resolve('../x.mmap'), /inside the workspace/);
  assert.throws(() => store.resolve('notes.md'), /\.mmap/);
});

test('load/save round-trips and save needs allow-write', async () => {
  const { dir, store } = await workspace();
  const doc = await store.load('plan.mmap');
  doc.data.nodeData.topic = 'Plan 2';
  await store.save('plan.mmap', doc);
  assert.match(await readFile(join(dir, 'plan.mmap'), 'utf8'), /"Plan 2"/);
  const ro = (await workspace(false)).store;
  assert.throws(() => ro.assertWritable(), /--allow-write/);
});
