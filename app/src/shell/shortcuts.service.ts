import type { WindowCommandsPort } from '../platform/window/window-commands.port.ts';
import type { SettingsPort } from '../platform/settings/settings.port.ts';
import type { CapturePort } from '../platform/capture/capture.port.ts';
import type { EventsPort, PlatformEvent, UnlistenFn } from '../platform/events/events.port.ts';
import type { ClipboardPort } from '../platform/clipboard/clipboard.port.ts';
import type { PlatformWindow } from '../platform/window/window.port.ts';
import { nativeMenuAccelerators } from '../lib/keybindings.ts';

export const MENU_EVENT = 'solomd://menu';
export const MENU_DOM_EVENT = 'solomd:menu-action';
const NEW_WINDOW_FAILED_KEY = 'toast.newWindowFailed';

export const ESC_PRIORITY = [
  'sidebarCtx',
  'about',
  'cjkProofread',
  'ragSearch',
  'fileChanged',
  'search',
  'help',
  'quickSwitcher',
  'palette',
  'settings',
] as const;

export type OverlayName = (typeof ESC_PRIORITY)[number];
type OpenableOverlay = 'about' | 'cjkProofread' | 'help' | 'palette' | 'settings';

export interface DismissibleOverlay {
  isOpen(): boolean;
  close(): void;
}

export interface OpenableOverlayHandle extends DismissibleOverlay {
  open(): void;
}

export type ShortcutOverlays = { [K in OverlayName]: K extends OpenableOverlay ? OpenableOverlayHandle : DismissibleOverlay };

export interface ZoomActions {
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;
  editorFontIn(): void;
  editorFontOut(): void;
  resetEditorFontSize(): void;
  previewFontIn(): void;
  previewFontOut(): void;
  resetPreviewFontSize(): void;
}

export interface FileActions {
  newFile(): unknown;
  newTextFile(): unknown;
  openFile(): unknown;
  openFolder(): unknown;
  importDocuments(): Promise<unknown>;
  saveActive(): unknown;
  saveActiveAs(): unknown;
  closeTabSafe(id: string): unknown;
}

export type ToastKind = 'warning' | 'error';

export interface ShortcutActions {
  files: FileActions;
  exportPdfPrint(): unknown;
  activeTabId(): string | null | undefined;
  toggleOutline(id: string): void;
  zoom: ZoomActions;
  toggleTheme(): void;
  toggleFileTree(): void;
  cycleViewMode(): void;
  isReadingMode(): boolean;
  exitReadingMode(): void;
  overlays: ShortcutOverlays;
  openNewWindow(): Promise<void>;
  openExternalFile(): unknown;
  toggleGlobalSearch(): void;
  showToast(kind: ToastKind, message: string): void | Promise<void>;
  t(key: string): string;
}

type DomTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
type ExecCommand = (command: string, showUi?: boolean, value?: string) => boolean;

export interface ShortcutsDeps {
  windowCommandsPort: Pick<WindowCommandsPort, 'setMenuConfig'>;
  settingsPort: Pick<SettingsPort, 'saveLanguagePreference'>;
  capturePort: Pick<CapturePort, 'quickCaptureSetShortcut'>;
  eventsPort: EventsPort;
  clipboardPort: Pick<ClipboardPort, 'readText'>;
  windowPort: { currentWindow(): Pick<PlatformWindow, 'close'> };
  actions: ShortcutActions;
  execCommand?: ExecCommand;
  domTarget?: DomTarget;
}

export type KeyLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'preventDefault'>;

export interface ShortcutsService {
  start(): Promise<void>;
  stop(): void;
  onEsc(e: KeyLike): void;
  onZoomShortcut(e: KeyLike): boolean;
  dispatchMenuAction(id: string): void;
  syncNativeMenu(keybindings: Record<string, string | null | undefined>, language: string): void;
  syncQuickCaptureShortcut(enabled: boolean, shortcut: string): Promise<string>;
  onOpenHelpEvent(): void;
  onOpenSearchEvent(): void;
  onOpenCjkProofreadEvent(): void;
}

