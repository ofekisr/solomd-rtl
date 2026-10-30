import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { gitSyncCommands, type GitSyncPort } from './git-sync.port.ts';

export function createTauriGitSyncPort(invoke: InvokeFn, validation: Validation): GitSyncPort {
  return createTauriPort(gitSyncCommands, invoke, validation);
}
