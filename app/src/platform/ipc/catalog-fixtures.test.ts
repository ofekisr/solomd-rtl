import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import type { CommandCatalog } from './command.port.ts';
import { catalogFixtureProblems } from './catalog-fixtures.ts';

const catalog = {
  read_file: { args: z.object({ path: z.string() }), result: z.string() },
  list_things: { result: z.array(z.string()) },
} satisfies CommandCatalog;

test('clean fixtures produce no problems', () => {
  assert.deepEqual(catalogFixtureProblems(catalog, {
    read_file: { args: { path: '/a' }, result: 'x' },
    list_things: { result: ['a'] },
  }), []);
});

test('reports missing, unknown and failing fixtures', () => {
  assert.deepEqual(catalogFixtureProblems(catalog, {
    read_file: { args: { path: 1 }, result: 'x' },
    nope: { result: 1 },
  }), [
    'list_things: no fixture',
    'nope: fixture for unknown command',
    'read_file args: path Invalid input: expected string, received number',
  ]);
});
