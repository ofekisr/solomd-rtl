import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

const unit = z.null();

const recipeSummary = z.object({
  name: z.string(),
  slug: z.string(),
  path: z.string(),
  trigger: z.string(),
  schedule: z.string().nullable(),
  match_glob: z.string().nullable(),
  tag: z.string().nullable(),
  allow_write: z.boolean(),
  write_cap: z.number(),
  provider: z.string(),
  model: z.string(),
  last_run_status: z.string().nullable(),
  last_run_id: z.string().nullable(),
  last_run_started_at: z.number().nullable(),
});

const recipeMeta = z.object({
  name: z.string(),
  path: z.string(),
  trigger: z.string(),
  branch: z.string(),
});

const runMeta = z.object({
  run_id: z.string(),
  kind: z.string(),
  started_at: z.number(),
  ended_at: z.number().nullable(),
  status: z.string(),
  workspace: z.string(),
  provider: z.string(),
  model: z.string(),
  recipe: recipeMeta.nullable(),
  tokens: z.object({ input: z.number(), output: z.number() }),
  cost_usd_estimate: z.number(),
  error: z.string().nullable(),
  accepted: z.boolean().nullable(),
});

const cookbookEntry = z.object({
  file_stem: z.string(),
  name: z.string(),
  trigger: z.string(),
  allow_write: z.boolean(),
  provider: z.string(),
  schedule: z.string().nullable(),
  match_glob: z.string().nullable(),
  description: z.string(),
  yaml: z.string(),
});

const mcpProfile = z.object({
  name: z.string(),
  entries: z.array(z.object({ alias: z.string(), path: z.string() })),
  allow_write: z.boolean(),
});

const cliStatus = z.object({
  installed: z.boolean(),
  path: z.string().nullable(),
  version: z.string().nullable(),
});

const mcpPath = z.object({
  path: z.string().nullable(),
  bundled: z.boolean(),
});

const aiClient = z.object({
  id: z.string(),
  display_name: z.string(),
  config_path: z.string(),
  config_exists: z.boolean(),
  config_dir_exists: z.boolean(),
  has_solomd_entry: z.boolean(),
});

const workspaceArgs = z.object({ workspace: z.string() });
const workspaceSlugArgs = z.object({ workspace: z.string(), slug: z.string() });
const workspaceRunArgs = z.object({ workspace: z.string(), runId: z.string() });
const clientIdArgs = z.object({ clientId: z.string() });

export const aiToolsCommands = {
  recipes_accept_run: { args: workspaceRunArgs, result: unit },
  recipes_delete: { args: workspaceSlugArgs, result: unit },
  recipes_get: { args: workspaceSlugArgs, result: z.string() },
  recipes_history: { args: workspaceArgs, result: z.array(runMeta) },
  recipes_list: { args: workspaceArgs, result: z.array(recipeSummary) },
  recipes_pending_runs: { args: workspaceArgs, result: z.array(runMeta) },
  recipes_read_run_md: { args: workspaceRunArgs, result: z.string() },
  recipes_read_trace: { args: workspaceRunArgs, result: z.string() },
  recipes_reject_run: { args: workspaceRunArgs, result: unit },
  recipes_run_diff: { args: workspaceRunArgs, result: z.string() },
  recipes_run_now: { args: workspaceSlugArgs, result: z.string() },
  recipes_save: {
    args: z.object({ req: z.object({ workspace: z.string(), yaml: z.string(), slug: z.string().nullish() }) }),
    result: z.string(),
  },
  cookbook_install: { args: z.object({ workspace: z.string(), fileStem: z.string() }), result: z.string() },
  cookbook_list: { result: z.array(cookbookEntry) },
  mcp_profiles_delete: { args: z.object({ name: z.string() }), result: z.array(mcpProfile) },
  mcp_profiles_export_config: { args: z.object({ name: z.string(), mcpPath: z.string().nullish() }), result: z.string() },
  mcp_profiles_list: { result: z.array(mcpProfile) },
  mcp_profiles_save: { args: z.object({ profile: mcpProfile }), result: z.array(mcpProfile) },
  cli_status: { result: cliStatus },
  detect_ai_clients: { result: z.array(aiClient) },
  // Callers pass workspace.currentFolder (string | null) today; Rust rejects null with an error, so keep null accepted here.
  inject_mcp: { args: z.object({ clientId: z.string(), workspace: z.string().nullable(), allowWrite: z.boolean() }), result: z.string() },
  mcp_claude_desktop_config_path: { result: z.string().nullable() },
  mcp_path: { result: mcpPath },
  remove_mcp: { args: clientIdArgs, result: unit },
} satisfies CommandCatalog;

export type AiToolsPort = CommandPort<typeof aiToolsCommands>;
