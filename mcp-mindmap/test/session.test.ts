import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SID, workspace } from './fixtures.ts';
import { bindSession, sessionNodes } from '../src/tools/session.ts';
import { edit } from '../src/tools/write.ts';
import { node } from '../src/tools/read.ts';

const OTHER = '9b2c1e4a-1111-4222-8333-944455556666';

test('sessionNodes finds the bound node across the workspace', async () => {
  const { store } = await workspace();
  assert.equal(await sessionNodes(store, { session: SID }), 'plan.mmap  [^a] Plan/Phase 2');
});

test('bind replaces an existing binding and keeps other fields', async () => {
  const { store } = await workspace();
  await edit(store, { file: 'plan.mmap', node: 'a1', fields: [{ key: 'owner', value: 'ofek' }] });
  await bindSession(store, { file: 'plan.mmap', node: 'a1', session: OTHER });
  assert.equal(await sessionNodes(store, { session: OTHER, file: 'plan.mmap' }), 'plan.mmap  [^a1] Plan/Phase 2/Design');
  const bound = await node(store, { file: 'plan.mmap', node: 'a1' });
  assert.deepEqual(bound.fields, [{ key: 'owner', value: 'ofek' }, { key: 'claude-session', value: OTHER }]);
  await bindSession(store, { file: 'plan.mmap', node: 'a1', session: null });
  assert.equal(await sessionNodes(store, { session: OTHER }), '(no node bound to this session)');
  assert.deepEqual((await node(store, { file: 'plan.mmap', node: 'a1' })).fields, [{ key: 'owner', value: 'ofek' }]);
  await bindSession(store, { file: 'plan.mmap', node: 'a', session: null });
  assert.equal(await sessionNodes(store, { session: SID }), '(no node bound to this session)');
});

test('explicit missing file rejects', async () => {
  const { store } = await workspace();
  await assert.rejects(sessionNodes(store, { session: SID, file: 'missing.mmap' }), /Map not found/);
});

test('workspace scan skips unreadable maps and reports them', async () => {
  const { dir, store } = await workspace();
  await writeFile(join(dir, 'bad.mmap'), 'not json');
  assert.equal(await sessionNodes(store, { session: SID }), 'plan.mmap  [^a] Plan/Phase 2\nskipped unreadable: bad.mmap');
});

test('bind rejects non-uuid sessions', async () => {
  const { store } = await workspace();
  await assert.rejects(bindSession(store, { file: 'plan.mmap', node: 'a1', session: 'abc' }), /session id/);
});
