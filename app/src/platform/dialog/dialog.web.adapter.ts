import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import type { DialogPort } from './dialog.port.ts';

export function createWebDialogPort(): DialogPort {
  return {
    open: () => Promise.reject(new PlatformUnsupportedError('dialog.open')),
    save: () => Promise.reject(new PlatformUnsupportedError('dialog.save')),
  };
}
