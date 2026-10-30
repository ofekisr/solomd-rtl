import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { ragCommands, type RagPort } from './rag.port.ts';

export function createTauriRagPort(invoke: InvokeFn, validation: Validation): RagPort {
  return createTauriPort(ragCommands, invoke, validation);
}
