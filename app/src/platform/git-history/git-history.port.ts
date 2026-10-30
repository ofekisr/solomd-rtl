import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

const fileVersionArgs = z.object({ folder: z.string(), filePath: z.string(), sha: z.string() });

const workspaceStatus = z.object({
  initialized: z.boolean(),
  head_sha: z.string().nullable(),
  head_message: z.string().nullable(),
  dirty: z.boolean(),
  branch: z.string().nullable(),
});

const commitMeta = z.object({
  sha: z.string(),
  short_sha: z.string(),
  message: z.string(),
  author: z.string(),
  time: z.number(),
});

const diffLine = z.object({ kind: z.enum(['context', 'add', 'remove']), text: z.string() });

const diffHunk = z.object({
  old_start: z.number(),
  old_lines: z.number(),
  new_start: z.number(),
  new_lines: z.number(),
  lines: z.array(diffLine),
});

const diffResult = z.object({
  from_sha: z.string().nullable(),
  to_sha: z.string(),
  hunks: z.array(diffHunk),
  unified: z.string(),
});

export const gitHistoryCommands = {
  git_auto_commit: {
    args: z.object({ folder: z.string(), filePath: z.string().nullable().optional(), message: z.string().nullable().optional() }),
    result: z.string().nullable(),
  },
  git_file_at_version: { args: fileVersionArgs, result: z.string() },
  git_file_diff: { args: fileVersionArgs, result: diffResult },
  git_file_history: { args: z.object({ folder: z.string(), filePath: z.string(), limit: z.number() }), result: z.array(commitMeta) },
  git_init_workspace: {
    args: z.object({ folder: z.string(), initialMessage: z.string().nullable().optional(), excludeAssets: z.boolean().nullable().optional() }),
    result: z.null(),
  },
  git_rollback_file: { args: fileVersionArgs, result: z.null() },
  git_workspace_status: { args: z.object({ folder: z.string() }), result: workspaceStatus },
} satisfies CommandCatalog;

export type GitHistoryPort = CommandPort<typeof gitHistoryCommands>;
