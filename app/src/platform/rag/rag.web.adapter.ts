import { createWebPort } from '../ipc/command.web.adapter.ts';
import { ragCommands, type RagPort } from './rag.port.ts';

export function createWebRagPort(): RagPort {
  return createWebPort(ragCommands);
}
