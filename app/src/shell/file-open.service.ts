import type { AndroidPort } from '../platform/android/android.port.ts';
import type { UnlistenFn, EventsPort } from '../platform/events/events.port.ts';
import type { OpenerPort } from '../platform/opener/opener.port.ts';
import type { WindowPort } from '../platform/window/window.port.ts';
import type { WindowCommandsPort } from '../platform/window/window-commands.port.ts';
import { isAndroid as detectAndroid } from '../lib/platform.ts';

const OPENED_FILE_EVENT = 'solomd://opened-file';
const INSERT_IMAGE_EVENT = 'solomd:insert-image-path';
const ANDROID_PICKER_EVENT = 'solomd:android-folder-picker';
const ANDROID_STORAGE_EVENT = 'solomd:android-request-storage';
const ANDROID_RESTART_EVENT = 'solomd:android-restart-needed';
const SAF_PICKING_KEY = 'solomd:saf-picking';
const STORAGE_PENDING_KEY = 'solomd:android-storage-pending';
const SAF_PICK_RETRIES = 12;
const SAF_PICK_RETRY_MS = 300;
const IMAGE_DROP_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff']);
const STORAGE_HINT =
  'Enable "Allow management of all files / All files access", then come back. The app will restart automatically to apply the permission.';

export interface SafVaultInfo {
  treeUri: string;
  rootDocId: string;
  name: string;
}

export interface SafFsLoader {
  safPersistedTrees(): Promise<string[]>;
  safResolvePicked(): Promise<SafVaultInfo | null | 'pending'>;
}

export interface FileOpenDeps {
  eventsPort: Pick<EventsPort, 'listen'>;
  windowPort: Pick<WindowPort, 'currentWebview' | 'deepLink'>;
  androidPort: Pick<AndroidPort, 'androidSystemInsets' | 'androidRestartApp' | 'androidRequestAllFilesAccess'>;
  windowCommandsPort: Pick<WindowCommandsPort, 'drainPendingOpens'>;
  openerPort: Pick<OpenerPort, 'openPath'>;
  openPath(path: string, options?: { bypassNewWindow: boolean }): Promise<unknown>;
  getActiveFilePath(): string | null | undefined;
  getSafTreeUri(): string | null | undefined;
  setFolder(path: string | null): void;
  setSafVault(treeUri: string, rootId: string, name: string): void;
  isFileTreeShown(): boolean;
  toggleFileTree(): void;
  showToast(kind: 'info' | 'error', message: string): Promise<void>;
  loadSafFs(): Promise<SafFsLoader>;
  setAndroidPickerOpen(open: boolean): void;
  setAndroidRestartNeeded(needed: boolean): void;
  getFocusedPaneId(): string | null | undefined;
  isAndroid?: () => boolean;
}

export interface FileOpenService {
  start(): Promise<void>;
  stop(): void;
  initAndroid(): Promise<void>;
  listenOpenedFile(): Promise<void>;
  listenAndroidEvents(): void;
  handleDeepLinks(): Promise<void>;
  drainPendingOpens(): Promise<void>;
  openPathFromQuery(): Promise<void>;
  listenDragDrop(): Promise<void>;
  openExternalFile(): Promise<void>;
  doAndroidRestart(): Promise<void>;
  onAndroidFolderPick(path: string): void;
  requestAndroidStorage(): Promise<void>;
}

