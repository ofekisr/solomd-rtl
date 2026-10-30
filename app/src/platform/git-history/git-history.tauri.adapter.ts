import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { gitHistoryCommands, type GitHistoryPort } from './git-history.port.ts';

export function createTauriGitHistoryPort(invoke: InvokeFn, validation: Validation): GitHistoryPort {
  return createTauriPort(gitHistoryCommands, invoke, validation);
}