type ZoomAxis = 'ui' | 'editor' | 'preview';
type ZoomStep = 'in' | 'out' | 'reset';

const ZOOM_METHODS: Record<ZoomAxis, Record<ZoomStep, keyof ZoomActions>> = {
  ui: { in: 'zoomIn', out: 'zoomOut', reset: 'resetZoom' },
  editor: { in: 'editorFontIn', out: 'editorFontOut', reset: 'resetEditorFontSize' },
  preview: { in: 'previewFontIn', out: 'previewFontOut', reset: 'resetPreviewFontSize' },
};

function zoomAxis(e: KeyLike): ZoomAxis {
  if (e.shiftKey && !(e.metaKey && e.ctrlKey)) return 'editor';
  if (e.metaKey && e.ctrlKey) return 'preview';
  return 'ui';
}

function zoomStep(key: string): ZoomStep | null {
  if (key === '=' || key === '+') return 'in';
  if (key === '-' || key === '_') return 'out';
  if (key === '0') return 'reset';
  return null;
}

function hasZoomModifier(e: KeyLike): boolean {
  const ctrlOnly = e.ctrlKey && !e.metaKey;
  if (!e.metaKey && !ctrlOnly) return false;
  return !e.altKey;
}

function defaultExecCommand(): ExecCommand {
  return (command, showUi, value) => document.execCommand(command, showUi, value);
}

function defaultDomTarget(): DomTarget | undefined {
  return typeof window !== 'undefined' ? window : undefined;
}

type MenuHandler = () => void;

function fileHandlers(a: ShortcutActions): Record<string, MenuHandler> {
  const f = a.files;
  return {
    'file.new': () => void f.newFile(),
    'file.newText': () => void f.newTextFile(),
    'file.open': () => void f.openFile(),
    'file.openFolder': () => void f.openFolder(),
    'file.import': () => void f.importDocuments(),
    'file.save': () => void f.saveActive(),
    'file.saveAs': () => void f.saveActiveAs(),
    'file.openExternal': () => void a.openExternalFile(),
    'file.print': () => void a.exportPdfPrint(),
    'file.closeTab': () => {
      const id = a.activeTabId();
      if (id) f.closeTabSafe(id);
    },
  };
}

function windowHandlers(a: ShortcutActions, deps: ShortcutsDeps): Record<string, MenuHandler> {
  return {
    'window.new': () =>
      void a.openNewWindow().catch(async (e: unknown) => {
        console.error('failed to create window', e);
        await a.showToast('warning', a.t(NEW_WINDOW_FAILED_KEY));
      }),
    'file.exit': () => void deps.windowPort.currentWindow().close(),
  };
}

function viewHandlers(a: ShortcutActions): Record<string, MenuHandler> {
  const z = a.zoom;
  return {
    'view.toggleTheme': () => a.toggleTheme(),
    'view.toggleFileTree': () => a.toggleFileTree(),
    'view.toggleOutline': () => {
      const id = a.activeTabId();
      if (id) a.toggleOutline(id);
    },
    'view.cycleView': () => a.cycleViewMode(),
    'view.zoomUiIn': () => z.zoomIn(),
    'view.zoomUiOut': () => z.zoomOut(),
    'view.zoomUiReset': () => z.resetZoom(),
    'view.zoomEditorIn': () => z.editorFontIn(),
    'view.zoomEditorOut': () => z.editorFontOut(),
    'view.zoomEditorReset': () => z.resetEditorFontSize(),
    'view.zoomPreviewIn': () => z.previewFontIn(),
    'view.zoomPreviewOut': () => z.previewFontOut(),
    'view.zoomPreviewReset': () => z.resetPreviewFontSize(),
  };
}

function overlayHandlers(a: ShortcutActions): Record<string, MenuHandler> {
  const o = a.overlays;
  return {
    'view.cmdPalette': () => o.palette.open(),
    'view.settings': () => o.settings.open(),
    'search.global': () => a.toggleGlobalSearch(),
    'help.markdown': () => o.help.open(),
    'help.about': () => o.about.open(),
  };
}

