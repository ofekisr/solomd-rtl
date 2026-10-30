import { createWebPort } from '../ipc/command.web.adapter.ts';
import { fsCommands, type FsPort } from './fs.port.ts';

export function createWebFsPort(): FsPort {
  return createWebPort(fsCommands);
}
