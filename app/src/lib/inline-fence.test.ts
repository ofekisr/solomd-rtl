import { test } from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { findInlineFences, inlineFencePlugin, parseInlineFence } from './inline-fence.ts';

test('parses both the plain and colon forms', () => {
  assert.deepEqual(parseInlineFence('```python; print(1)```'), { lang: 'python', code: 'print(1)' });
  assert.deepEqual(parseInlineFence('```:sql; SELECT 1;```'), { lang: 'sql', code: 'SELECT 1;' });
});

test('rejects lines that are not single-line fences', () => {
  assert.equal(parseInlineFence('```python'), null);
  assert.equal(parseInlineFence('```python; ```'), null);
  assert.equal(parseInlineFence('``python; x``'), null);
  assert.equal(parseInlineFence('text ```py; x```'), null);
  assert.equal(parseInlineFence('```py x```'), null);
});

test('renders as a highlighted code block', () => {
  const md = new MarkdownIt().use(inlineFencePlugin);
  const html = md.render('before\n\n```js; const a = 1;```\n\nafter');
  assert.match(html, /<pre><code class="language-js">const a = 1;\n<\/code><\/pre>/);
  assert.match(html, /<p>before<\/p>/);
});

test('works directly under a paragraph line', () => {
  const md = new MarkdownIt().use(inlineFencePlugin);
  assert.match(md.render('text\n```sh; ls -la```'), /<pre><code class="language-sh">ls -la/);
});

test('a single-line fence inside a real fence stays content', () => {
  const md = new MarkdownIt().use(inlineFencePlugin);
  const html = md.render('```md\n```py; x```\n```');
  assert.match(html, /<code class="language-md">```py; x```/);
  const lines = ['```md', '```py; x```', '```', '```py; y```'];
  assert.deepEqual([...findInlineFences(lines).keys()], [3]);
});
