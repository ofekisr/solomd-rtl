import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { aiToolsCommands } from './ai-tools.port.ts';
import { createWebAiToolsPort } from './ai-tools.web.adapter.ts';

const runMeta = {
  run_id: 'r1', kind: 'recipe', started_at: 1730000000, ended_at: 1730000050, status: 'ok', workspace: '/ws', provider: 'openai', model: 'm',
  recipe: { name: 'Daily', path: '/ws/.solomd/agents/daily.yml', trigger: 'manual', branch: 'agent/daily' },
  tokens: { input: 1, output: 2 }, cost_usd_estimate: 0.01, error: null, accepted: null,
};
const profile = { name: 'work', entries: [{ alias: 'main', path: '/ws' }], allow_write: false };
const ws = { workspace: '/ws' };
const wsRun = { workspace: '/ws', runId: 'r1' };
const wsSlug = { workspace: '/ws', slug: 'daily' };

const fixtures: CatalogFixtures = {
  recipes_accept_run: { args: wsRun, result: null },
  recipes_delete: { args: wsSlug, result: null },
  recipes_get: { args: wsSlug, result: 'name: Daily' },
  recipes_history: { args: ws, result: [runMeta] },
  recipes_list: {
    args: ws,
    result: [{
      name: 'Daily', slug: 'daily', path: '/ws/.solomd/agents/daily.yml', trigger: 'manual', schedule: null, match_glob: null, tag: null,
      allow_write: false, write_cap: 5, provider: 'openai', model: 'm', last_run_status: 'ok', last_run_id: 'r1', last_run_started_at: 1730000000,
    }],
  },
  recipes_pending_runs: { args: ws, result: [runMeta] },
  recipes_read_run_md: { args: wsRun, result: '# Run' },
  recipes_read_trace: { args: wsRun, result: '{"seq":1}' },
  recipes_reject_run: { args: wsRun, result: null },
  recipes_run_diff: { args: wsRun, result: 'diff --git' },
  recipes_run_now: { args: wsSlug, result: 'r2' },
  recipes_save: { args: { req: { workspace: '/ws', yaml: 'name: Daily', slug: null } }, result: '/ws/.solomd/agents/daily.yml' },
  cookbook_install: { args: { workspace: '/ws', fileStem: 'daily' }, result: '/ws/.solomd/agents/daily.yml' },
  cookbook_list: {
    result: [{
      file_stem: 'daily', name: 'Daily', trigger: 'manual', allow_write: false, provider: 'openai',
      schedule: null, match_glob: null, description: 'Summarize', yaml: 'name: Daily',
    }],
  },
  mcp_profiles_delete: { args: { name: 'work' }, result: [] },
  mcp_profiles_export_config: { args: { name: 'work', mcpPath: null }, result: '{"mcpServers":{}}' },
  mcp_profiles_list: { result: [profile] },
  mcp_profiles_save: { args: { profile }, result: [profile] },
  cli_status: { result: { installed: true, path: '/usr/local/bin/solomd', version: 'solomd 4.0' } },
  detect_ai_clients: {
    result: [{ id: 'claude-desktop', display_name: 'Claude Desktop', config_path: '/c.json', config_exists: true, config_dir_exists: true, has_solomd_entry: false }],
  },
  inject_mcp: { args: { clientId: 'claude-desktop', workspace: '/ws', allowWrite: false }, result: '/c.json' },
  mcp_claude_desktop_config_path: { result: '/c.json' },
  mcp_path: { result: { path: null, bundled: false } },
  remove_mcp: { args: { clientId: 'claude-desktop' }, result: null },
};

test('ai-tools catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(aiToolsCommands, fixtures), []);
});

test('ai-tools tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: aiToolsCommands[command as keyof typeof aiToolsCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.equal(await method(fixture.args), fixture.result);
  }
});

test('ai-tools inject_mcp accepts a null workspace', () => {
  assert.equal(aiToolsCommands.inject_mcp.args.safeParse({ clientId: 'x', workspace: null, allowWrite: false }).success, true);
});

test('ai-tools web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebAiToolsPort().recipesList({ workspace: '/ws' }), PlatformUnsupportedError);
});
