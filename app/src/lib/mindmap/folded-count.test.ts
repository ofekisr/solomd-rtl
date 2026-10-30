import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { foldedCountLabels } from './folded-count.ts';

const leaf = (id: string): NodeObj => ({ id, topic: id });
const folded = (children: NodeObj[]): NodeObj => ({ id: 'p', topic: 'p', expanded: false, children });

test('a folded node gets direct, all-descendant and combined labels', () => {
  const node = folded([{ id: 'a', topic: 'a', children: [leaf('a1'), leaf('a2')] }, leaf('b')]);
  assert.deepEqual(foldedCountLabels(node), { direct: '2', all: '4', both: '2 · 4' });
});

test('combined label collapses to one number when nothing is nested', () => {
  assert.deepEqual(foldedCountLabels(folded([leaf('a'), leaf('b')])), { direct: '2', all: '2', both: '2' });
});

test('expanded or childless nodes have no labels', () => {
  assert.equal(foldedCountLabels({ id: 'p', topic: 'p', expanded: true, children: [leaf('a')] }), null);
  assert.equal(foldedCountLabels({ id: 'p', topic: 'p', children: [leaf('a')] }), null);
  assert.equal(foldedCountLabels(folded([])), null);
});

test('huge counts are capped', () => {
  const labels = foldedCountLabels(folded(Array.from({ length: 1200 }, (_, i) => leaf(String(i)))));
  assert.deepEqual(labels, { direct: '999+', all: '999+', both: '999+' });
});
