import test from 'node:test';
import assert from 'node:assert/strict';
import { isEmptyFilterValue, tagsOfFilter, toDateInputValue, upsertFilter } from './basesFilterValues.ts';
import type { Filter } from '../../lib/bases';

test('toDateInputValue formats local date, empty on bad input', () => {
  assert.equal(toDateInputValue(new Date(2024, 0, 5).getTime()), '2024-01-05');
  assert.equal(toDateInputValue('2024-03-09T12:00:00'), '2024-03-09');
  assert.equal(toDateInputValue(''), '');
  assert.equal(toDateInputValue(undefined), '');
  assert.equal(toDateInputValue('garbage'), '');
});

test('isEmptyFilterValue', () => {
  for (const v of [null, undefined, '', []]) assert.equal(isEmptyFilterValue(v), true);
  for (const v of [0, false, 'a', ['a']]) assert.equal(isEmptyFilterValue(v), false);
});

test('upsertFilter replaces at index or appends', () => {
  const list: Filter[] = [{ column: 'a', op: 'contains', value: 'x' }];
  upsertFilter(list, 0, { column: 'a', op: 'contains', value: 'y' });
  upsertFilter(list, -1, { column: 'b', op: '>', value: 1 });
  assert.deepEqual(list.map((f) => f.column + String(f.value)), ['ay', 'b1']);
});

test('tagsOfFilter handles array, scalar, missing', () => {
  assert.deepEqual(tagsOfFilter(undefined), []);
  assert.deepEqual(tagsOfFilter({ column: 'tags', op: 'has-tag', value: 'p' }), ['p']);
  assert.deepEqual(tagsOfFilter({ column: 'tags', op: 'has-tag', value: ['a', 'b'] }), ['a', 'b']);
});
