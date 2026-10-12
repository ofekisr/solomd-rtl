import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanMarkdown, plainInline, linesOutsideFences } from './mindmap-md-scan.ts';

const kinds = (src: string) => scanMarkdown(src).map((b) => b.kind);

test('headings carry level, stripped text and line', () => {
  assert.deepEqual(scanMarkdown('# One {#id .unlisted}\n\n## Two ##'), [
    { kind: 'heading', level: 1, text: 'One', line: 1 },
    { kind: 'blank', line: 2 },
    { kind: 'heading', level: 2, text: 'Two', line: 3 },
  ]);
});

test('backtick and tilde fences hide their content', () => {
  assert.deepEqual(kinds('```js\n# no\n```\n~~~~\n- no\n~~~\n~~~~\n# yes'), ['heading']);
});

test('a shorter closing marker does not close the fence', () => {
  assert.deepEqual(kinds('````\n```\n# no\n````\n# yes'), ['heading']);
});

test('front matter, comments, directives, fenced divs, tables, rules are skipped', () => {
  const src = '---\ntitle: x\n---\n<!-- epub: skip=true -->\n<!--\n# no\n-->\n::: letter\n| a | b |\n---\n# yes\n:::';
  assert.deepEqual(kinds(src), ['heading']);
});

test('list items keep indent, numbering styles and task boxes', () => {
  assert.deepEqual(scanMarkdown('- a\n  1. b\n\t+ [x] c\n- [ ] d\n- '), [
    { kind: 'item', indent: 0, text: 'a', line: 1 },
    { kind: 'item', indent: 2, text: 'b', line: 2 },
    { kind: 'item', indent: 4, text: '☑ c', line: 3 },
    { kind: 'item', indent: 0, text: '☐ d', line: 4 },
  ]);
});

test('quotes, line blocks and subheadings become text', () => {
  assert.deepEqual(scanMarkdown('> | שורה\n[Sub]{.subheading}'), [
    { kind: 'text', indent: 0, text: 'שורה', line: 1 },
    { kind: 'text', indent: 0, text: 'Sub', line: 2 },
  ]);
});

test('firstLine offsets line numbers', () => {
  assert.deepEqual(scanMarkdown('# A', 10), [{ kind: 'heading', level: 1, text: 'A', line: 10 }]);
});

test('plainInline strips links, images, emphasis and code', () => {
  assert.equal(plainInline('**b** [l](u) ![i](p) `c` ~~s~~ __u__'), 'b l i c s u');
});

test('empty headings are dropped and attributes are stripped before closing hashes', () => {
  assert.deepEqual(kinds('# {#id}\n## Title ## {#id}'), ['heading']);
  assert.equal((scanMarkdown('## Title ## {#id}')[0] as { text: string }).text, 'Title');
});

test('linesOutsideFences drops fenced lines and keeps numbering', () => {
  assert.deepEqual(linesOutsideFences('a\n```\nb\n```\nc\n~~~~\nd\n~~~\ne\n~~~~\nf'), [
    { text: 'a', line: 1 }, { text: 'c', line: 5 }, { text: 'f', line: 11 },
  ]);
});

test('front matter is skipped only at document start', () => {
  const items = (src: string, first: number) => scanMarkdown(src, first).map((b) => (b.kind === 'item' ? b.text : b.kind));
  assert.deepEqual(items('---\n- a\n- b\n---\n- c', 5), ['a', 'b', 'c']);
  assert.deepEqual(items('---\ntitle: x\n---\n- c', 1), ['c']);
});

test('indented fences under list items are skipped', () => {
  const texts = scanMarkdown('- a\n    ```\n    # no\n    ```\n- b').map((b) => (b.kind === 'item' ? b.text : b.kind));
  assert.deepEqual(texts, ['a', 'b']);
});

test('footnote refs and grammar-like leads are neutralised', () => {
  const texts = scanMarkdown('- > quote\n- }:1 x\n- Results [^1]\n- => done\n- a [^1] b').map((b) => (b.kind === 'item' ? b.text : b.kind));
  assert.deepEqual(texts, ['quote', 'x', 'Results', 'done', 'a b']);
  assert.equal(plainInline('see [^n] here'), 'see here');
});
