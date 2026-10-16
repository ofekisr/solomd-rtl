import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspace } from './fixtures.ts';
import { add, edit, gate, move, remove } from '../src/tools/write.ts';
import { outline } from '../src/tools/read.ts';

const F = 'plan.mmap';

test('add inserts a plaintext subtree under a path', async () => {
  const { store } = await workspace();
  const res = await add(store, { file: F, parent: 'Plan/Phase 2/Tasks', outline: '- Write API\n  - Endpoints\n- Review' });
  assert.match(res, /Added 2 node/);
  assert.match(await outline(store, { file: F, node: 'a2' }), /- Write API \[\^\w+\]\n {4}- Endpoints/);
});

test('edit changes topic, note, fields and tags', async () => {
  const { store } = await workspace();
  await edit(store, { file: F, node: 'b', topic: 'Design v2', note: 'why', tags: ['ux'], fields: [{ key: 'owner', value: 'ofek' }] });
  assert.match(await outline(store, { file: F }), /- Design v2 \[\^b\] #ux/);
});

test('move and remove report gate damage', async () => {
  const { store } = await workspace();
  await move(store, { file: F, node: 'b', parent: 'a' });
  assert.match(await outline(store, { file: F, node: 'a' }), /- Design \[\^b\]/);
  await gate(store, { file: F, action: 'link', parent: 'Plan', target: 'a1' });
  assert.match(await remove(store, { file: F, node: 'a' }), /1 gate now broken/);
});

test('gate merge turns a duplicate into a gate', async () => {
  const { store } = await workspace();
  await gate(store, { file: F, action: 'merge', keep: 'a1', duplicate: 'b' });
  assert.match(await outline(store, { file: F }), /\[\^b\] → \[\^a1\]/);
});

test('writes refused without --allow-write', async () => {
  const { store } = await workspace(false);
  await assert.rejects(edit(store, { file: F, node: 'b', topic: 'x' }), /--allow-write/);
});

test('gate names the missing argument per action', async () => {
  const { store } = await workspace();
  await assert.rejects(gate(store, { file: F, action: 'link', parent: 'Plan' }), /action "link" needs "parent" and "target"/);
  await assert.rejects(gate(store, { file: F, action: 'unlink' }), /action "unlink" needs "gate"/);
  await assert.rejects(gate(store, { file: F, action: 'merge', keep: 'a1' }), /action "merge" needs "keep" and "duplicate"/);
});

test('gate unlink removes a gate but refuses regular nodes', async () => {
  const { store } = await workspace();
  await assert.rejects(gate(store, { file: F, action: 'unlink', gate: 'b' }), /"Design" is not a gate; use mmap_remove/);
  await gate(store, { file: F, action: 'merge', keep: 'a1', duplicate: 'b' });
  assert.match(await gate(store, { file: F, action: 'unlink', gate: 'b' }), /Removed \[\^b\]/);
});
