import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

const captureState = z.object({
  enabled: z.boolean(),
  running: z.boolean(),
  port: z.number(),
  token: z.string(),
  inbox_folder: z.string(),
});

const restState = z.object({
  enabled: z.boolean(),
  running: z.boolean(),
  port: z.number(),
  token: z.string(),
  allow_write: z.boolean(),
});

const toggleArgs = z.object({ enabled: z.boolean(), port: z.number().optional() });
const workspaceArgs = z.object({ folder: z.string().nullable() });

export const captureCommands = {
  capture_get_state: { result: captureState },
  capture_regenerate_token: { result: captureState },
  capture_set_enabled: { args: toggleArgs, result: captureState },
  capture_set_inbox_folder: { args: z.object({ folder: z.string() }), result: captureState },
  capture_set_workspace: { args: workspaceArgs, result: z.null() },
  rest_get_state: { result: restState },
  rest_regenerate_token: { result: restState },
  rest_set_allow_write: { args: z.object({ allow: z.boolean() }), result: restState },
  rest_set_enabled: { args: toggleArgs, result: restState },
  rest_set_workspace: { args: workspaceArgs, result: z.null() },
  quick_capture_close: { result: z.null() },
  quick_capture_open: { result: z.null() },
  quick_capture_set_shortcut: { args: z.object({ accelerator: z.string().nullable() }), result: z.null() },
  quick_capture_write: {
    args: z.object({ title: z.string().optional(), content: z.string(), tags: z.array(z.string()).optional() }),
    result: z.string(),
  },
} satisfies CommandCatalog;

export type CapturePort = CommandPort<typeof captureCommands>;
