import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseNoteName, buildAcItems, type AcSources } from './plain-autocomplete-items.ts';

const sources: AcSources = {
  notes: () => [{ path: '/w/Alpha.md' }, { path: '/w/b.md', title: 'Beta Title' }],
  tags: () => [{ tag: 'work', count: 3 }, { tag: 'home', count: 1 }],
  citations: () => [{ key: 'smith2020', title: 'A Study' } as never],
};

test('baseNoteName strips dir and .md', () => {
  assert.equal(baseNoteName('C:\\w\\Note.MD'), 'Note');
  assert.equal(baseNoteName('/w/x.md'), 'x');
});
test('wikilink uses title or file name', () => {
  assert.deepEqual(buildAcItems('wikilink', 'beta', sources), [
    { label: 'Beta Title', hint: 'wiki', insert: '[[Beta Title]]', cursorOffset: 14 },
  ]);
  assert.equal(buildAcItems('wikilink', 'alp', sources)[0].label, 'Alpha');
});
test('tag filters and formats', () => {
  assert.deepEqual(buildAcItems('tag', 'wo', sources), [
    { label: '#work', hint: '3', insert: '#work ', cursorOffset: 6 },
  ]);
});
test('citation formats key and title', () => {
  assert.deepEqual(buildAcItems('citation', 'smith', sources), [
    { label: '@smith2020', hint: 'A Study', insert: '@smith2020 ', cursorOffset: 11 },
  ]);
});