function editHandlers(deps: ShortcutsDeps, exec: () => ExecCommand): Record<string, MenuHandler> {
  return {
    'edit.undo': () => void exec()('undo'),
    'edit.redo': () => void exec()('redo'),
    'edit.cut': () => void exec()('cut'),
    'edit.copy': () => void exec()('copy'),
    'edit.paste': () =>
      void deps.clipboardPort
        .readText()
        .then((text) => {
          if (text) exec()('insertText', false, text);
        })
        .catch(() => {}),
    'edit.selectAll': () => void exec()('selectAll'),
  };
}

function buildMenuTable(deps: ShortcutsDeps): ReadonlyMap<string, MenuHandler> {
  const a = deps.actions;
  const exec = (): ExecCommand => deps.execCommand ?? defaultExecCommand();
  return new Map(
    Object.entries({
      ...fileHandlers(a),
      ...windowHandlers(a, deps),
      ...viewHandlers(a),
      ...overlayHandlers(a),
      ...editHandlers(deps, exec),
    }),
  );
}

export function createShortcutsService(deps: ShortcutsDeps): ShortcutsService {
  const a = deps.actions;
  const menuTable = buildMenuTable(deps);
  let unlistenMenu: UnlistenFn | null = null;
  let domTarget: DomTarget | undefined;

  function dispatchMenuAction(id: string): void {
    const handler = menuTable.get(id);
    if (!handler) {
      console.warn('unknown menu action', id);
      return;
    }
    handler();
  }

  function onDomMenuAction(e: Event): void {
    const id = (e as CustomEvent<string>).detail;
    if (id) dispatchMenuAction(id);
  }

  function onZoomShortcut(e: KeyLike): boolean {
    if (!hasZoomModifier(e)) return false;
    const step = zoomStep(e.key);
    if (!step) return false;
    e.preventDefault();
    a.zoom[ZOOM_METHODS[zoomAxis(e)][step]]();
    return true;
  }

  function onEsc(e: KeyLike): void {
    if (onZoomShortcut(e)) return;
    if (e.key !== 'Escape') return;
    const top = ESC_PRIORITY.find((name) => a.overlays[name].isOpen());
    if (top) a.overlays[top].close();
    else if (a.isReadingMode()) a.exitReadingMode();
  }

  function syncNativeMenu(keybindings: Record<string, string | null | undefined>, language: string): void {
    const overrides = { ...keybindings };
    deps.windowCommandsPort
      .setMenuConfig({ lang: language, accels: nativeMenuAccelerators(overrides) })
      .catch(() => {});
    deps.settingsPort.saveLanguagePreference({ lang: language }).catch(() => {});
  }

  async function syncQuickCaptureShortcut(enabled: boolean, shortcut: string): Promise<string> {
    const accelerator = enabled ? shortcut : null;
    try {
      await deps.capturePort.quickCaptureSetShortcut({ accelerator });
      return '';
    } catch (e) {
      console.warn('[quickCapture] shortcut not registered', e);
      return String(e);
    }
  }

  async function listenMenu(): Promise<void> {
    try {
      unlistenMenu = await deps.eventsPort.listen<string>(MENU_EVENT, (e: PlatformEvent<string>) => {
        if (e.payload) dispatchMenuAction(e.payload);
      });
    } catch (err) {
      console.warn('menu listener not available', err);
    }
  }

  async function start(): Promise<void> {
    await listenMenu();
    domTarget = deps.domTarget ?? defaultDomTarget();
    domTarget?.addEventListener(MENU_DOM_EVENT, onDomMenuAction);
  }

  function stop(): void {
    if (unlistenMenu) {
      unlistenMenu();
      unlistenMenu = null;
    }
    domTarget?.removeEventListener(MENU_DOM_EVENT, onDomMenuAction);
  }

  return {
    start,
    stop,
    onEsc,
    onZoomShortcut,
    dispatchMenuAction,
    syncNativeMenu,
    syncQuickCaptureShortcut,
    onOpenHelpEvent: () => a.overlays.help.open(),
    onOpenSearchEvent: () => a.toggleGlobalSearch(),
    onOpenCjkProofreadEvent: () => a.overlays.cjkProofread.open(),
  };
}
