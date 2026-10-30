import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPlainMatches } from './plain-search.ts';

test('empty query yields no matches', () => {
  assert.deepEqual(findPlainMatches('abc', '', false), []);
});
test('case-insensitive finds both', () => {
  assert.deepEqual(findPlainMatches('Ab ab', 'ab', false), [{ start: 0, end: 2 }, { start: 3, end: 5 }]);
});
test('case-sensitive finds one', () => {
  assert.deepEqual(findPlainMatches('Ab ab', 'ab', true), [{ start: 3, end: 5 }]);
});
test('matches do not overlap', () => {
  assert.deepEqual(findPlainMatches('aaaa', 'aa', true), [{ start: 0, end: 2 }, { start: 2, end: 4 }]);
});
