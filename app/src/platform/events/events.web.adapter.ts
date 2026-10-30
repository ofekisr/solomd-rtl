import { PlatformUnsupportedError } from '../ipc/platform-error.ts';
import type { EventsPort } from './events.port.ts';

export function createWebEventsPort(): EventsPort {
  return {
    listen: () => Promise.reject(new PlatformUnsupportedError('event.listen')),
  };
}
