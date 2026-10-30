import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

export const windowCommands = {
  set_menu_config: {
    args: z.object({ lang: z.string(), accels: z.record(z.string(), z.string()) }),
    result: z.null(),
  },
  force_close_window: { result: z.null() },
  drain_pending_opens: { result: z.array(z.string()) },
  set_max_button_rect: {
    args: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), scale: z.number() }),
    result: z.null(),
  },
  open_devtools: { result: z.null() },
} satisfies CommandCatalog;

export type WindowCommandsPort = CommandPort<typeof windowCommands>;
