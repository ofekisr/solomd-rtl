import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSnippet, nextSnippetId, sanitizeSnippets } from './mindmap-snippets.ts';

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
