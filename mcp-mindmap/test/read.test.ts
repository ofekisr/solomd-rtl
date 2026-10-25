import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspace } from './fixtures.ts';
import { legendEntryArg } from '../src/server.ts';
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

test('find by tag matches object tags', async () => {
  const { store } = await workspace();
  const doc = await store.load('plan.mmap');
  doc.data.nodeData.children![1].tags = [{ text: 'ux' }];
  await store.save('plan.mmap', doc);
  assert.equal(await find(store, { file: 'plan.mmap', query: 'ux', by: 'tag' }), '[^b] Plan/Design');
});

test('legend schema rejects unsafe colours', () => {
  assert.ok(legendEntryArg.safeParse({ meaning: 'risk', color: '#fde2e2' }).success);
  const bad = legendEntryArg.safeParse({ meaning: 'risk', background: 'url(javascript:x)' });
  assert.ok(!bad.success);
  assert.match(bad.error.issues[0].message, /CSS colour/);
});

test('reads never expose styling: node summary, outline and exports stay style-free', async () => {
  const { store } = await workspace();
  const doc = await store.load('plan.mmap');
  const styled = doc.data.nodeData.children![1];
  styled.style = { color: 'rgb(1, 2, 3)', background: 'rgb(4, 5, 6)', border: '2px solid rgb(7, 8, 9)' };
  styled.branchColor = '#abcdef';
  styled.icons = ['⭐'];
  await store.save('plan.mmap', doc);
  const summary = JSON.stringify(await node(store, { file: 'plan.mmap', node: 'b' }));
  const texts = [summary, await outline(store, { file: 'plan.mmap' }), await find(store, { file: 'plan.mmap', query: 'design' })];
  for (const text of texts) assert.doesNotMatch(text, /rgb\(|#abcdef|style|branchColor|⭐/);
});
