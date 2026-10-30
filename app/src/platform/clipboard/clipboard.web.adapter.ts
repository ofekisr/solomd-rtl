import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import type { ClipboardPort } from './clipboard.port.ts';

const unsupported = (operation: string): Promise<never> =>
  Promise.reject(new PlatformUnsupportedError(`clipboard-manager.${operation}`));

export function createWebClipboardPort(): ClipboardPort {
  return {
    readText: () => unsupported('readText'),
    writeText: () => unsupported('writeText'),
    writeHtml: () => unsupported('writeHtml'),
    writeImage: () => unsupported('writeImage'),
    imageFromBytes: () => unsupported('Image.fromBytes'),
  };
}
