import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFilterGroup,
  applyFilters,
  applySort,
  defaultViews,
  formatIsoDate,
  getCellValue,
  inferColumns,
  isFilterGroup,
  isIsoDate,
  normalizeFilterGroup,
  parseRelativeDuration,
  type ColumnDef,
} from './bases.ts';

const entries = [
  { name: 'a.md', mtime: 1700000000, tags: ['x', 'y'], frontmatter: { status: 'done', n: 3, due: '2024-01-02' } },
  { name: 'b.md', mtime: 1700100000, tags: ['y'], frontmatter: { status: 'todo', n: '10', due: '2024-02-03' } },
  { name: 'c.md', mtime: 1700200000, tags: [], frontmatter: { other: 1 } },
] as never[];

test('inferColumns builtins plus frontmatter keys seen twice', () => {
  const cols = inferColumns(entries);
  assert.deepEqual(cols.map((c) => c.id), ['name', 'mtime', 'tags', 'fm:due', 'fm:n', 'fm:status']);
  assert.equal(cols.find((c) => c.id === 'fm:due')?.kind, 'date');
  assert.equal(cols.find((c) => c.id === 'fm:n')?.kind, 'number');
});

test('iso date and formatting', () => {
  assert.equal(isIsoDate('2024-01-02'), true);
  assert.equal(isIsoDate('nope'), false);
  assert.equal(formatIsoDate('2024-01-02'), '2024-01-02');
  const cols = inferColumns(entries);
  assert.equal(getCellValue(entries[0], cols[2] as ColumnDef), 'x, y');
  assert.match(String(getCellValue(entries[0], cols[1] as ColumnDef)), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
});

test('parseRelativeDuration', () => {
  assert.equal(parseRelativeDuration('2w'), 14 * 86400000);
  assert.equal(parseRelativeDuration('3mo'), 90 * 86400000);
  assert.equal(parseRelativeDuration(1), 86400000);
  assert.equal(parseRelativeDuration('x'), null);
});

test('applyFilters flat and group', () => {
  assert.equal(applyFilters(entries, [{ column: 'tags', op: 'has-tag', value: 'x' }]).length, 1);
  assert.equal(applyFilters(entries, [{ column: 'fm:n', op: 'gt', value: 5 }]).length, 1);
  assert.equal(applyFilters(entries, [{ column: 'name', op: 'matches', value: '(' }]).length, 0);
  const group = { combinator: 'any', children: [{ key: 'name', op: 'eq', value: 'a.md' }, { column: 'name', op: 'endsWith', value: 'c.md' }] };
  assert.equal(applyFilterGroup(entries, group).length, 2);
  assert.equal(applyFilterGroup(entries, []).length, 3);
});

test('normalizeFilterGroup shapes', () => {
  assert.deepEqual(normalizeFilterGroup(null), { combinator: 'all', children: [] });
  const g = normalizeFilterGroup({ column: 'a', op: 'eq', value: 1 });
  assert.equal(isFilterGroup(g), true);
  assert.deepEqual(g.children, [{ column: 'a', op: 'eq', value: 1 }]);
  assert.deepEqual(normalizeFilterGroup([{ key: 'k' }]).children, [{ column: 'k', op: 'contains' }]);
});

test('applySort sinks empties', () => {
  const asc = applySort(entries, { column: 'fm:status', dir: 'asc' }).map((e) => (e as { name: string }).name);
  assert.deepEqual(asc, ['a.md', 'b.md', 'c.md']);
  const desc = applySort(entries, { column: 'fm:status', dir: 'desc' }).map((e) => (e as { name: string }).name);
  assert.deepEqual(desc, ['b.md', 'a.md', 'c.md']);
});

test('defaultViews', () => {
  assert.deepEqual(defaultViews().map((v) => v.name), ['All notes', 'Modified this week']);
});
