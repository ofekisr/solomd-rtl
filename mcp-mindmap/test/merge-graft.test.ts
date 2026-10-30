import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspace } from './fixtures.ts';
import { merge, graft } from '../src/tools/file.ts';
import { createEmptyMindmap } from '../../app/src/lib/mindmap/format.ts';
import type { MapStore } from '../src/store.ts';

async function withFixtures(): Promise<MapStore> {
  const { store } = await workspace();
  for (const [file, topic] of [['a.mmap', 'A'], ['b.mmap', 'B']]) {
    await store.save(file, { data: createEmptyMindmap(topic), display: {}, snippets: [] });
  }
  return store;
}

test('mmap_merge writes a new map with one child per source and refuses overwrite', async () => {
  const store = await withFixtures();
  await merge(store, { files: ['a.mmap', 'b.mmap'], out: 'ab.mmap', root: 'AB' });
  const doc = await store.load('ab.mmap');
  assert.equal(doc.data.nodeData.topic, 'AB');
  assert.equal(doc.data.nodeData.children?.length, 2);
  await assert.rejects(merge(store, { files: ['a.mmap', 'b.mmap'], out: 'ab.mmap' }), /already exists/);
});

test('mmap_merge needs two files and defaults the root topic', async () => {
  const store = await withFixtures();
  await assert.rejects(merge(store, { files: ['a.mmap'], out: 'x.mmap' }), /at least 2/);
  await merge(store, { files: ['a.mmap', 'b.mmap'], out: 'ab.mmap' });
  assert.equal((await store.load('ab.mmap')).data.nodeData.topic, 'A + B');
});

test('mmap_graft inserts source under node (default root)', async () => {
  const store = await withFixtures();
  await graft(store, { file: 'a.mmap', source: 'b.mmap' });
  const doc = await store.load('a.mmap');
  assert.equal(doc.data.nodeData.children?.at(-1)?.topic, 'B');
});

test('mmap_graft resolves a topic path as the target node', async () => {
  const store = await withFixtures();
  await graft(store, { file: 'plan.mmap', source: 'b.mmap', node: 'Plan/Phase 2' });
  const phase = (await store.load('plan.mmap')).data.nodeData.children?.find((c) => c.topic === 'Phase 2');
  assert.equal(phase?.children?.at(-1)?.topic, 'B');
});

test('mmap_merge refuses a read-only store', async () => {
  const { store } = await workspace(false);
  await assert.rejects(merge(store, { files: ['plan.mmap', 'plan.mmap'], out: 'x.mmap' }), /--allow-write/);
});
