import * as tauriEvent from '@tauri-apps/api/event';
import type { EventsPort } from './events.port.ts';

type EventModule = Pick<typeof tauriEvent, 'listen'>;

export function createTauriEventsPort(mod: EventModule = tauriEvent): EventsPort {
  return {
    listen: (event, handler) => mod.listen(event, handler),
  };
}
