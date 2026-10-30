import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { gitSyncCommands } from './git-sync.port.ts';
import { createWebGitSyncPort } from './git-sync.web.adapter.ts';

const FOLDER = '/vault';
const BASE_URL = 'https://gitea.example.com';
const user = { login: 'ofek', name: null, avatar_url: 'https://a/x.png' };
const repo = {
  name: 'vault',
  full_name: 'ofek/vault',
  clone_url: 'https://github.com/ofek/vault.git',
  private: true,
  default_branch: 'main',
  html_url: 'https://github.com/ofek/vault',
  updated_at: '2026-10-30T00:00:00Z',
};
const syncConfig = { remote_url: repo.clone_url, auto_push: false, auto_pull_minutes: 0, last_push_at: null, last_pull_at: null, encrypted: false, provider: 'github' };
const syncStatus = {
  linked: true,
  remote_url: repo.clone_url,
  auto_push: true,
  auto_pull_minutes: 5,
  encrypted: false,
  provider: 'github',
  ahead: 1,
  behind: 0,
  dirty: false,
  has_conflicts: false,
  conflicts: [],
  last_push_at: 1761800000,
  last_pull_at: null,
};

const fixtures: CatalogFixtures = {
  gitea_clear_token: { result: null },
  gitea_create_vault_repo: { args: { baseUrl: BASE_URL, name: 'vault', private: true }, result: repo },
  gitea_get_url: { result: BASE_URL },
  gitea_has_token: { result: true },
  gitea_list_repos: { args: { baseUrl: BASE_URL }, result: [repo] },
  gitea_set_token: { args: { token: 't' }, result: null },
  gitea_set_url: { args: { url: BASE_URL }, result: null },
  gitea_user: { args: { baseUrl: BASE_URL }, result: user },
  gitea_validate_url: { args: { url: BASE_URL }, result: true },
  github_clear_token: { result: null },
  github_create_vault_repo: { args: { name: 'vault', private: false }, result: repo },
  github_enable_encryption: { args: { folder: FOLDER, passphrase: 'p' }, result: null },
  github_has_token: { result: false },
  github_link_workspace: { args: { folder: FOLDER, remoteUrl: repo.clone_url, encrypted: false, provider: 'github' }, result: syncConfig },
  github_list_repos: { result: [repo] },
  github_pull: { args: { folder: FOLDER }, result: { kind: 'merged', conflicts: [] } },
  github_push: { args: { folder: FOLDER, commitMessage: null }, result: null },
  github_resolve_conflict: { args: { folder: FOLDER, file: 'a.md', choice: 'both' }, result: null },
  github_set_config: { args: { folder: FOLDER, autoPush: true, autoPullMinutes: 5 }, result: syncConfig },
  github_set_token: { args: { token: 't' }, result: null },
  github_sync_status: { args: { folder: FOLDER }, result: syncStatus },
  github_unlink_workspace: { args: { folder: FOLDER }, result: null },
  github_user: { result: user },
  proxy_get: { result: '' },
  proxy_set: { args: { url: 'http://127.0.0.1:7890' }, result: null },
  crypto_clear_passphrase: { args: { folder: FOLDER }, result: null },
  crypto_decrypt_after_pull: { args: { folder: FOLDER }, result: null },
  crypto_set_passphrase: { args: { folder: FOLDER, passphrase: 'p' }, result: null },
  crypto_status: { args: { folder: FOLDER }, result: { enabled: true, has_key: false } },
};

test('git-sync catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(gitSyncCommands, fixtures), []);
});

test('git-sync catalog: 29 commands', () => {
  assert.equal(Object.keys(gitSyncCommands).length, 29);
});

test('git-sync tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: gitSyncCommands[command as keyof typeof gitSyncCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.equal(await method(fixture.args), fixture.result);
  }
});

test('git-sync web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebGitSyncPort().githubHasToken(), PlatformUnsupportedError);
});
