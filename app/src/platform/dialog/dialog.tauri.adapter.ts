import * as tauriDialog from '@tauri-apps/plugin-dialog';
import type { DialogPort } from './dialog.port.ts';

type DialogModule = Pick<typeof tauriDialog, 'open' | 'save'>;

export function createTauriDialogPort(mod: DialogModule = tauriDialog): DialogPort {
  return {
    open: (options) => mod.open(options),
    save: (options) => mod.save(options),
  };
}
