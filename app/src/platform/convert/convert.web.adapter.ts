import { createWebPort } from '../ipc/command.web.adapter.ts';
import { convertCommands, type ConvertPort } from './convert.port.ts';

export function createWebConvertPort(): ConvertPort {
  return createWebPort(convertCommands);
}
