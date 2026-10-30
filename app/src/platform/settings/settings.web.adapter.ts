import { createWebPort } from '../ipc/command.web.adapter.ts';
import { settingsCommands, type SettingsPort } from './settings.port.ts';

export function createWebSettingsPort(): SettingsPort {
  return createWebPort(settingsCommands);
}
