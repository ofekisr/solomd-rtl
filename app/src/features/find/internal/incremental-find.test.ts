import assert from 'node:assert/strict';
import test from 'node:test';
import { search, SearchQuery } from '@codemirror/search';
import type { EditorView } from '@codemirror/view';
import { stateWith } from '../../editor/contracts/testkit.ts';
import { firstMatch } from './incremental-find.ts';

const DOC = 'a b a b';
const asView = (doc: string): EditorView => ({ state: stateWith(search(), doc) }) as unknown as EditorView;

test('firstMatch picks the nearest match at or after the cursor', () => {
  const match = firstMatch(new SearchQuery({ search: 'b' }), asView(DOC), 3);
  assert.deepEqual({ from: match?.from, to: match?.to }, { from: 6, to: 7 });
});

test('firstMatch wraps to the top when no match follows the cursor', () => {
  const match = firstMatch(new SearchQuery({ search: 'b' }), asView(DOC), 7);
  assert.equal(match?.from, 2);
});

test('firstMatch returns null when nothing matches', () => {
  assert.equal(firstMatch(new SearchQuery({ search: 'zzz' }), asView(DOC), 0), null);
});
