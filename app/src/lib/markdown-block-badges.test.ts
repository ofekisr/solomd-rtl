import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFullMdFile } from './markdown-block-badges.ts';
import { renderMarkdown } from './markdown.ts';

function numbers(source: string): number[] {
  const html = renderMarkdown(source, { blockNumbers: true });
  return [...html.matchAll(/data-block-number="(\d+)"/g)]
    .map((match) => Number(match[1]));
}

test('only matching basenames enable numbering', () => {
  assert.equal(isFullMdFile('/books/ch01.FULL.MD'), true);
  assert.equal(isFullMdFile('/books.full.md/ch01.md'), false);
  assert.equal(isFullMdFile('/books/ch01.full.md.bak'), false);
  assert.equal(isFullMdFile(undefined), false);
});

test('one indented code block, not one badge per line', () => {
  const source = '    first\n    second\n\n    third\n';
  assert.deepEqual(numbers(source), [1]);
});

test('exclude H1 and divider, count H2 and whole list', () => {
  const source = '# Title\n\nText\n\n---\n\n## Section\n\n- A\n- B';
  assert.deepEqual(numbers(source), [1, 2, 3]);
});

test('nested list and multi-paragraph quote stay grouped', () => {
  assert.deepEqual(numbers('- A\n  - nested\n- B'), [1]);
  assert.deepEqual(numbers('> First\n>\n> Second'), [1]);
});

test('default renderer stays free of badges after numbered render', () => {
  assert.deepEqual(numbers('Text'), [1]);
  assert.doesNotMatch(renderMarkdown('Text'), /data-block-number/);
});

test('whole-block cases and generated sections', () => {
  const cases: Array<[string, number[]]> = [
    ['| A | B |\n| --- | --- |\n| 1 | 2 |', [1]],
    ['```text\nfirst\nsecond\n```', [1]],
    ['- First\n\n    continuation\n\n- Second', [1]],
    ['- A\n\nParagraph\n\n- B', [1, 2, 3]],
    ['Title\n=====\n\nBody', [1]],
    ['---\ntitle: Book\n---\n\nBody', [1]],
    ['# Title\n\n[TOC]\n\n## Section\n\nBody', [1, 2]],
    ['Body[^1]\n\n[^1]: Generated footnote', [1]],
  ];
  for (const [source, expected] of cases) {
    assert.deepEqual(numbers(source), expected, source);
  }
});

test('preserve source-line mappings and reset per document', () => {
  const source = '# Title\n\nBody';
  const html = renderMarkdown(source, { blockNumbers: true });
  assert.match(html, /data-source-line="3"/);
  assert.deepEqual(numbers('Second document'), [1]);
});

test('math, HTML, diagrams, callouts and task lists retain their content', () => {
  const cases: Array<[string, RegExp]> = [
    ['$$\nx^2\n$$', /md-math-block/],
    ['<details>\n<summary>More</summary>\nBody\n</details>', /<details>/],
    ['```mermaid\ngraph TD; A-->B\n```', /mermaid/],
    ['> [!NOTE]\n> First\n>\n> Second', /md-callout/],
    ['- [ ] First\n  - Child\n- [x] Second', /checkbox/],
    ['### Three\n\n#### Four\n\n##### Five\n\n###### Six', /<h6/],
  ];
  for (const [source, content] of cases) {
    assert.deepEqual(numbers(source), source.startsWith('###') ? [1, 2, 3, 4] : [1]);
    assert.match(renderMarkdown(source, { blockNumbers: true }), content);
  }
});

test('decorated rendering preserves ordinary HTML after removing only generated wrappers', () => {
  const source = '# Title\n\nשלום world\nsecond line\n\n- A\n  - Child\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';
  const decorated = renderMarkdown(source, { blockNumbers: true });
  const withoutWrappers = decorated.replace(/<div class="full-md-block" data-block-number="\d+" dir="(?:rtl|ltr)">([\s\S]*?)<\/div>/g, '$1');
  assert.equal(withoutWrappers, renderMarkdown(source));
  assert.deepEqual(numbers('First\n\nSecond'), [1, 2]);
  assert.deepEqual(numbers('First'), [1]);
  assert.deepEqual(numbers('First\n\nInserted\n\nSecond'), [1, 2, 3]);
});

test('numbered wrappers follow document RTL while fenced code remains LTR', () => {
  const source = 'שלום עולם בעברית\n\n```text\nEnglish code\n```';
  const html = renderMarkdown(source, { blockNumbers: true });
  assert.match(html, /<div class="full-md-block" data-block-number="1" dir="rtl">/);
  assert.match(html, /<div class="full-md-block" data-block-number="2" dir="rtl">/);
  assert.match(html, /<pre[^>]*dir="ltr"/);
  assert.doesNotMatch(renderMarkdown(source), /full-md-block/);
});

test('fenced code nested in RTL lists remains LTR in numbered rendering', () => {
  const source = '- שלום עולם בעברית עברית עברית עברית עברית\n\n  ```text\n  English code\n  ```';
  const html = renderMarkdown(source, { blockNumbers: true });
  assert.match(html, /<pre[^>]*dir="ltr"/);
  assert.deepEqual(numbers(source), [1]);
});
