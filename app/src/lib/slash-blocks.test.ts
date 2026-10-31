import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLASH_BLOCKS, expandSnippet, filterBlocks } from './slash-blocks';

const CATALOG_SIZE = 21;
const REQUIRED_IDS = [
  'h1', 'h2', 'h3',
  'bullet', 'numbered', 'todo',
  'code', 'quote', 'divider', 'table',
  'math_block', 'math_inline', 'mermaid',
  'whiteboard',
  'link', 'image',
  'bold', 'italic', 'strikethrough', 'inline_code',
  'frontmatter',
];

test('catalog has every required block', () => {
  assert.equal(SLASH_BLOCKS.length, CATALOG_SIZE);
  const ids = new Set(SLASH_BLOCKS.map((b) => b.id));
  for (const id of REQUIRED_IDS) assert.ok(ids.has(id), `missing block id: ${id}`);
});

test('expandSnippet places the cursor marker', () => {
  assert.deepEqual(expandSnippet('# ${cursor}', ''), { text: '# ', cursorOffset: 2 });
  assert.deepEqual(expandSnippet('```\n${cursor}\n```', ''), { text: '```\n\n```', cursorOffset: 4 });
});

test('expandSnippet wraps the selection, cursor at end', () => {
  const r = expandSnippet('**${selection}**', 'hi');
  assert.equal(r.text, '**hi**');
  assert.equal(r.cursorOffset, r.text.length);
});

test('expandSnippet with empty selection puts the cursor inside the wrappers', () => {
  assert.deepEqual(expandSnippet('**${selection}**', ''), { text: '****', cursorOffset: 2 });
  assert.deepEqual(expandSnippet('`${selection}`', ''), { text: '``', cursorOffset: 1 });
});

test('table snippet starts the cursor in the first cell', () => {
  const table = SLASH_BLOCKS.find((b) => b.id === 'table');
  assert.ok(table);
  const r = expandSnippet(table.snippet, '');
  assert.ok(r.text.startsWith('| '));
  assert.ok(r.text.includes('\n| --- |'));
  assert.equal(r.cursorOffset, 2);
});

test('filterBlocks with empty query keeps catalog order', () => {
  const all = filterBlocks(SLASH_BLOCKS, '');
  assert.equal(all.length, SLASH_BLOCKS.length);
  assert.equal(all[0].id, SLASH_BLOCKS[0].id);
});

test('filterBlocks ranks the best match first', () => {
  assert.equal(filterBlocks(SLASH_BLOCKS, 'h1')[0].id, 'h1');
  assert.equal(filterBlocks(SLASH_BLOCKS, 'tab')[0].id, 'table');
  const code = filterBlocks(SLASH_BLOCKS, 'code');
  assert.equal(code[0].id, 'code');
  assert.ok(code.some((b) => b.id === 'inline_code'));
});

test('filterBlocks matches keywords', () => {
  const topIds = filterBlocks(SLASH_BLOCKS, 'list').slice(0, 3).map((b) => b.id);
  assert.ok(topIds.includes('bullet') || topIds.includes('numbered'));
});

test('filterBlocks returns nothing for gibberish', () => {
  assert.equal(filterBlocks(SLASH_BLOCKS, 'zxqwzxq').length, 0);
});
