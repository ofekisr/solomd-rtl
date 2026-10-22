import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasAnyNote } from './mindmap-view-defaults.ts';
import { createEmptyMindmap } from './mindmap-format.ts';

test('a map without notes has none', () => {
  const data = createEmptyMindmap('Plan');
  data.nodeData.children = [{ id: 'a', topic: 'A', children: [] }];
  assert.equal(hasAnyNote(data.nodeData), false);
});

test('a blank note does not count', () => {
  const data = createEmptyMindmap('Plan');
  data.nodeData.children = [{ id: 'a', topic: 'A', note: '  ', children: [] }];
  assert.equal(hasAnyNote(data.nodeData), false);
});

test('a note on a deep node is found', () => {
  const data = createEmptyMindmap('Plan');
  data.nodeData.children = [{ id: 'a', topic: 'A', children: [{ id: 'b', topic: 'B', note: 'why' }] }];
  assert.equal(hasAnyNote(data.nodeData), true);
});
