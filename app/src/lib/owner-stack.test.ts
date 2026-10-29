import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOwnerStack } from './owner-stack.ts';

test('starts empty', () => {
  const stack = createOwnerStack<string>();
  assert.equal(stack.size, 0);
  assert.equal(stack.top(), undefined);
});

test('top is the most recently acquired owner still present', () => {
  const stack = createOwnerStack<string>();
  const releaseA = stack.acquire('a');
  const releaseB = stack.acquire('b');
  assert.equal(stack.top(), 'b');
  releaseB();
  assert.equal(stack.top(), 'a');
  releaseA();
  assert.equal(stack.top(), undefined);
});

test('releasing an older owner keeps the newer one on top', () => {
  const stack = createOwnerStack<string>();
  const releaseA = stack.acquire('a');
  stack.acquire('b');
  releaseA();
  assert.equal(stack.top(), 'b');
  assert.equal(stack.size, 1);
});

test('release is idempotent and removes only its own entry', () => {
  const stack = createOwnerStack<string>();
  const releaseFirst = stack.acquire('same');
  stack.acquire('same');
  releaseFirst();
  releaseFirst();
  assert.equal(stack.size, 1);
  assert.equal(stack.top(), 'same');
});

test('notifies on every real change only', () => {
  let changes = 0;
  const stack = createOwnerStack<string>(() => { changes += 1; });
  const release = stack.acquire('a');
  release();
  release();
  assert.equal(changes, 2);
});
