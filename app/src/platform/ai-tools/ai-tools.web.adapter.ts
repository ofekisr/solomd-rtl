import { createWebPort } from '../ipc/command.web.adapter.ts';
import { aiToolsCommands, type AiToolsPort } from './ai-tools.port.ts';

export function createWebAiToolsPort(): AiToolsPort {
  return createWebPort(aiToolsCommands);
}
