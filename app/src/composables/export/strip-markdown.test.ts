import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stripMarkdown } from './strip-markdown.ts';

test('fences keep their contents, inline code loses backticks', () => {
  assert.equal(stripMarkdown('```js\nlet a = 1;\n```'), 'let a = 1;');
  assert.equal(stripMarkdown('use `npm i` now'), 'use npm i now');
});

test('images collapse to alt text, links to their label', () => {
  assert.equal(stripMarkdown('![logo](a.png) and [site](https://x.io)'), 'logo and site');
});

test('emphasis and strikethrough markers are removed', () => {
  assert.equal(stripMarkdown('**b** __c__ *d* _e_ ~~f~~'), 'b c d e f');
});

test('headings, quotes, list markers and rules are removed', () => {
  assert.equal(stripMarkdown('# Title\n> quote\n- one\n* two\n1. three\n---\nend'), 'Title\nquote\none\ntwo\nthree\n\nend');
});

test('result is trimmed', () => {
  assert.equal(stripMarkdown('\n\n  text  \n\n'), 'text');
});
