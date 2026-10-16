import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspace } from './fixtures.ts';
import { duplicates, find, node, outline } from '../src/tools/read.ts';

test('outline from root and from a path with depth', async () => {
  const { store } = await workspace();
  assert.match(await outline(store, { file: 'plan.mmap' }), /- Phase 2 \[\^a\] \{session\}/);
  assert.equal(await outline(store, { file: 'plan.mmap', node: 'Plan/Phase 2', depth: 0 }), '- Phase 2 [^a] {session} (+2)');
});

test('find by topic returns paths', async () => {
  const { store } = await workspace();
  const text = await find(store, { file: 'plan.mmap', query: 'design' });
  assert.equal(text, '[^a1] Plan/Phase 2/Design\n[^b] Plan/Design');
});

test('node summary and unknown refs', async () => {
  const { store } = await workspace();
  assert.equal((await node(store, { file: 'plan.mmap', node: 'a1' })).path, 'Plan/Phase 2/Design');
  await assert.rejects(node(store, { file: 'plan.mmap', node: 'zz' }), /No node with id "zz"/);
});

test('duplicates groups same-topic nodes', async () => {
  const { store } = await workspace();
  assert.match(await duplicates(store, { file: 'plan.mmap' }), /\[\^a1\].*\[\^b\]/);
});
