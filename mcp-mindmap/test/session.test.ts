import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SID, workspace } from './fixtures.ts';
import { bindSession, sessionNodes } from '../src/tools/session.ts';

const OTHER = '9b2c1e4a-1111-4222-8333-944455556666';

test('sessionNodes finds the bound node across the workspace', async () => {
  const { store } = await workspace();
  assert.equal(await sessionNodes(store, { session: SID }), 'plan.mmap  [^a] Plan/Phase 2');
});

test('bind replaces an existing binding and keeps other fields', async () => {
  const { store } = await workspace();
  await bindSession(store, { file: 'plan.mmap', node: 'a1', session: OTHER });
  assert.equal(await sessionNodes(store, { session: OTHER, file: 'plan.mmap' }), 'plan.mmap  [^a1] Plan/Phase 2/Design');
  await bindSession(store, { file: 'plan.mmap', node: 'a', session: null });
  assert.equal(await sessionNodes(store, { session: SID }), '(no node bound to this session)');
});

test('bind rejects non-uuid sessions', async () => {
  const { store } = await workspace();
  await assert.rejects(bindSession(store, { file: 'plan.mmap', node: 'a1', session: 'abc' }), /session id/);
});
