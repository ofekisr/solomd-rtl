import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import type { OpenerPort } from './opener.port.ts';

export function createWebOpenerPort(): OpenerPort {
  return {
    openUrl: () => Promise.reject(new PlatformUnsupportedError('opener.openUrl')),
    openPath: () => Promise.reject(new PlatformUnsupportedError('opener.openPath')),
    revealItemInDir: () => Promise.reject(new PlatformUnsupportedError('opener.revealItemInDir')),
  };
}
