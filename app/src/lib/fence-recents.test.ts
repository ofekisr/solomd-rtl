import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushRecent } from './fence-recents.ts';
import { filterFenceLanguages } from './fence-languages.ts';

test('recents keep the last three, most recent first, without duplicates', () => {
  let r: string[] = [];
  for (const name of ['python', 'rust', 'Python', 'go', 'sql']) r = pushRecent(r, name);
  assert.deepEqual(r, ['sql', 'go', 'python']);
});

test('recents are pinned above the catalogue on an empty query', () => {
  const names = filterFenceLanguages('', 5, ['rust', 'python']).map((l) => l.name);
  assert.deepEqual(names.slice(0, 2), ['rust', 'python']);
  assert.equal(names[2], 'mermaid');
});

test('a recent that does not match the query is not pinned', () => {
  const names = filterFenceLanguages('py', 3, ['rust']).map((l) => l.name);
  assert.ok(!names.includes('rust'));
  assert.equal(names[0], 'python');
});

test('a matching recent beats a better-scoring match', () => {
  assert.equal(filterFenceLanguages('s', 5, ['sql'])[0].name, 'sql');
});
