import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSnippet, nextSnippetId, sanitizeSnippets, snippetPreviewSource, snippetsMarkdown } from './snippets.ts';

test('sanitizeSnippets keeps valid entries in order', () => {
  const input = [{ id: 's1', kind: 'md', title: 'Intro', body: '# Hi' }, { id: 's2', kind: 'mermaid', title: 'Flow', body: 'graph LR; A-->B' }];
  assert.deepEqual(sanitizeSnippets(input), input);
});

test('sanitizeSnippets drops unknown kinds and non-string fields', () => {
  const input = [{ id: 's1', kind: 'html', title: 'x', body: '<b>' }, { id: 's2', kind: 'md', title: 3, body: 'x' }, 'junk', null];
  assert.deepEqual(sanitizeSnippets(input), []);
});

test('sanitizeSnippets regenerates invalid and duplicate ids', () => {
  const out = sanitizeSnippets([
    { id: 's1', kind: 'md', title: 'a', body: '' },
    { id: 's1', kind: 'md', title: 'b', body: '' },
    { id: 'bad id!', kind: 'mmap', title: 'c', body: '- R' },
  ]);
  assert.deepEqual(out.map((s) => s.id), ['s1', 's2', 's3']);
});

test('sanitizeSnippets returns [] for non-arrays', () => {
  assert.deepEqual(sanitizeSnippets(undefined), []);
  assert.deepEqual(sanitizeSnippets({}), []);
});

test('nextSnippetId continues after the highest s<n>', () => {
  assert.equal(nextSnippetId([]), 's1');
  assert.equal(nextSnippetId([{ id: 's4', kind: 'md', title: '', body: '' }, { id: 'x', kind: 'md', title: '', body: '' }]), 's5');
});

test('createSnippet builds an empty snippet with a fresh id', () => {
  assert.deepEqual(createSnippet('mermaid', [], 'Untitled'), { id: 's1', kind: 'mermaid', title: 'Untitled', body: '' });
});

const ALL = [
  { id: 's1', kind: 'md' as const, title: 'Intro', body: '**bold**' },
  { id: 's2', kind: 'mermaid' as const, title: 'Flow', body: 'graph LR\n  A-->B' },
  { id: 's3', kind: 'mmap' as const, title: 'Sub', body: '- Root\n  - A' },
];

test('snippetsMarkdown is empty for no snippets', () => {
  assert.equal(snippetsMarkdown([], 'source'), '');
});

test('snippetsMarkdown source mode fences every kind', () => {
  const md = snippetsMarkdown(ALL, 'source');
  assert.match(md, /^## Snippets$/m);
  assert.match(md, /^### Intro\n\n```markdown\n\*\*bold\*\*\n```$/m);
  assert.match(md, /^```mermaid\ngraph LR\n {2}A-->B\n```$/m);
  assert.match(md, /^```mindmap\n- Root\n {2}- A\n```$/m);
});

test('snippetsMarkdown rendered mode inlines md bodies', () => {
  const md = snippetsMarkdown(ALL, 'rendered');
  assert.match(md, /^### Intro\n\n\*\*bold\*\*$/m);
  assert.ok(!md.includes('```markdown'));
});

test('fences grow past backtick runs inside the body', () => {
  const md = snippetsMarkdown([{ id: 's1', kind: 'md', title: 'T', body: 'a\n```js\nx\n```' }], 'source');
  assert.match(md, /^````markdown$/m);
});

test('untitled snippets get a placeholder heading', () => {
  assert.match(snippetsMarkdown([{ id: 's1', kind: 'md', title: '  ', body: 'x' }], 'source'), /^### s1$/m);
});

test('snippetPreviewSource renders md raw and others as fences', () => {
  assert.equal(snippetPreviewSource(ALL[0]), '**bold**');
  assert.equal(snippetPreviewSource(ALL[1]), '```mermaid\ngraph LR\n  A-->B\n```');
});
