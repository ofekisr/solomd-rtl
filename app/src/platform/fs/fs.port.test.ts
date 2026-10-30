import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/platform-error.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { fsCommands } from './fs.port.ts';
import { createWebFsPort } from './fs.web.adapter.ts';

const readResult = { content: '# A', encoding: 'UTF-8', language: 'markdown', had_bom: false };
const searchOptions = { regex: false, caseSensitive: true, skipCode: false };

const fixtures: CatalogFixtures = {
  copy_file: { args: { src: '/a/img.png', dst: '/b/img.png' }, result: null },
  delete_frontmatter_property: { args: { path: '/n/a.md', key: 'tags' }, result: '# A' },
  fs_create_dir: { args: { path: '/n/new' }, result: null },
  fs_create_file: { args: { path: '/n/new.md', content: '' }, result: null },
  fs_delete: { args: { path: '/n/old.md' }, result: null },
  fs_dir_exists: { args: { path: '/n' }, result: true },
  fs_dirs_with_extensions: { args: { root: '/n', exts: ['md'], showHidden: false }, result: ['sub/dir'] },
  fs_file_exists: { args: { path: '/n/a.md' }, result: false },
  fs_list_dirs: { args: { root: '/n', showHidden: true }, result: ['/n/sub'] },
  fs_list_extensions: { args: { root: '/n' }, result: [{ ext: 'md', count: 3 }] },
  fs_move: { args: { from: '/n/a.md', to: '/n/sub/a.md' }, result: null },
  fs_rename: { args: { from: '/n/a.md', to: '/n/b.md' }, result: null },
  list_dir: {
    args: { path: '/n', showHidden: false, withTimes: true },
    result: [{ name: 'a.md', path: '/n/a.md', is_dir: false, modified: 1700000000000, created: 1690000000000 }, { name: 'sub', path: '/n/sub', is_dir: true }],
  },
  read_binary_file: { args: { path: '/n/img.png' }, result: [137, 80, 78, 71] },
  read_file: { args: { path: '/n/a.md' }, result: readResult },
  update_frontmatter_property: { args: { path: '/n/a.md', key: 'tags', value: ['a', 'b'] }, result: '---\ntags: [a, b]\n---\n' },
  write_binary_file: { args: { path: '/n/img.png', data: [137, 80] }, result: null },
  write_file: { args: { path: '/n/a.md', content: '# A', encoding: 'UTF-8', workspace: undefined }, result: null },
  watch_file: { args: { path: '/n/a.md' }, result: null },
  unwatch_file: { args: { path: '/n/a.md' }, result: null },
  search_in_dir: {
    args: { root: '/n', query: 'foo', maxResults: 100, options: null, replacement: null },
    result: [
      { file: '/n/a.md', line: 3, snippet: 'foo bar', ranges: [[0, 3]], preview: null, nodeId: null, field: null },
      { file: '/n/m.mmap', line: 1, snippet: 'foo', ranges: [[0, 3]], preview: 'baz', nodeId: 'n1', field: 'topic' },
    ],
  },
  replace_in_dir: {
    args: { request: { root: '/n', query: 'a', replacement: 'b', options: searchOptions, only: null, exclude: ['/n/open.md'], dryRun: true } },
    result: { filesChanged: 1, replacements: 2, errors: [] },
  },
  replace_in_text: {
    args: { text: 'aaa', filePath: '/n/a.md', query: 'a', replacement: 'b', options: searchOptions },
    result: { text: 'bbb', count: 3 },
  },
};

test('fs catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(fsCommands, fixtures), []);
});

test('fs tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: fsCommands[command as keyof typeof fsCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.equal(await method(fixture.args), fixture.result);
  }
});

test('fs web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebFsPort().readFile({ path: '/a' }), PlatformUnsupportedError);
});
