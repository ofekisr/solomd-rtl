import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { androidCommands, type AndroidPort } from './android.port.ts';

export function createTauriAndroidPort(invoke: InvokeFn, validation: Validation): AndroidPort {
  return createTauriPort(androidCommands, invoke, validation);
}
