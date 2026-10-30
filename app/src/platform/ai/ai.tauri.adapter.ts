import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { aiCommands, type AiPort } from './ai.port.ts';

export function createTauriAiPort(invoke: InvokeFn, validation: Validation): AiPort {
  return createTauriPort(aiCommands, invoke, validation);
}
