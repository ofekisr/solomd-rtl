import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { convertCommands, type ConvertPort } from './convert.port.ts';

export function createTauriConvertPort(invoke: InvokeFn, validation: Validation): ConvertPort {
  return createTauriPort(convertCommands, invoke, validation);
}
