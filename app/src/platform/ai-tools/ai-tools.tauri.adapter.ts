import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { aiToolsCommands, type AiToolsPort } from './ai-tools.port.ts';

export function createTauriAiToolsPort(invoke: InvokeFn, validation: Validation): AiToolsPort {
  return createTauriPort(aiToolsCommands, invoke, validation);
}
