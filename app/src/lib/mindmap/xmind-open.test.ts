import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planXmindOpen } from './xmind-open.ts';

const XMIND = '/notes/plan.xmind';
const MMAP = '/notes/plan.mmap';

test('activates the tab that imported this xmind', () => {
  const plan = planXmindOpen(XMIND, [{ id: 'a', importedFrom: XMIND }], true);
  assert.deepEqual(plan, { kind: 'activate', tabId: 'a' });
});

test('activates an open tab of the sibling mmap', () => {
  const plan = planXmindOpen(XMIND, [{ id: 'b', filePath: MMAP }], true);
  assert.deepEqual(plan, { kind: 'activate', tabId: 'b' });
});

test('opens the sibling mmap from disk when no tab has it', () => {
  assert.deepEqual(planXmindOpen(XMIND, [], true), { kind: 'open-mmap', path: MMAP });
});

test('imports when nothing exists', () => {
  assert.deepEqual(planXmindOpen(XMIND, [{ id: 'c', filePath: '/notes/other.mmap' }], false), { kind: 'import' });
});

test('importedFrom wins over a filePath match', () => {
  const tabs = [{ id: 'b', filePath: MMAP }, { id: 'a', importedFrom: XMIND }];
  assert.deepEqual(planXmindOpen(XMIND, tabs, true), { kind: 'activate', tabId: 'a' });
});
