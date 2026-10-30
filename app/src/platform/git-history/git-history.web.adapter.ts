import { createWebPort } from '../ipc/command.web.adapter.ts';
import { gitHistoryCommands, type GitHistoryPort } from './git-history.port.ts';

export function createWebGitHistoryPort(): GitHistoryPort {
  return createWebPort(gitHistoryCommands);
}
