import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compileSafeUserRegex,
  emptyView,
  isRegexLeafInvalid,
  isRelationshipOp,
  matchesGroup,
  matchesLeaf,
  normalizeFilterGroup,
  normalizeViewFile,
  parseViewFile,
  serializeViewFile,
  slugify,
  toBasesGroup,
  toList,
  uniqueSlug,
  type FilterGroup,
} from './viewFile.ts';
import { inferColumns } from './bases.ts';

const entries = [
  { name: 'alpha.md', mtime: 1700000000, tags: ['x'], frontmatter: { s: 'a' } },
  { name: 'beta.md', mtime: 1700100000, tags: ['y'], frontmatter: { s: 'b' } },
] as never[];
const cols = inferColumns(entries);

test('slugs', () => {
  assert.equal(slugify('Hello, World!'), 'hello-world');
  assert.equal(slugify('!!!'), 'view');
  assert.equal(uniqueSlug('A', new Set(['a', 'a-2'])), 'a-3');
});

test('toList / relationship ops / regex safety', () => {
  assert.deepEqual(toList('a, b,,c'), ['a', 'b', 'c']);
  assert.equal(isRelationshipOp('linksTo'), true);
  assert.equal(isRelationshipOp('eq'), false);
  assert.equal(compileSafeUserRegex('(a+)+'), null);
  assert.ok(compileSafeUserRegex('^al') instanceof RegExp);
  assert.equal(isRegexLeafInvalid({ column: 'name', op: 'regex', value: '(a+)+' }), true);
});

test('matching delegates to bases with friendly ops', () => {
  const m = (leaf: never) => entries.filter((e) => matchesLeaf(e, leaf, cols)).length;
  assert.equal(m({ column: 'name', op: 'not_contains', value: 'alpha' } as never), 1);
  assert.equal(m({ column: 'name', op: 'any_of', value: 'alpha.md, beta.md' } as never), 2);
  assert.equal(m({ column: 'name', op: 'none_of', value: 'alpha.md' } as never), 1);
  assert.equal(m({ column: 'name', op: 'regex', value: '^al' } as never), 1);
  assert.equal(m({ column: 'name', op: 'regex', value: '(a+)+' } as never), 0);
  assert.equal(m({ column: 'name', op: 'regex', value: '' } as never), 2);
  assert.equal(m({ column: 'name', op: 'linksTo', value: 'x' } as never), 0);
  const empty: FilterGroup = { combinator: 'any', children: [] };
  assert.equal(matchesGroup(entries[0], empty, cols), true);
  assert.equal(toBasesGroup({ combinator: 'all', children: [] }).children.length, 1);
});

test('normalize, serialize, parse round trip', () => {
  assert.deepEqual(normalizeFilterGroup({ any: [{ column: 'a', op: 'contains', value: 1 }] }).combinator, 'any');
  const v = normalizeViewFile('s', { name: ' N ', order: 2, columns: ['a', 1], sort: 'mtime:asc', filters: [] });
  assert.equal(v.name, 'N');
  assert.deepEqual(v.columns, ['a']);
  assert.deepEqual(v.sort, { column: 'mtime', dir: 'asc' });
  const text = serializeViewFile(v);
  assert.deepEqual(parseViewFile('s', text), v);
  assert.equal(parseViewFile('s', ': : :').name, 's');
  assert.equal(emptyView('s', 'S').sort?.dir, 'desc');
});
