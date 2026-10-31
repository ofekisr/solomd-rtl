import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspace } from './fixtures.ts';
import { legend, mark } from '../src/tools/meaning.ts';
import { outline } from '../src/tools/read.ts';

test('set legend, mark, read back by meaning only', async () => {
  const { store } = await workspace();
  assert.equal(await legend(store, { file: 'plan.mmap' }), '(no legend yet)');
  await legend(store, { file: 'plan.mmap', set: [{ meaning: 'blocked', background: '#fde2e2' }] });
  assert.equal(await legend(store, { file: 'plan.mmap' }), 'blocked');
  await mark(store, { file: 'plan.mmap', node: 'a1', meaning: 'blocked' });
  const text = await outline(store, { file: 'plan.mmap' });
  assert.match(text, /Design \[\^a1\] \{mark: blocked\}/);
  assert.doesNotMatch(text, /#fde2e2/);
});
