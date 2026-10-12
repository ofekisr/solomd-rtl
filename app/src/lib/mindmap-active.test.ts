import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearActiveMindmap, runActiveMindmapAction, setActiveMindmap, type MindmapHandle } from './mindmap-active.ts';

const handle = (log: string[], known: string): MindmapHandle => ({
  run: (id) => { if (id !== known) return false; log.push(id); return true; },
});

test('no active map runs nothing', () => {
  assert.equal(runActiveMindmapAction('mindmap.fit'), false);
});

test('last activated map receives the action', () => {
  const a: string[] = []; const b: string[] = [];
  const ha = handle(a, 'mindmap.fit'); const hb = handle(b, 'mindmap.fit');
  setActiveMindmap(ha); setActiveMindmap(hb);
  assert.equal(runActiveMindmapAction('mindmap.fit'), true);
  assert.deepEqual([a, b], [[], ['mindmap.fit']]);
  clearActiveMindmap(hb);
});

test('clearing a non-active handle keeps the active one', () => {
  const a: string[] = [];
  const ha = handle(a, 'mindmap.fit');
  setActiveMindmap(ha);
  clearActiveMindmap(handle([], 'x'));
  assert.equal(runActiveMindmapAction('mindmap.fit'), true);
  clearActiveMindmap(ha);
  assert.equal(runActiveMindmapAction('mindmap.fit'), false);
});

test('unknown action reports false', () => {
  const ha = handle([], 'mindmap.fit');
  setActiveMindmap(ha);
  assert.equal(runActiveMindmapAction('mindmap.nope'), false);
  clearActiveMindmap(ha);
});
