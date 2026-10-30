import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMathBlock } from './preview-math.ts';

test('single-line block', () => {
  assert.deepEqual(findMathBlock('a\n$$ x^2 $$\nb', 2), { from: 1, to: 1, latex: 'x^2' });
});

test('multi-line block', () => {
  assert.deepEqual(findMathBlock('$$\na+b\n$$', 1), { from: 0, to: 2, latex: 'a+b' });
});

test('opening on the line after startLine is found', () => {
  assert.equal(findMathBlock('t\n$$\nz\n$$', 1)?.from, 1);
});

test('unclosed or missing block is null', () => {
  assert.equal(findMathBlock('$$\nx', 1), null);
  assert.equal(findMathBlock('plain', 1), null);
});
