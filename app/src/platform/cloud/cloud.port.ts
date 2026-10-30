import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

const cloudProvider = z.enum(['none', 'icloud', 'dropbox', 'onedrive', 'google_drive']);

const sessionTab = z.object({
  file_path: z.string().nullable(),
  file_name: z.string(),
  cursor_line: z.number().nullable(),
  cursor_col: z.number().nullable(),
  rel_path: z.string().nullable().optional(),
});

const sessionPayload = z.object({
  device_id: z.string(),
  device_label: z.string(),
  saved_at: z.number(),
  active_index: z.number(),
  tabs: z.array(sessionTab),
});

const siblingSession = z.object({
  device_id: z.string(),
  device_label: z.string(),
  saved_at: z.number(),
  tab_count: z.number(),
});

export const cloudCommands = {
  cloud_folder_detect: {
    args: z.object({ folder: z.string() }),
    result: z.object({ provider: cloudProvider, label: z.string() }),
  },
  device_id_get_or_create: { result: z.string() },
  session_list_others: {
    args: z.object({ folder: z.string(), ourDeviceId: z.string() }),
    result: z.array(siblingSession),
  },
  session_load: {
    args: z.object({ folder: z.string(), deviceId: z.string() }),
    result: sessionPayload.nullable(),
  },
  session_save: {
    args: z.object({ folder: z.string(), payload: sessionPayload }),
    result: z.null(),
  },
} satisfies CommandCatalog;

export type CloudPort = CommandPort<typeof cloudCommands>;
