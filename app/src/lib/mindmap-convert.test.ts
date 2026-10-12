import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { markdownToMindmap, sectionRange, sliceLines } from './mindmap-convert.ts';

const shape = (n: NodeObj): unknown => [n.topic, ...(n.children ?? []).map(shape)];
const opts = { rootTopic: 'doc', path: 'notes/a.md' };

test('a sole H1 is lifted to root with its source', () => {
  const data = markdownToMindmap('# Book\n## A\n- x\n  - y\n## B', opts);
  assert.deepEqual(shape(data.nodeData), ['Book', ['A', ['x', ['y']]], ['B']]);
  assert.equal(data.nodeData.id, 'root');
  assert.deepEqual(data.nodeData.metadata, { source: { line: 1, path: 'notes/a.md' } });
});

test('two H1s keep the file-stem root', () => {
  const data = markdownToMindmap('# A\n# B', opts);
  assert.deepEqual(shape(data.nodeData), ['doc', ['A'], ['B']]);
});

test('skipped heading levels attach to the nearest lower heading', () => {
  const data = markdownToMindmap('# A\n### C\n## B', { rootTopic: 'd' });
  assert.deepEqual(shape(data.nodeData), ['A', ['C'], ['B']]);
});

test('paragraphs go to notes; continuation text to the item', () => {
  const data = markdownToMindmap('# A\nline one\nline two\n\nsecond\n- item\n  more\n\nafter', { rootTopic: 'd' });
  const [item] = data.nodeData.children ?? [];
  assert.equal(data.nodeData.note, 'line one line two\n\nsecond\n\nafter');
  assert.equal(item.note, 'more');
});

test('ids match [\\w-]+ and lines are stamped, path omitted when absent', () => {
  const data = markdownToMindmap('- a\n- b', { rootTopic: 'd', firstLine: 5 });
  const [a, b] = data.nodeData.children ?? [];
  assert.deepEqual([a.id, b.id], ['n1', 'n2']);
  assert.deepEqual(b.metadata, { source: { line: 6 } });
});

test('sectionRange ends before the next same-or-higher heading and ignores fences', () => {
  const src = '# A\n## B\ntext\n```\n# no\n```\n### C\n## D';
  assert.deepEqual(sectionRange(src, 3), { fromLine: 2, toLine: 7 });
  assert.equal(sectionRange('intro\n# A', 1), null);
  assert.equal(sliceLines(src, { fromLine: 2, toLine: 3 }), '## B\ntext');
});
