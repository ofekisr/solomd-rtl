import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

const unit = z.null();
const optionalText = z.string().nullish();

const chatMessage = z.object({
  role: z.string(),
  content: z.string(),
  tool_call_id: z.string().nullish(),
});

const chatRequest = z.object({
  provider: z.string(),
  api_format: optionalText,
  model: z.string(),
  messages: z.array(chatMessage),
  base_url: optionalText,
  tools: z.array(z.string()).nullish(),
  allow_write: z.boolean().nullish(),
  run_id: optionalText,
  workspace: optionalText,
  tool_loop_cap: z.number().nullish(),
  request_id: optionalText,
});

const rewriteRequest = z.object({
  provider: z.string(),
  api_format: optionalText,
  model: z.string(),
  system: z.string(),
  user: z.string(),
  selection: z.string(),
  base_url: optionalText,
  request_id: optionalText,
});

const modelProbe = z.object({
  ok: z.boolean(),
  models: z.array(z.string()),
  url: z.string(),
  error: z.string().optional(),
});

const ollamaDetection = z.object({
  ok: z.boolean(),
  version: z.string().optional(),
  models: z.array(z.string()),
});

const agentRunMeta = z.object({
  run_id: z.string(),
  kind: z.enum(['panel', 'recipe']),
  started_at: z.number(),
  ended_at: z.number().nullable(),
  status: z.string(),
  workspace: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  recipe: z.object({ name: z.string() }).nullish(),
  tokens: z.object({ input: z.number().optional(), output: z.number().optional() }).optional(),
  cost_usd_estimate: z.number().optional(),
  _dir: z.string().optional(),
  _run_md: z.string().optional(),
});

const runSummary = z.object({
  run_id: z.string(),
  kind: z.string(),
  status: z.string(),
  started_at: z.number(),
  ended_at: z.number().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  tokens_in: z.number(),
  tokens_out: z.number(),
  cost_usd_estimate: z.number(),
  has_meta: z.boolean(),
});

const traceLine = z.looseObject({
  ts: z.number(),
  run_id: z.string(),
  seq: z.number(),
  kind: z.string(),
});

const providerTotals = z.object({
  input: z.number(),
  output: z.number(),
  cost_usd: z.number(),
  runs: z.number(),
});

const costMeter = z.object({
  enabled: z.boolean(),
  since_epoch: z.number(),
  providers: z.record(z.string(), providerTotals),
});

const cjkIssue = z.object({
  line: z.number(),
  col_start: z.number(),
  col_end: z.number(),
  severity: z.string(),
  category: z.string(),
  original: z.string(),
  suggestion: z.string(),
  explanation: z.string(),
});

const workspaceArgs = z.object({ workspace: z.string() });
const workspaceRunArgs = z.object({ workspace: z.string(), runId: z.string() });
const providerArgs = z.object({ provider: z.string() });
const requestIdArgs = z.object({ requestId: z.string() });

export const aiCommands = {
  ai_cancel: { args: requestIdArgs, result: unit },
  ai_chat: { args: z.object({ request: chatRequest }), result: z.string() },
  ai_clear_key: { args: providerArgs, result: unit },
  ai_has_key: { args: providerArgs, result: z.boolean() },
  ai_list_models: { args: z.object({ provider: z.string(), baseUrl: optionalText }), result: modelProbe },
  ai_rewrite: { args: z.object({ request: rewriteRequest }), result: z.string() },
  ai_set_key: { args: z.object({ provider: z.string(), key: z.string() }), result: unit },
  ai_verify_key: {
    args: z.object({
      provider: z.string(),
      key: optionalText,
      apiFormat: optionalText,
      baseUrl: optionalText,
      model: optionalText,
    }),
    result: z.string(),
  },
  ollama_cancel_pull: { args: requestIdArgs, result: unit },
  ollama_detect: { args: z.object({ baseUrl: optionalText }), result: ollamaDetection },
  ollama_pull: { args: z.object({ model: z.string(), requestId: z.string(), baseUrl: optionalText }), result: unit },
  open_ollama_install_page: { result: unit },
  agent_list_runs: { args: workspaceArgs, result: z.array(agentRunMeta) },
  agent_trace_list: { args: workspaceArgs, result: z.array(runSummary) },
  agent_trace_read: { args: workspaceRunArgs, result: z.array(traceLine) },
  agent_trace_replay_from: { args: z.object({ workspace: z.string(), runId: z.string(), seq: z.number() }), result: z.string() },
  cost_meter_get: { result: costMeter },
  cost_meter_reset: { result: costMeter },
  cost_meter_set_enabled: { args: z.object({ enabled: z.boolean() }), result: costMeter },
  cjk_proofread: { args: z.object({ text: z.string() }), result: z.array(cjkIssue) },
} satisfies CommandCatalog;

export type AiPort = CommandPort<typeof aiCommands>;
