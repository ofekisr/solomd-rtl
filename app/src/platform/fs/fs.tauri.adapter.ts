import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { fsCommands, type FsPort } from './fs.port.ts';

export function createTauriFsPort(invoke: InvokeFn, validation: Validation): FsPort {
  return createTauriPort(fsCommands, invoke, validation);
}
