import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { settingsCommands, type SettingsPort } from './settings.port.ts';

export function createTauriSettingsPort(invoke: InvokeFn, validation: Validation): SettingsPort {
  return createTauriPort(settingsCommands, invoke, validation);
}
