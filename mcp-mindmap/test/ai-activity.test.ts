import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, symlink, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { join } from 'node:path';
import { AiActivity, aiLockPath } from '../src/ai-activity.ts';
import { MapStore } from '../src/store.ts';
import { workspace } from './fixtures.ts';

const IDLE_MS = 40;
const exists = (p: string) => access(p).then(() => true, () => false);

test('aiLockPath is a hidden per-server sidecar next to the map', () => {
  assert.equal(aiLockPath('/w/plans/q4.mmap', 'mcp-7'), '/w/plans/.q4.mmap.ai-lock-mcp-7');
  assert.equal(aiLockPath('/w/plans/q4.mmap'), `/w/plans/.q4.mmap.ai-lock-mcp-${process.pid}`);
});

test('load and save mark the map busy, then release after idle', async () => {
  const { dir } = await workspace();
  const store = new MapStore({ workspace: dir, allowWrite: true }, new AiActivity(IDLE_MS));
  const lock = aiLockPath(join(dir, 'plan.mmap'));
  const doc = await store.load('plan.mmap');
  assert.equal(JSON.parse(await readFile(lock, 'utf8')).pid, process.pid);
  await store.save('plan.mmap', doc);
  await sleep(IDLE_MS * 3);
  assert.equal(await exists(lock), false);
});

test('peek reads without marking the map busy', async () => {
  const { dir } = await workspace();
  const store = new MapStore({ workspace: dir, allowWrite: true }, new AiActivity(IDLE_MS));
  await store.peek('plan.mmap');
  assert.equal(await exists(aiLockPath(join(dir, 'plan.mmap'))), false);
});

test('a symlink planted at the lock path is replaced, never written through', async () => {
  const { dir } = await workspace();
  const victim = join(dir, 'victim.txt');
  await writeFile(victim, 'keep');
  const lock = aiLockPath(join(dir, 'plan.mmap'));
  await symlink(victim, lock);
  await new AiActivity(IDLE_MS).touch(join(dir, 'plan.mmap'));
  assert.equal(await readFile(victim, 'utf8'), 'keep');
  assert.equal(JSON.parse(await readFile(lock, 'utf8')).pid, process.pid);
});

test('a read-only server never writes a lock', async () => {
  const { dir } = await workspace(false);
  await new MapStore({ workspace: dir, allowWrite: false }).load('plan.mmap');
  assert.equal(await exists(aiLockPath(join(dir, 'plan.mmap'))), false);
});

test('SIGTERM removes the lock before the server exits', async () => {
  const { spawn } = await import('node:child_process');
  const { dir } = await workspace();
  const map = join(dir, 'plan.mmap');
  const child = spawn(process.execPath, ['-e', `
    const { AiActivity } = await import(${JSON.stringify(new URL('../src/ai-activity.ts', import.meta.url).href)});
    await new AiActivity(60_000).touch(${JSON.stringify(map)});
    console.log('ready');
    setInterval(() => {}, 1000);
  `, '--input-type=module'], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise<void>((resolve) => child.stdout.once('data', () => resolve()));
  const lock = join(dir, `.plan.mmap.ai-lock-mcp-${child.pid}`);
  assert.equal(await exists(lock), true);
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
  assert.equal(await exists(lock), false);
});
