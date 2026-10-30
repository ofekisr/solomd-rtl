import { createWebPort } from '../ipc/command.web.adapter.ts';
import { androidCommands, type AndroidPort } from './android.port.ts';

export function createWebAndroidPort(): AndroidPort {
  return createWebPort(androidCommands);
}
