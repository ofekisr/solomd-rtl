import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/platform-error.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { aiCommands } from './ai.port.ts';
import { createWebAiPort } from './ai.web.adapter.ts';

const traceLine = { ts: 1730000000000, run_id: 'r1', seq: 1, kind: 'run_started', provider: 'openai' };
const runSummary = {
  run_id: 'r1', kind: 'panel', status: 'ok', started_at: 1730000000, ended_at: null, provider: 'openai', model: 'gpt-4.1-mini',
  tokens_in: 10, tokens_out: 20, cost_usd_estimate: 0.001, has_meta: true,
};
const costMeter = { enabled: true, since_epoch: 1730000000, providers: { openai: { input: 1, output: 2, cost_usd: 0.5, runs: 3 } } };

const fixtures: CatalogFixtures = {
  ai_cancel: { args: { requestId: 'q1' }, result: null },
  ai_chat: {
    args: {
      request: {
        provider: 'openai', api_format: 'openai', model: 'gpt-4.1-mini', messages: [{ role: 'user', content: 'hi' }],
        base_url: null, tools: null, allow_write: false, tool_loop_cap: 8, workspace: '/ws', request_id: 'q1',
      },
    },
    result: 'ok',
  },
  ai_clear_key: { args: { provider: 'openai' }, result: null },
  ai_has_key: { args: { provider: 'openai' }, result: true },
  ai_list_models: { args: { provider: 'openai', baseUrl: 'http://localhost:8080/v1' }, result: { ok: true, models: ['m1'], url: 'http://localhost:8080/v1' } },
  ai_rewrite: {
    args: { request: { provider: 'openai', api_format: 'openai', model: 'm', system: 's', user: 'u', selection: 'x', base_url: null, request_id: 'q2' } },
    result: 'rewritten',
  },
  ai_set_key: { args: { provider: 'openai', key: 'sk-test' }, result: null },
  ai_verify_key: { args: { provider: 'openai', key: null, apiFormat: 'openai', baseUrl: null, model: null }, result: 'OK · 3 models available' },
  ollama_cancel_pull: { args: { requestId: 'p1' }, result: null },
  ollama_detect: { args: { baseUrl: undefined }, result: { ok: true, version: '0.5.0', models: ['qwen2.5:1.5b'] } },
  ollama_pull: { args: { model: 'qwen2.5:1.5b', requestId: 'p1', baseUrl: undefined }, result: null },
  open_ollama_install_page: { result: null },
  agent_list_runs: {
    args: { workspace: '/ws' },
    result: [{ run_id: 'r1', kind: 'panel', started_at: 1, ended_at: null, status: 'ok', tokens: { input: 1, output: 2 }, _dir: '/ws/.solomd/agent-runs/r1', _run_md: '/x/run.md' }],
  },
  agent_trace_list: { args: { workspace: '/ws' }, result: [runSummary] },
  agent_trace_read: { args: { workspace: '/ws', runId: 'r1' }, result: [traceLine] },
  agent_trace_replay_from: { args: { workspace: '/ws', runId: 'r1', seq: 2 }, result: 'r2' },
  cost_meter_get: { result: costMeter },
  cost_meter_reset: { result: costMeter },
  cost_meter_set_enabled: { args: { enabled: true }, result: costMeter },
  cjk_proofread: {
    args: { text: '中文abc' },
    result: [{ line: 1, col_start: 0, col_end: 3, severity: 'low', category: 'cjk_latin_space', original: '文a', suggestion: '文 a', explanation: 'space' }],
  },
};

test('ai catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(aiCommands, fixtures), []);
});

test('ai tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: aiCommands[command as keyof typeof aiCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.equal(await method(fixture.args), fixture.result);
  }
});

test('ai web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebAiPort().aiHasKey({ provider: 'openai' }), PlatformUnsupportedError);
});
