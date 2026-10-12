import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mmapCodec } from './mindmap-format.ts';
import { outlineLines, outlineMarkdownOf } from './mindmap-outline.ts';

const codec = mmapCodec('plan.mmap');
const DATA = { nodeData: { id: 'root', topic: 'Root', children: [{ id: 'a', topic: 'שלום' }, { id: 'b', topic: 'Child' }] } };

test('outlineMarkdownOf renders topics as headings', () => {
  const md = outlineMarkdownOf(codec.parse(codec.serialize(DATA)));
  assert.match(md, /^# Root/m);
  assert.match(md, /^## שלום/m);
  assert.match(md, /^## Child/m);
  assert.ok(md.indexOf('Root') < md.indexOf('Child'));
});

test('outlineMarkdownOf returns empty text for unparsable input', () => {
  assert.equal(outlineMarkdownOf(codec.parse('{ not json')), '');
});

test('outlineLines splits on newlines', () => {
  assert.deepEqual(outlineLines('# A\n\n## B'), ['# A', '', '## B']);
});

test('outlineMarkdownOf appends the snippets section after the map', () => {
  const text = codec.serialize(DATA, {}, [{ id: 's1', kind: 'md', title: 'Notes', body: 'hello' }]);
  const md = outlineMarkdownOf(codec.parse(text), 'rendered');
  assert.ok(md.indexOf('## Child') < md.indexOf('## Snippets'));
  assert.match(md, /^hello$/m);
});
