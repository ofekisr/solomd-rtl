import test from 'node:test';
import assert from 'node:assert/strict';
import { readClipboard, writeClipboard } from './clipboard.ts';
import { stubNavigator } from './stubs.testkit.ts';

test('writeClipboard falls back to navigator.clipboard when the port rejects', async () => {
  const written: string[] = [];
  const restore = stubNavigator({ clipboard: { writeText: async (t: string) => { written.push(t); } } });
  try {
    await writeClipboard('hi');
    assert.deepEqual(written, ['hi']);
  } finally { restore(); }
});

test('writeClipboard tolerates a missing navigator.clipboard', async () => {
  const restore = stubNavigator({});
  try {
    await writeClipboard('hi');
  } finally { restore(); }
});

test('readClipboard falls back to navigator.clipboard', async () => {
  const restore = stubNavigator({ clipboard: { readText: async () => 'pasted' } });
  try {
    assert.equal(await readClipboard(), 'pasted');
  } finally { restore(); }
});

test('readClipboard returns empty string when both paths fail', async () => {
  const restore = stubNavigator({ clipboard: { readText: async () => { throw new Error('denied'); } } });
  try {
    assert.equal(await readClipboard(), '');
  } finally { restore(); }
  const restoreNone = stubNavigator({});
  try {
    assert.equal(await readClipboard(), '');
  } finally { restoreNone(); }
});
