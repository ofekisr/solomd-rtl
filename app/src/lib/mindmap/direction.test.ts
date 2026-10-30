import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutDirectionFor, MINDMAP_LAYOUT } from './direction.ts';
import { createEmptyMindmap } from './format.ts';

test('a stored direction always wins', () => {
  const data = { ...createEmptyMindmap('תוכנית'), direction: MINDMAP_LAYOUT.RIGHT };
  assert.equal(layoutDirectionFor(data), MINDMAP_LAYOUT.RIGHT);
});

test('maps without a stored direction grow rightward', () => {
  const hebrew = createEmptyMindmap('תוכנית עבודה');
  hebrew.nodeData.children = [{ id: 'a', topic: 'משימה ראשונה', children: [] }];
  assert.equal(layoutDirectionFor(hebrew), MINDMAP_LAYOUT.RIGHT);
  const latin = createEmptyMindmap('Project plan');
  latin.nodeData.children = [{ id: 'a', topic: 'one two three', children: [] }];
  assert.equal(layoutDirectionFor(latin), MINDMAP_LAYOUT.RIGHT);
});
