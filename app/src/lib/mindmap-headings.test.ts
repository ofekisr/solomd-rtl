import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { mapToHeadingsMarkdown } from './mindmap-headings.ts';

const chain = (depth: number): NodeObj => {
  let node: NodeObj = { id: `n${depth}`, topic: `L${depth}` };
  for (let d = depth - 1; d >= 0; d -= 1) node = { id: `n${d}`, topic: `L${d}`, children: [node] };
  return node;
};

test('root and children become headings', () => {
  const data: MindElixirData = { nodeData: { id: 'r', topic: 'Plan', children: [{ id: 'a', topic: 'Goals', children: [{ id: 'b', topic: 'Ship' }] }, { id: 'c', topic: 'Risks' }] } };
  assert.equal(mapToHeadingsMarkdown(data), '# Plan\n\n## Goals\n\n### Ship\n\n## Risks\n');
});

test('levels past six become nested bullets', () => {
  const md = mapToHeadingsMarkdown({ nodeData: chain(7) });
  assert.ok(md.includes('###### L5\n\n- L6\n  - L7\n'));
});

test('multi-line topics are flattened', () => {
  assert.equal(mapToHeadingsMarkdown({ nodeData: { id: 'r', topic: 'a\nb' } }), '# a b\n');
});

test('hebrew topics pass through untouched', () => {
  assert.equal(mapToHeadingsMarkdown({ nodeData: { id: 'r', topic: 'תוכנית' } }), '# תוכנית\n');
});
