import { createWebPort } from '../ipc/command.web.adapter.ts';
import { aiCommands, type AiPort } from './ai.port.ts';

export function createWebAiPort(): AiPort {
  return createWebPort(aiCommands);
}
