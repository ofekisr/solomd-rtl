import { createWebPort } from '../ipc/command.web.adapter.ts';
import { cloudCommands, type CloudPort } from './cloud.port.ts';

export function createWebCloudPort(): CloudPort {
  return createWebPort(cloudCommands);
}
