import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import type { EventsPort } from './events.port.ts';

export function createWebEventsPort(): EventsPort {
  return {
    listen: () => Promise.reject(new PlatformUnsupportedError('event.listen')),
  };
}
