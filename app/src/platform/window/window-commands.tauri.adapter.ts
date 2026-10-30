import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { windowCommands, type WindowCommandsPort } from './window-commands.port.ts';

export function createTauriWindowCommandsPort(invoke: InvokeFn, validation: Validation): WindowCommandsPort {
  return createTauriPort(windowCommands, invoke, validation);
}
