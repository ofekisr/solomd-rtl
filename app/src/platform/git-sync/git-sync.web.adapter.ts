import { createWebPort } from '../ipc/command.web.adapter.ts';
import { gitSyncCommands, type GitSyncPort } from './git-sync.port.ts';

export function createWebGitSyncPort(): GitSyncPort {
  return createWebPort(gitSyncCommands);
}
