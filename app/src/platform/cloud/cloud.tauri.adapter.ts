import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { cloudCommands, type CloudPort } from './cloud.port.ts';

export function createTauriCloudPort(invoke: InvokeFn, validation: Validation): CloudPort {
  return createTauriPort(cloudCommands, invoke, validation);
}
