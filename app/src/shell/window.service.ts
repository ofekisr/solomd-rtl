import type { EventsPort, UnlistenFn } from '../platform/events/events.port.ts';
import type { WindowPort } from '../platform/window/window.port.ts';
import type { WindowCommandsPort } from '../platform/window/window-commands.port.ts';
import { isMacOS } from '../lib/platform.ts';

const WHEEL_ZOOM_STEP_DELTA = 12;
const WHEEL_ZOOM_THROTTLE_MS = 60;
const WHEEL_ZOOM_STEP = 0.1;
const STALE_WINDOW_STATE_KEY = 'solomd.window.v1';
const CLOSE_REQUESTED_EVENT = 'solomd://close-requested';
const WINDOW_DESTROYED_EVENT = 'solomd://window-destroyed';

export interface WindowDocument {
  title: string;
  documentElement: { style: { zoom: string } };
}

export interface WindowDeps {
  windowPort: WindowPort;
  eventsPort: EventsPort;
  windowCommandsPort: WindowCommandsPort;
  document: WindowDocument;
  isDev: boolean;
  getGlobalZoom: () => number;
  setGlobalZoom: (zoom: number) => void;
  isWheelZoomEnabled: () => boolean;
  autoSaveDirtyTabs: () => Promise<unknown> | unknown;
  persistSession: () => void;
  reloadWindows: () => void;
  getAuxLabels: () => string[];
  unregisterWindow: (label: string) => void;
  isAuxLabel: (label: string) => boolean;
}

export interface WindowService {
  start(): Promise<void>;
  stop(): void;
  onWheelZoom(e: WheelEvent): void;
  onWindowBlur(): void;
  applyWindowTitle(name?: string): Promise<void>;
  applyZoom(zoom: number): void;
  removeStaleWindowState(): void;
  cleanAuxRegistry(): void;
  listenCloseRequested(): Promise<void>;
  listenWindowDestroyed(): Promise<void>;
}

export function createWindowService(deps: WindowDeps): WindowService {
  let lastWheelZoomAt = 0;
  let wheelZoomAccum = 0;
  let unlistenWindowDestroyed: UnlistenFn | null = null;

  function onWheelZoom(e: WheelEvent): void {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (!deps.isWheelZoomEnabled()) return;
    e.preventDefault();
    if (e.deltaY === 0) return;
    if (wheelZoomAccum !== 0 && Math.sign(e.deltaY) !== Math.sign(wheelZoomAccum)) {
      wheelZoomAccum = 0;
    }
    wheelZoomAccum += e.deltaY;
    if (Math.abs(wheelZoomAccum) < WHEEL_ZOOM_STEP_DELTA) return;
    stepZoom();
  }

  function stepZoom(): void {
    const now = Date.now();
    if (now - lastWheelZoomAt < WHEEL_ZOOM_THROTTLE_MS) return;
    lastWheelZoomAt = now;
    const dir = wheelZoomAccum < 0 ? 1 : -1;
    wheelZoomAccum = 0;
    deps.setGlobalZoom((deps.getGlobalZoom() || 1) + dir * WHEEL_ZOOM_STEP);
  }

  async function applyWindowTitle(name?: string): Promise<void> {
    const appName = deps.isDev ? 'SoloMD DEV' : 'SoloMD';
    const title = name ? `${name} — ${appName}` : appName;
    deps.document.title = title;
    if (isMacOS()) return;
    try {
      await deps.windowPort.currentWindow().setTitle(title);
    } catch (err) {
      console.debug('setTitle failed (document.title fallback applied)', err);
    }
  }

  function applyZoom(zoom: number): void {
    const style = deps.document.documentElement.style;
    try {
      void deps.windowPort
        .currentWebview()
        .setZoom(zoom)
        .then(() => {
          style.zoom = '';
        })
        .catch(() => {
          style.zoom = String(zoom);
        });
    } catch {
      style.zoom = String(zoom);
    }
  }

  function onWindowBlur(): void {
    void deps.autoSaveDirtyTabs();
  }

  function removeStaleWindowState(): void {
    try {
      localStorage.removeItem(STALE_WINDOW_STATE_KEY);
    } catch {}
  }

  function cleanAuxRegistry(): void {
    try {
      if (deps.isAuxLabel(deps.windowPort.currentWindow().label)) return;
      deps.reloadWindows();
      for (const label of [...deps.getAuxLabels()]) deps.unregisterWindow(label);
    } catch (err) {
      console.warn('aux-window registry cleanup failed', err);
    }
  }

  async function listenCloseRequested(): Promise<void> {
    try {
      await deps.eventsPort.listen(CLOSE_REQUESTED_EVENT, async () => {
        deps.persistSession();
        await deps.windowCommandsPort.forceCloseWindow();
      });
    } catch (err) {
      console.warn('close-requested listener failed', err);
    }
  }

  async function listenWindowDestroyed(): Promise<void> {
    try {
      unlistenWindowDestroyed = await deps.eventsPort.listen<string>(WINDOW_DESTROYED_EVENT, (e) => {
        if (e.payload && deps.isAuxLabel(e.payload)) deps.unregisterWindow(e.payload);
      });
    } catch (err) {
      console.warn('window-destroyed listener not available', err);
    }
  }

  async function start(): Promise<void> {
    removeStaleWindowState();
    cleanAuxRegistry();
    await listenCloseRequested();
    await listenWindowDestroyed();
  }

  function stop(): void {
    if (!unlistenWindowDestroyed) return;
    unlistenWindowDestroyed();
    unlistenWindowDestroyed = null;
  }

  return {
    start,
    stop,
    onWheelZoom,
    onWindowBlur,
    applyWindowTitle,
    applyZoom,
    removeStaleWindowState,
    cleanAuxRegistry,
    listenCloseRequested,
    listenWindowDestroyed,
  };
}
