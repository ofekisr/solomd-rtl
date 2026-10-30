import type { EventsPort, PlatformEvent, UnlistenFn } from '../platform/events/events.port.ts';
import type { PlatformWindow, PlatformWebview, WindowPort } from '../platform/window/window.port.ts';
import type { WindowCommandsPort } from '../platform/window/window-commands.port.ts';

export interface FakeEvents extends EventsPort {
  emit<T>(event: string, payload: T): Promise<void>;
  readonly activeListeners: () => number;
}

export interface FakePorts {
  calls: string[];
  window: WindowPort;
  events: FakeEvents;
  windowCommands: WindowCommandsPort;
}

export type FakePortOverrides = Partial<Omit<FakePorts, 'calls'>>;

const NOOP_UNLISTEN: UnlistenFn = () => {};

function fakePlatformWindow(calls: string[], label: string): PlatformWindow {
  const record = (m: string) => async (): Promise<void> => void calls.push(`window.${m}`);
  return {
    label,
    setTitle: async (title: string) => void calls.push(`window.setTitle:${title}`),
    close: record('close'),
    minimize: record('minimize'),
    toggleMaximize: record('toggleMaximize'),
    isMaximized: async () => false,
    isFullscreen: async () => false,
    setFullscreen: record('setFullscreen'),
    startDragging: record('startDragging'),
    onResized: async () => NOOP_UNLISTEN,
  };
}

function fakeWebview(calls: string[]): PlatformWebview {
  return {
    setZoom: async (factor: number) => void calls.push(`window.setZoom:${factor}`),
    onDragDropEvent: async () => NOOP_UNLISTEN,
  };
}

function fakeWindowPort(calls: string[]): WindowPort {
  return {
    currentWindow: () => fakePlatformWindow(calls, 'main'),
    currentWebview: () => fakeWebview(calls),
    createWebviewWindow: () => ({ once: async () => NOOP_UNLISTEN }),
    getVersion: async () => '0.0.0',
    deepLink: { onOpenUrl: async () => NOOP_UNLISTEN, getCurrent: async () => null },
  };
}

function fakeEvents(calls: string[]): FakeEvents {
  const handlers = new Map<string, Set<(e: PlatformEvent<unknown>) => void>>();
  return {
    listen: async <T>(event: string, handler: (e: PlatformEvent<T>) => void) => {
      calls.push(`events.listen:${event}`);
      const set = handlers.get(event) ?? new Set();
      const wrapped = handler as (e: PlatformEvent<unknown>) => void;
      set.add(wrapped);
      handlers.set(event, set);
      return () => void (calls.push(`events.unlisten:${event}`), set.delete(wrapped));
    },
    emit: async <T>(event: string, payload: T) => {
      for (const h of [...(handlers.get(event) ?? [])]) h({ event, id: 0, payload });
    },
    activeListeners: () => [...handlers.values()].reduce((n, s) => n + s.size, 0),
  };
}

function fakeWindowCommands(calls: string[]): WindowCommandsPort {
  const rec = (m: string) => async (): Promise<null> => (calls.push(`windowCommands.${m}`), null);
  return {
    setMenuConfig: rec('setMenuConfig'),
    forceCloseWindow: rec('forceCloseWindow'),
    drainPendingOpens: async () => (calls.push('windowCommands.drainPendingOpens'), []),
    setMaxButtonRect: rec('setMaxButtonRect'),
    openDevtools: rec('openDevtools'),
  };
}

export function fakePorts(overrides: FakePortOverrides = {}): FakePorts {
  const calls: string[] = [];
  return {
    calls,
    window: fakeWindowPort(calls),
    events: fakeEvents(calls),
    windowCommands: fakeWindowCommands(calls),
    ...overrides,
  };
}

// --- Section: other shell services add their own fakes below this line ---