export function createFileOpenService(deps: FileOpenDeps): FileOpenService {
  let unlistenOpened: UnlistenFn | null = null;
  const isAndroid = deps.isAndroid ?? detectAndroid;
  const openBypass = (path: string) => deps.openPath(path, { bypassNewWindow: true });

  async function doAndroidRestart(): Promise<void> {
    deps.setAndroidRestartNeeded(false);
    try {
      await deps.androidPort.androidRestartApp();
    } catch (e) {
      await deps.showToast('error', String(e));
    }
  }

  function onAndroidFolderPick(path: string): void {
    deps.setAndroidPickerOpen(false);
    deps.setFolder(path);
    if (!deps.isFileTreeShown()) deps.toggleFileTree();
  }

  async function requestAndroidStorage(): Promise<void> {
    try {
      localStorage.setItem(STORAGE_PENDING_KEY, '1');
      await deps.androidPort.androidRequestAllFilesAccess();
      await deps.showToast('info', STORAGE_HINT);
    } catch (e) {
      await deps.showToast('error', String(e));
    }
  }

  async function openExternalFile(): Promise<void> {
    const filePath = deps.getActiveFilePath();
    if (!filePath) {
      console.warn('openExternal: no file path');
      return;
    }
    try {
      await deps.openerPort.openPath(filePath);
    } catch (e) {
      await deps.showToast('error', String(e));
    }
  }

  async function applyAndroidInsets(): Promise<void> {
    try {
      const insets = await deps.androidPort.androidSystemInsets();
      const dpr = window.devicePixelRatio || 1;
      const root = document.documentElement;
      root.style.setProperty('--android-safe-top', `${Math.round((insets.top || 0) / dpr)}px`);
      root.style.setProperty('--android-safe-bottom', `${Math.round((insets.bottom || 0) / dpr)}px`);
    } catch (e) {
      console.warn('android_system_insets failed', e);
    }
  }

  async function dropStaleSafVault(): Promise<void> {
    const treeUri = deps.getSafTreeUri();
    if (!treeUri) return;
    try {
      const held = await (await deps.loadSafFs()).safPersistedTrees();
      if (!held.includes(treeUri)) deps.setFolder(null);
    } catch (e) {
      console.warn('SAF vault restore check failed', e);
    }
  }

  async function resolveSafPick(): Promise<void> {
    if (localStorage.getItem(SAF_PICKING_KEY) !== '1') return;
    const saf = await deps.loadSafFs();
    for (let i = 0; i < SAF_PICK_RETRIES; i++) {
      let r: SafVaultInfo | null | 'pending';
      try {
        r = await saf.safResolvePicked();
      } catch {
        return;
      }
      if (r === 'pending') {
        await new Promise((res) => setTimeout(res, SAF_PICK_RETRY_MS));
        continue;
      }
      localStorage.removeItem(SAF_PICKING_KEY);
      if (r) {
        deps.setSafVault(r.treeUri, `saf:${r.rootDocId}`, r.name);
        if (!deps.isFileTreeShown()) deps.toggleFileTree();
      }
      return;
    }
  }

  async function initAndroid(): Promise<void> {
    if (!isAndroid()) return;
    await applyAndroidInsets();
    await dropStaleSafVault();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void resolveSafPick();
    });
    void resolveSafPick();
  }

  async function listenOpenedFile(): Promise<void> {
    try {
      unlistenOpened = await deps.eventsPort.listen<string>(OPENED_FILE_EVENT, async (e) => {
        if (e.payload) await openBypass(e.payload);
      });
    } catch (err) {
      console.warn('opened-file listener not available', err);
    }
  }

  function listenAndroidEvents(): void {
    window.addEventListener(ANDROID_PICKER_EVENT, () => {
      deps.setAndroidPickerOpen(true);
    });
    window.addEventListener(ANDROID_STORAGE_EVENT, () => {
      void requestAndroidStorage();
    });
    window.addEventListener(ANDROID_RESTART_EVENT, () => {
      deps.setAndroidRestartNeeded(true);
    });
  }

  async function handleUrls(urls: string[] | null | undefined): Promise<void> {
    if (!urls) return;
    for (const raw of urls) {
      try {
        await openBypass(raw);
      } catch (err) {
        console.warn('deep-link openPath failed', raw, err);
      }
    }
  }

  async function handleDeepLinks(): Promise<void> {
    try {
      await deps.windowPort.deepLink.onOpenUrl(handleUrls);
      const initial = await deps.windowPort.deepLink.getCurrent();
      await handleUrls(initial);
    } catch (err) {
      console.debug('deep-link plugin not active', err);
    }
  }

  async function drainPendingOpens(): Promise<void> {
    try {
      const pending = await deps.windowCommandsPort.drainPendingOpens();
      for (const p of pending || []) await openBypass(p);
    } catch (err) {
      console.warn('drain_pending_opens failed', err);
    }
  }

  async function openPathFromQuery(): Promise<void> {
    try {
      const initialPath = new URLSearchParams(window.location.search).get('path');
      if (initialPath) await openBypass(initialPath);
    } catch {}
  }

  async function handleDrop(paths: string[]): Promise<void> {
    for (const path of paths) {
      const ext = (path.split('.').pop() || '').toLowerCase();
      if (IMAGE_DROP_EXTS.has(ext)) {
        window.dispatchEvent(
          new CustomEvent(INSERT_IMAGE_EVENT, { detail: { path, paneId: deps.getFocusedPaneId() } }),
        );
        continue;
      }
      await openBypass(path);
    }
  }

  async function listenDragDrop(): Promise<void> {
    try {
      await deps.windowPort.currentWebview().onDragDropEvent(async (event) => {
        if (event.payload.type === 'drop') await handleDrop(event.payload.paths);
      });
    } catch (e) {
      console.warn('drag-drop not available', e);
    }
  }

  async function start(): Promise<void> {
    await initAndroid();
    await listenOpenedFile();
    listenAndroidEvents();
    await handleDeepLinks();
    await drainPendingOpens();
    await openPathFromQuery();
    await listenDragDrop();
  }

  function stop(): void {
    if (!unlistenOpened) return;
    unlistenOpened();
    unlistenOpened = null;
  }

  return {
    start,
    stop,
    initAndroid,
    listenOpenedFile,
    listenAndroidEvents,
    handleDeepLinks,
    drainPendingOpens,
    openPathFromQuery,
    listenDragDrop,
    openExternalFile,
    doAndroidRestart,
    onAndroidFolderPick,
    requestAndroidStorage,
  };
}
