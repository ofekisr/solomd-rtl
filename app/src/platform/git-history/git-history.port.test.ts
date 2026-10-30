import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { gitHistoryCommands } from './git-history.port.ts';
import { createWebGitHistoryPort } from './git-history.web.adapter.ts';

const FOLDER = '/vault';
const FILE = '/vault/a.md';
const SHA = '0123456789abcdef0123456789abcdef01234567';

const fixtures: CatalogFixtures = {
  git_auto_commit: { args: { folder: FOLDER, filePath: null, message: null }, result: null },
  git_file_at_version: { args: { folder: FOLDER, filePath: FILE, sha: SHA }, result: '# A' },
  git_file_diff: {
    args: { folder: FOLDER, filePath: FILE, sha: SHA },
    result: {
      from_sha: null,
      to_sha: SHA,
      hunks: [{ old_start: 1, old_lines: 1, new_start: 1, new_lines: 2, lines: [{ kind: 'context', text: 'a' }, { kind: 'add', text: 'b' }] }],
      unified: '@@ -1 +1,2 @@\n a\n+b\n',
    },
  },
  git_file_history: {
    args: { folder: FOLDER, filePath: FILE, limit: 50 },
    result: [{ sha: SHA, short_sha: SHA.slice(0, 7), message: 'edit', author: 'Ofek', time: 1761800000 }],
  },
  git_init_workspace: { args: { folder: FOLDER, initialMessage: null, excludeAssets: false }, result: null },
  git_rollback_file: { args: { folder: FOLDER, filePath: FILE, sha: SHA }, result: null },
  git_workspace_status: { args: { folder: FOLDER }, result: { initialized: true, head_sha: SHA, head_message: 'edit', dirty: false, branch: 'main' } },
};

test('git-history catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(gitHistoryCommands, fixtures), []);
});

test('git-history tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: gitHistoryCommands[command as keyof typeof gitHistoryCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.equal(await method(fixture.args), fixture.result);
  }
});

test('git-history web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebGitHistoryPort().gitWorkspaceStatus({ folder: FOLDER }), PlatformUnsupportedError);
});
