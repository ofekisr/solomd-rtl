import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

const folderArgs = z.object({ folder: z.string() });
const tokenArgs = z.object({ token: z.string() });
const baseUrlArgs = z.object({ baseUrl: z.string() });
const passphraseArgs = z.object({ folder: z.string(), passphrase: z.string() });
const createRepoArgs = z.object({ name: z.string(), private: z.boolean() });

const remoteUser = z.object({ login: z.string(), name: z.string().nullable(), avatar_url: z.string() });

const remoteRepo = z.object({
  name: z.string(),
  full_name: z.string(),
  clone_url: z.string(),
  private: z.boolean(),
  default_branch: z.string(),
  html_url: z.string(),
  updated_at: z.string(),
});

const syncConfig = z.object({
  remote_url: z.string(),
  auto_push: z.boolean(),
  auto_pull_minutes: z.number(),
  last_push_at: z.number().nullable(),
  last_pull_at: z.number().nullable(),
  encrypted: z.boolean(),
  provider: z.string(),
});

const syncStatus = z.object({
  linked: z.boolean(),
  remote_url: z.string(),
  auto_push: z.boolean(),
  auto_pull_minutes: z.number(),
  encrypted: z.boolean(),
  provider: z.string(),
  ahead: z.number(),
  behind: z.number(),
  dirty: z.boolean(),
  has_conflicts: z.boolean(),
  conflicts: z.array(z.string()),
  last_push_at: z.number().nullable(),
  last_pull_at: z.number().nullable(),
});

const pullResult = z.object({
  kind: z.enum(['fast_forward', 'up_to_date', 'conflicts', 'merged']),
  conflicts: z.array(z.string()),
});

const cryptoStatus = z.object({ enabled: z.boolean(), has_key: z.boolean() });

export const gitSyncCommands = {
  gitea_clear_token: { result: z.null() },
  gitea_create_vault_repo: { args: z.object({ baseUrl: z.string(), name: z.string(), private: z.boolean() }), result: remoteRepo },
  gitea_get_url: { result: z.string() },
  gitea_has_token: { result: z.boolean() },
  gitea_list_repos: { args: baseUrlArgs, result: z.array(remoteRepo) },
  gitea_set_token: { args: tokenArgs, result: z.null() },
  gitea_set_url: { args: z.object({ url: z.string() }), result: z.null() },
  gitea_user: { args: baseUrlArgs, result: remoteUser },
  gitea_validate_url: { args: z.object({ url: z.string() }), result: z.boolean() },
  github_clear_token: { result: z.null() },
  github_create_vault_repo: { args: createRepoArgs, result: remoteRepo },
  github_enable_encryption: { args: passphraseArgs, result: z.null() },
  github_has_token: { result: z.boolean() },
  github_link_workspace: {
    args: z.object({
      folder: z.string(),
      remoteUrl: z.string(),
      encrypted: z.boolean().nullable().optional(),
      provider: z.string().nullable().optional(),
    }),
    result: syncConfig,
  },
  github_list_repos: { result: z.array(remoteRepo) },
  github_pull: { args: folderArgs, result: pullResult },
  github_push: { args: z.object({ folder: z.string(), commitMessage: z.string().nullable().optional() }), result: z.null() },
  github_resolve_conflict: { args: z.object({ folder: z.string(), file: z.string(), choice: z.string() }), result: z.null() },
  github_set_config: { args: z.object({ folder: z.string(), autoPush: z.boolean(), autoPullMinutes: z.number() }), result: syncConfig },
  github_set_token: { args: tokenArgs, result: z.null() },
  github_sync_status: { args: folderArgs, result: syncStatus },
  github_unlink_workspace: { args: folderArgs, result: z.null() },
  github_user: { result: remoteUser },
  proxy_get: { result: z.string() },
  proxy_set: { args: z.object({ url: z.string() }), result: z.null() },
  crypto_clear_passphrase: { args: folderArgs, result: z.null() },
  crypto_decrypt_after_pull: { args: folderArgs, result: z.null() },
  crypto_set_passphrase: { args: passphraseArgs, result: z.null() },
  crypto_status: { args: folderArgs, result: cryptoStatus },
} satisfies CommandCatalog;

export type GitSyncPort = CommandPort<typeof gitSyncCommands>;
