import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeContext } from '../editor/contracts/testkit.ts';
import type { EditorFeature } from '../editor/contracts/index.ts';
import type { AiRewritePort } from './contracts/ai-rewrite.port.ts';

const calls: string[] = [];
const locked = new Set<string>();
const port: AiRewritePort = {
  extension: (key) => { calls.push(key); return []; },
  isLocked: (path) => path !== undefined && locked.has(path),
};

import { createAiRewriteFeature } from './contracts/ai-rewrite.feature.ts';

const feature: EditorFeature = createAiRewriteFeature(port);
const slotOf = (name: string) => feature.slots?.find((s) => s.slot === name);

test('manifest: id and no i18n keys', () => {
  assert.equal(feature.id, 'ai-rewrite');
  assert.deepEqual(feature.i18nKeys, []);
});

test('ai-lock: deps returns the port value; build locks when the port says so', () => {
  const slot = slotOf('ai-lock');
  assert.ok(slot);
  locked.add('/a.md');
  const lockedCtx = fakeContext({ tabValue: { filePath: '/a.md' } });
  const freeCtx = fakeContext({ tabValue: { filePath: '/b.md' } });
  assert.equal(slot.deps(lockedCtx), true);
  assert.equal(slot.deps(freeCtx), false);
  assert.ok(Array.isArray(slot.build(lockedCtx)) && (slot.build(lockedCtx) as unknown[]).length === 2);
  assert.deepEqual(slot.build(freeCtx), []);
});

test('ai-key: build passes the computed chord to the port', () => {
  const slot = slotOf('ai-key');
  assert.ok(slot);
  slot.build(fakeContext({ settings: { keybindings: {} } }));
  slot.build(fakeContext({ settings: { keybindings: { 'editor.aiRewrite': null } } }));
  assert.deepEqual(calls, ['Mod-j', 'F24']);
  assert.equal(slot.deps(fakeContext({ settings: { keybindings: {} } })), 'Mod-j');
});

test('ai-key: when is false for non-markdown', () => {
  const slot = slotOf('ai-key');
  assert.ok(slot);
  assert.equal(slot.when?.(fakeContext({ tabValue: { language: 'ts' } })), false);
});
