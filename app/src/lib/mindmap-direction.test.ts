import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutDirectionFor, MINDMAP_LAYOUT } from './mindmap-direction.ts';
import { createEmptyMindmap } from './mindmap-format.ts';

test('a stored direction always wins', () => {
  const data = { ...createEmptyMindmap('תוכנית'), direction: MINDMAP_LAYOUT.RIGHT };
  assert.equal(layoutDirectionFor(data), MINDMAP_LAYOUT.RIGHT);
});

test('hebrew-dominant maps without a stored direction grow leftward', () => {
  const data = createEmptyMindmap('תוכנית עבודה');
  data.nodeData.children = [{ id: 'a', topic: 'משימה ראשונה API', children: [] }];
  assert.equal(layoutDirectionFor(data), MINDMAP_LAYOUT.LEFT);
});

test('latin-dominant maps default to both sides', () => {
  const data = createEmptyMindmap('Project plan');
  data.nodeData.children = [{ id: 'a', topic: 'שלב one two three', children: [] }];
  assert.equal(layoutDirectionFor(data), MINDMAP_LAYOUT.SIDE);
});
