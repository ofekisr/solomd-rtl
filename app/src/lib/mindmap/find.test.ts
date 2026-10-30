import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { matchingIds, nodeTextPatch } from './find.ts';
import { compileFind, replacementFor, type FindSpec } from '../find-spec.ts';

const tree = (): NodeObj => ({
  id: 'r',
  topic: 'Launch 2026',
  children: [
    { id: 'a', topic: 'Marketing', note: 'budget 2026\nreview 2027' },
    { id: 'b', topic: 'שיווק 2025', children: [{ id: 'c', topic: 'nothing here' }] },
  ],
});

const spec = (search: string, replace = ''): FindSpec => ({ search, replace, caseSensitive: false, regexp: true });

test('matches topic and note text, in tree order', () => {
  assert.deepEqual(matchingIds(tree(), compileFind(spec('\\d{4}'))!), ['r', 'a', 'b']);
});

test('field-specific matches: note-only hits still count', () => {
  assert.deepEqual(matchingIds(tree(), compileFind(spec('^review'))!), ['a']);
});

test('patch rewrites topic and note with groups, counting every replacement', () => {
  const s = spec('(\\d{2})(\\d{2})', '$2/$1');
  const node = tree().children![0];
  const res = nodeTextPatch(node, compileFind(s)!, replacementFor(s));
  assert.deepEqual(res, { patch: { note: 'budget 26/20\nreview 27/20' }, count: 2 });
});

test('patch is null when nothing matches', () => {
  const s = spec('zzz', 'y');
  assert.equal(nodeTextPatch(tree(), compileFind(s)!, replacementFor(s)), null);
});
