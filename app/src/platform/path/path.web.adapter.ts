import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import type { PathPort } from './path.port.ts';

const unsupported = (operation: string): Promise<never> =>
  Promise.reject(new PlatformUnsupportedError(operation));

export function createWebPathPort(): PathPort {
  return {
    sep: () => {
      throw new PlatformUnsupportedError('path.sep');
    },
    join: () => unsupported('path.join'),
    tempDir: () => unsupported('path.tempDir'),
    documentDir: () => unsupported('path.documentDir'),
    desktopDir: () => unsupported('path.desktopDir'),
    homeDir: () => unsupported('path.homeDir'),
    readFile: () => unsupported('fs.readFile'),
    exists: () => unsupported('fs.exists'),
    writeTextFile: () => unsupported('fs.writeTextFile'),
    convertFileSrc: () => {
      throw new PlatformUnsupportedError('core.convertFileSrc');
    },
  };
}
