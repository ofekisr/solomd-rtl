import { createWebPort } from '../ipc/command.web.adapter.ts';
import { windowCommands, type WindowCommandsPort } from './window-commands.port.ts';

export function createWebWindowCommandsPort(): WindowCommandsPort {
  return createWebPort(windowCommands);
}
