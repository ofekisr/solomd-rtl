import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workspace } from './fixtures.ts';
import { parseArgs } from '../src/config.ts';

test('parseArgs reads workspace and allow-write, defaulting to cwd', () => {
  assert.deepEqual(parseArgs(['--workspace', '/w', '--allow-write']), { workspace: '/w', allowWrite: true });
  assert.deepEqual(parseArgs(['--allow-write'], '/proj'), { workspace: '/proj', allowWrite: true });
  assert.throws(() => parseArgs(['--workspace']), /--workspace/);
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

test('load rejects a symlink escaping the workspace', async () => {
  const { dir, store } = await workspace();
  const outsideDir = await mkdtemp(join(tmpdir(), 'mmap-out-'));
  await writeFile(join(outsideDir, 'secret.mmap'), '{}');
  await symlink(join(outsideDir, 'secret.mmap'), join(dir, 'evil.mmap'));
  await assert.rejects(store.load('evil.mmap'), /inside the workspace/);
});

test('save rejects a new file under a symlinked directory outside', async () => {
  const { dir, store } = await workspace();
  const outsideDir = await mkdtemp(join(tmpdir(), 'mmap-out-'));
  await symlink(outsideDir, join(dir, 'link'));
  const doc = await store.load('plan.mmap');
  await assert.rejects(store.save('link/new.mmap', doc), /inside the workspace/);
});

test('names starting with two dots are inside the workspace', async () => {
  const { dir, store } = await workspace();
  assert.equal(store.resolve('..notes.mmap'), join(dir, '..notes.mmap'));
});

test('load of a missing map says Map not found', async () => {
  const { store } = await workspace();
  await assert.rejects(store.load('nope.mmap'), /^Error: Map not found: nope\.mmap$/);
});

test('save leaves no temp files behind', async () => {
  const { dir, store } = await workspace();
  await store.save('plan.mmap', await store.load('plan.mmap'));
  assert.deepEqual(await readdir(dir), ['plan.mmap']);
});

test('save refreshes gate labels so renamed targets never leave stale gates on disk', async () => {
  const { dir, store } = await workspace();
  const doc = await store.load('plan.mmap');
  const target = doc.data.nodeData.children![0];
  doc.data.nodeData.children!.push(
    { id: 'g1', topic: '⇒ old name', metadata: { gate: { target: target.id } } },
    { id: 'g2', topic: '⇒ old name', metadata: { gate: { target: 'gone' } } },
  );
  target.topic = 'New name';
  await store.save('plan.mmap', doc);
  const text = await readFile(join(dir, 'plan.mmap'), 'utf8');
  assert.match(text, /"⇒ New name"/);
  assert.match(text, /"⇒ ⚠ missing target"/);
  assert.doesNotMatch(text, /old name/);
});
