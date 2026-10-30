import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

const safTreeArgs = z.object({ treeUri: z.string() });
const safDocArgs = z.object({ treeUri: z.string(), docId: z.string() });

const safEntry = z.object({ name: z.string(), docId: z.string(), isDir: z.boolean() });
const systemInsets = z.object({ top: z.number(), bottom: z.number() });

export const androidCommands = {
  saf_create: {
    args: z.object({ treeUri: z.string(), parentDocId: z.string(), mime: z.string(), name: z.string() }),
    result: z.string(),
  },
  saf_list: { args: safDocArgs, result: z.array(safEntry) },
  saf_persisted_trees: { result: z.array(z.string()) },
  saf_pick_folder: { result: z.null() },
  saf_poll_picked: { result: z.string().nullable() },
  saf_read: { args: safDocArgs, result: z.string() },
  saf_tree_name: { args: safDocArgs, result: z.string() },
  saf_tree_root: { args: safTreeArgs, result: z.string() },
  saf_write: { args: z.object({ treeUri: z.string(), docId: z.string(), content: z.string() }), result: z.null() },
  android_request_all_files_access: { result: z.null() },
  android_restart_app: { result: z.null() },
  android_system_insets: { result: systemInsets },
} satisfies CommandCatalog;

export type AndroidPort = CommandPort<typeof androidCommands>;
