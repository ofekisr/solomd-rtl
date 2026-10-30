import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/platform-error.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { ragCommands } from './rag.port.ts';
import { createWebRagPort } from './rag.web.adapter.ts';

const status = { enabled: true, ready: true, total_files: 10, indexed_files: 8, total_chunks: 120, backend: 'hash', index_version: 2 };
const entry = {
  path: '/w/Welcome.md',
  name: 'Welcome.md',
  stem: 'Welcome',
  mtime: 1761800000,
  size: 512,
  frontmatter: { tags: ['a'] },
  wikilinks: [{ target: 'Other', heading: null, alias: 'o', line: 3 }],
  tags: ['a'],
  headings: ['Intro'],
  tasks: [{ line: 5, text: 'do it', done: false }],
  summary: 'Hello',
  title: null,
  relationships: { parent: ['[[Root]]'] },
};

const fixtures: CatalogFixtures = {
  rag_index_status: { args: { folder: '/w' }, result: status },
  rag_reindex: { args: { folder: '/w' }, result: status },
  rag_reindex_file: { args: { folder: '/w', filePath: '/w/a.md' }, result: null },
  rag_search: {
    args: { args: { folder: '/w', query: 'hello', limit: 20 } },
    result: [{ path: '/w/a.md', name: 'a.md', chunk_idx: 0, char_start: 0, char_end: 40, score: 0.5, snippet: 'Hello' }],
  },
  rag_set_enabled: { args: { folder: '/w', enabled: true }, result: status },
  workspace_index_backlinks: {
    args: { target: 'Welcome' },
    result: [{ from_path: '/w/b.md', from_name: 'b.md', line: 2, context: ['a', 'b', 'c'] }],
  },
  workspace_index_files: { result: [entry, { ...entry, frontmatter: null, title: 'T' }] },
  workspace_index_init: { args: { folder: '/w' }, result: 42 },
  workspace_index_referenced_by: {
    args: { target: 'Root' },
    result: [{ from_path: '/w/c.md', from_name: 'c.md', via_key: 'parent' }],
  },
  workspace_index_rescan: { result: 42 },
  workspace_index_resolve: { args: { name: 'Welcome' }, result: '/w/Welcome.md' },
  workspace_index_tags: { result: [{ tag: 'a', count: 1, files: ['/w/Welcome.md'] }] },
};

test('rag catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(ragCommands, fixtures), []);
});

test('rag catalog: nullable resolve and optional limit parse', () => {
  assert.ok(ragCommands.workspace_index_resolve.result.safeParse(null).success);
  assert.ok(ragCommands.rag_search.args.safeParse({ args: { folder: '/w', query: 'q' } }).success);
});

test('rag tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: ragCommands[command as keyof typeof ragCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.equal(await method(fixture.args), fixture.result);
  }
});

test('rag web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebRagPort().ragIndexStatus({ folder: '/w' }), PlatformUnsupportedError);
});
