import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitPlainMarkdownBlocks, mapRenderedPrefixToSource, plainTocFingerprint } from './plain-blocks.ts';

const sliceAll = (src: string) => splitPlainMarkdownBlocks(src).map((b) => src.slice(b.start, b.end)).join('');

test('empty source is one empty block', () => {
  assert.deepEqual(splitPlainMarkdownBlocks(''), [{ start: 0, end: 0, text: '', hasTrailingNewline: false }]);
});
test('blocks cover the source exactly, in order', () => {
  const src = '# Title\n\npara one\nline two\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\n- a\n- b\n';
  const blocks = splitPlainMarkdownBlocks(src);
  assert.equal(sliceAll(src), src);
  assert.ok(blocks.some((b) => b.text.startsWith('```js') && b.text.includes('const b = 2;')), 'fence with a blank line stays one block');
});
test('trailing newline is dropped from text but kept in range', () => {
  const [b] = splitPlainMarkdownBlocks('# H\n');
  assert.equal(b.text, '# H');
  assert.equal(b.hasTrailingNewline, true);
  assert.equal(b.end - b.start, 4);
});
test('document ending in newline gets a zero-width final block', () => {
  const blocks = splitPlainMarkdownBlocks('a\n');
  assert.deepEqual(blocks.at(-1), { start: 2, end: 2, text: '', hasTrailingNewline: false });
});
test('math fence stays one block', () => {
  const src = '$$\n\\begin{aligned}\n    a &= b\n\\end{aligned}\n$$\n';
  const blocks = splitPlainMarkdownBlocks(src);
  assert.equal(blocks[0].text, src.slice(0, -1));
  assert.equal(sliceAll(src), src);
});
test('table rows group into one block', () => {
  const src = '| a | b |\n|---|---|\n| 1 | 2 |\n';
  assert.equal(splitPlainMarkdownBlocks(src)[0].text, src.slice(0, -1));
});
test('rendered prefix maps back past markdown markers', () => {
  assert.equal(mapRenderedPrefixToSource('**bold** text', 'bold t'), '**bold** t'.length);
});
test('plain prose maps exactly', () => {
  assert.equal(mapRenderedPrefixToSource('hello world', 'hello'), 5);
});
test('fingerprint is stable and differs on change', () => {
  assert.equal(plainTocFingerprint('# a'), plainTocFingerprint('# a'));
  assert.notEqual(plainTocFingerprint('# a'), plainTocFingerprint('# b'));
  assert.ok(plainTocFingerprint('# a').startsWith('3:'));
});
