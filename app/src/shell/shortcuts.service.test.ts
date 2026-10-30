import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createShortcutsService,
  ESC_PRIORITY,
  MENU_DOM_EVENT,
  MENU_EVENT,
  type KeyLike,
  type OverlayName,
  type ShortcutActions,
  type ShortcutsDeps,
} from './shortcuts.service.ts';
import type { PlatformEvent } from '../platform/events/events.port.ts';

interface Harness {
  deps: ShortcutsDeps;
  calls: string[];
  open: Set<OverlayName>;
  state: { activeId: string | null; reading: boolean; clipboard: string; failNewWindow: boolean };
  menuHandler: () => ((e: PlatformEvent<string>) => void) | null;
  unlistenCount: () => number;
  domTarget: EventTarget;
}

function overlay(name: OverlayName, calls: string[], open: Set<OverlayName>) {
  return {
    isOpen: (): boolean => open.has(name),
    open: (): void => {
      calls.push(`open:${name}`);
      open.add(name);
    },
    close: (): void => {
      calls.push(`close:${name}`);
      open.delete(name);
    },
  };
}

function record(calls: string[], name: string): () => void {
  return () => {
    calls.push(name);
  };
}

function buildActions(h: Pick<Harness, 'calls' | 'open' | 'state'>): ShortcutActions {
  const { calls, open, state } = h;
  const r = (name: string): (() => void) => record(calls, name);
  const overlays = Object.fromEntries(
    ESC_PRIORITY.map((name) => [name, overlay(name, calls, open)]),
  ) as ShortcutActions['overlays'];
  return {
    files: {
      newFile: r('files.newFile'),
      newTextFile: r('files.newTextFile'),
      openFile: r('files.openFile'),
      openFolder: r('files.openFolder'),
      importDocuments: async () => {
        calls.push('files.importDocuments');
      },
      saveActive: r('files.saveActive'),
      saveActiveAs: r('files.saveActiveAs'),
      closeTabSafe: (id: string) => {
        calls.push(`files.closeTabSafe:${id}`);
      },
    },
    exportPdfPrint: r('exporter.exportPdfPrint'),
    activeTabId: () => state.activeId,
    toggleOutline: (id: string) => {
      calls.push(`tabs.toggleOutline:${id}`);
    },
    zoom: {
      zoomIn: r('settings.zoomIn'),
      zoomOut: r('settings.zoomOut'),
      resetZoom: r('settings.resetZoom'),
      editorFontIn: r('settings.editorFontIn'),
      editorFontOut: r('settings.editorFontOut'),
      resetEditorFontSize: r('settings.resetEditorFontSize'),
      previewFontIn: r('settings.previewFontIn'),
      previewFontOut: r('settings.previewFontOut'),
      resetPreviewFontSize: r('settings.resetPreviewFontSize'),
    },
    toggleTheme: r('settings.toggleTheme'),
    toggleFileTree: r('settings.toggleFileTree'),
    cycleViewMode: r('settings.cycleViewMode'),
    isReadingMode: () => state.reading,
    exitReadingMode: r('settings.exitReadingMode'),
    overlays,
    openNewWindow: async () => {
      calls.push('openNewWindow');
      if (state.failNewWindow) throw new Error('boom');
    },
    openExternalFile: r('openExternalFile'),
    toggleGlobalSearch: r('toggleGlobalSearch'),
    showToast: (kind, message) => {
      calls.push(`toast.${kind}:${message}`);
    },
    t: (key: string) => `T(${key})`,
  };
}

function harness(): Harness {
  const calls: string[] = [];
  const open = new Set<OverlayName>();
  const state = { activeId: 'tab-1' as string | null, reading: false, clipboard: 'clip', failNewWindow: false };
  let handler: ((e: PlatformEvent<string>) => void) | null = null;
  let unlistens = 0;
  const domTarget = new EventTarget();
  const deps: ShortcutsDeps = {
    windowCommandsPort: {
      setMenuConfig: async (args) => {
        calls.push(`setMenuConfig:${args.lang}:${JSON.stringify(args.accels)}`);
        return null;
      },
    },
    settingsPort: {
      saveLanguagePreference: async (args) => {
        calls.push(`saveLanguagePreference:${args.lang}`);
        return null;
      },
    },
    capturePort: {
      quickCaptureSetShortcut: async (args) => {
        calls.push(`quickCaptureSetShortcut:${String(args.accelerator)}`);
        if (args.accelerator === 'Taken') throw new Error('already registered');
        return null;
      },
    },
    eventsPort: {
      listen: async <T>(event: string, h: (e: PlatformEvent<T>) => void) => {
        calls.push(`listen:${event}`);
        handler = h as unknown as (e: PlatformEvent<string>) => void;
        return () => {
          unlistens += 1;
        };
      },
    },
    clipboardPort: { readText: async () => state.clipboard },
    windowPort: {
      currentWindow: () => ({
        close: async () => {
          calls.push('window.close');
        },
      }),
    },
    execCommand: (command: string, _showUi?: boolean, value?: string) => {
      calls.push(value === undefined ? `exec:${command}` : `exec:${command}:${value}`);
      return true;
    },
    domTarget,
    actions: buildActions({ calls, open, state }),
  };
  return {
    deps,
    calls,
    open,
    state,
    menuHandler: () => handler,
    unlistenCount: () => unlistens,
    domTarget,
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const MENU_TABLE: ReadonlyArray<[string, string[]]> = [
  ['file.new', ['files.newFile']],
  ['file.newText', ['files.newTextFile']],
  ['file.open', ['files.openFile']],
  ['file.openFolder', ['files.openFolder']],
  ['file.import', ['files.importDocuments']],
  ['file.save', ['files.saveActive']],
  ['file.saveAs', ['files.saveActiveAs']],
  ['file.openExternal', ['openExternalFile']],
  ['file.print', ['exporter.exportPdfPrint']],
  ['file.closeTab', ['files.closeTabSafe:tab-1']],
  ['window.new', ['openNewWindow']],
  ['file.exit', ['window.close']],
  ['view.toggleTheme', ['settings.toggleTheme']],
  ['view.toggleFileTree', ['settings.toggleFileTree']],
  ['view.toggleOutline', ['tabs.toggleOutline:tab-1']],
  ['view.cycleView', ['settings.cycleViewMode']],
  ['view.zoomUiIn', ['settings.zoomIn']],
  ['view.zoomUiOut', ['settings.zoomOut']],
  ['view.zoomUiReset', ['settings.resetZoom']],
  ['view.zoomEditorIn', ['settings.editorFontIn']],
  ['view.zoomEditorOut', ['settings.editorFontOut']],
  ['view.zoomEditorReset', ['settings.resetEditorFontSize']],
  ['view.zoomPreviewIn', ['settings.previewFontIn']],
  ['view.zoomPreviewOut', ['settings.previewFontOut']],
  ['view.zoomPreviewReset', ['settings.resetPreviewFontSize']],
  ['view.cmdPalette', ['open:palette']],
  ['view.settings', ['open:settings']],
  ['search.global', ['toggleGlobalSearch']],
  ['help.markdown', ['open:help']],
  ['help.about', ['open:about']],
  ['edit.undo', ['exec:undo']],
  ['edit.redo', ['exec:redo']],
  ['edit.cut', ['exec:cut']],
  ['edit.copy', ['exec:copy']],
  ['edit.paste', ['exec:insertText:clip']],
  ['edit.selectAll', ['exec:selectAll']],
];

for (const [id, expected] of MENU_TABLE) {
  test(`dispatchMenuAction maps ${id}`, async () => {
    const h = harness();
    createShortcutsService(h.deps).dispatchMenuAction(id);
    await flush();
    assert.deepEqual(h.calls, expected);
  });
}

test('file.closeTab and view.toggleOutline skip when no active tab', () => {
  const h = harness();
  h.state.activeId = null;
  const svc = createShortcutsService(h.deps);
  svc.dispatchMenuAction('file.closeTab');
  svc.dispatchMenuAction('view.toggleOutline');
  assert.deepEqual(h.calls, []);
});

test('window.new failure shows the newWindowFailed warning toast', async (t) => {
  t.mock.method(console, 'error', () => {});
  const h = harness();
  h.state.failNewWindow = true;
  createShortcutsService(h.deps).dispatchMenuAction('window.new');
  await flush();
  assert.deepEqual(h.calls, ['openNewWindow', 'toast.warning:T(toast.newWindowFailed)']);
});

test('edit.paste with empty clipboard inserts nothing', async () => {
  const h = harness();
  h.state.clipboard = '';
  createShortcutsService(h.deps).dispatchMenuAction('edit.paste');
  await flush();
  assert.deepEqual(h.calls, []);
});

test('unknown menu id is a no-op that warns', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const h = harness();
  createShortcutsService(h.deps).dispatchMenuAction('nope.nothing');
  assert.deepEqual(h.calls, []);
  assert.deepEqual(warn.mock.calls[0]?.arguments, ['unknown menu action', 'nope.nothing']);
});

function key(over: Partial<KeyLike>): KeyLike & { prevented: boolean } {
  const e = {
    key: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    prevented: false,
    preventDefault(): void {
      e.prevented = true;
    },
    ...over,
  };
  return e;
}

test('Esc closes overlays one at a time in priority order', () => {
  const h = harness();
  for (const name of ESC_PRIORITY) h.open.add(name);
  h.state.reading = true;
  const svc = createShortcutsService(h.deps);
  for (let i = 0; i < ESC_PRIORITY.length + 1; i++) svc.onEsc(key({ key: 'Escape' }));
  assert.deepEqual(h.calls, [...ESC_PRIORITY.map((n) => `close:${n}`), 'settings.exitReadingMode']);
});

test('ESC_PRIORITY matches the original App.vue order', () => {
  assert.deepEqual(ESC_PRIORITY, [
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
  ]);
});

test('Esc closes the topmost open overlay only', () => {
  const h = harness();
  h.open.add('help');
  h.open.add('settings');
  createShortcutsService(h.deps).onEsc(key({ key: 'Escape' }));
  assert.deepEqual(h.calls, ['close:help']);
});

test('non-Escape keys do nothing in onEsc', () => {
  const h = harness();
  h.open.add('help');
  createShortcutsService(h.deps).onEsc(key({ key: 'a' }));
  assert.deepEqual(h.calls, []);
});

test('Esc with nothing open and not reading is a no-op', () => {
  const h = harness();
  createShortcutsService(h.deps).onEsc(key({ key: 'Escape' }));
  assert.deepEqual(h.calls, []);
});

const ZOOM_TABLE: ReadonlyArray<[Partial<KeyLike>, string]> = [
  [{ metaKey: true, key: '=' }, 'settings.zoomIn'],
  [{ ctrlKey: true, key: '+' }, 'settings.zoomIn'],
  [{ metaKey: true, key: '-' }, 'settings.zoomOut'],
  [{ metaKey: true, key: '0' }, 'settings.resetZoom'],
  [{ metaKey: true, shiftKey: true, key: '+' }, 'settings.editorFontIn'],
  [{ ctrlKey: true, shiftKey: true, key: '_' }, 'settings.editorFontOut'],
  [{ metaKey: true, shiftKey: true, key: '0' }, 'settings.resetEditorFontSize'],
  [{ metaKey: true, ctrlKey: true, key: '=' }, 'settings.previewFontIn'],
  [{ metaKey: true, ctrlKey: true, shiftKey: true, key: '-' }, 'settings.previewFontOut'],
  [{ metaKey: true, ctrlKey: true, key: '0' }, 'settings.resetPreviewFontSize'],
];

for (const [over, expected] of ZOOM_TABLE) {
  test(`onZoomShortcut ${JSON.stringify(over)} -> ${expected}`, () => {
    const h = harness();
    const e = key(over);
    assert.equal(createShortcutsService(h.deps).onZoomShortcut(e), true);
    assert.equal(e.prevented, true);
    assert.deepEqual(h.calls, [expected]);
  });
}

test('onZoomShortcut ignores no-modifier, alt and non-zoom keys', () => {
  const h = harness();
  const svc = createShortcutsService(h.deps);
  for (const over of [{ key: '=' }, { metaKey: true, altKey: true, key: '=' }, { metaKey: true, key: 'k' }]) {
    const e = key(over);
    assert.equal(svc.onZoomShortcut(e), false);
    assert.equal(e.prevented, false);
  }
  assert.deepEqual(h.calls, []);
});

test('onEsc runs the zoom shortcut first and stops', () => {
  const h = harness();
  h.open.add('help');
  createShortcutsService(h.deps).onEsc(key({ metaKey: true, key: '0' }));
  assert.deepEqual(h.calls, ['settings.resetZoom']);
});

test('syncNativeMenu pushes menu config then language preference', async () => {
  const h = harness();
  createShortcutsService(h.deps).syncNativeMenu({ 'file.new': 'Mod+Alt+N' }, 'he');
  await flush();
  assert.deepEqual(h.calls, ['setMenuConfig:he:{"file.new":"CmdOrCtrl+Alt+N"}', 'saveLanguagePreference:he']);
});

test('syncNativeMenu swallows port failures', async () => {
  const h = harness();
  h.deps.windowCommandsPort.setMenuConfig = () => Promise.reject(new Error('x'));
  h.deps.settingsPort.saveLanguagePreference = () => Promise.reject(new Error('y'));
  createShortcutsService(h.deps).syncNativeMenu({}, 'en');
  await flush();
});

test('syncQuickCaptureShortcut registers the chord when enabled and returns empty error', async () => {
  const h = harness();
  const err = await createShortcutsService(h.deps).syncQuickCaptureShortcut(true, 'Alt+Space');
  assert.equal(err, '');
  assert.deepEqual(h.calls, ['quickCaptureSetShortcut:Alt+Space']);
});

test('syncQuickCaptureShortcut unregisters with null when disabled', async () => {
  const h = harness();
  await createShortcutsService(h.deps).syncQuickCaptureShortcut(false, 'Alt+Space');
  assert.deepEqual(h.calls, ['quickCaptureSetShortcut:null']);
});

test('syncQuickCaptureShortcut returns the error text on failure', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const h = harness();
  const err = await createShortcutsService(h.deps).syncQuickCaptureShortcut(true, 'Taken');
  assert.equal(err, 'Error: already registered');
});

test('event handlers open help, toggle search, open CJK proofread', () => {
  const h = harness();
  const svc = createShortcutsService(h.deps);
  svc.onOpenHelpEvent();
  svc.onOpenSearchEvent();
  svc.onOpenCjkProofreadEvent();
  assert.deepEqual(h.calls, ['open:help', 'toggleGlobalSearch', 'open:cjkProofread']);
});

test('start listens to the native menu and the DOM menu event; stop removes both', async () => {
  const h = harness();
  const svc = createShortcutsService(h.deps);
  await svc.start();
  assert.deepEqual(h.calls, [`listen:${MENU_EVENT}`]);
  h.menuHandler()?.({ event: MENU_EVENT, id: 1, payload: 'file.save' });
  h.menuHandler()?.({ event: MENU_EVENT, id: 2, payload: '' });
  h.domTarget.dispatchEvent(new CustomEvent(MENU_DOM_EVENT, { detail: 'file.open' }));
  h.domTarget.dispatchEvent(new CustomEvent(MENU_DOM_EVENT, { detail: '' }));
  assert.deepEqual(h.calls.slice(1), ['files.saveActive', 'files.openFile']);
  svc.stop();
  assert.equal(h.unlistenCount(), 1);
  h.domTarget.dispatchEvent(new CustomEvent(MENU_DOM_EVENT, { detail: 'file.new' }));
  svc.stop();
  assert.equal(h.unlistenCount(), 1);
  assert.deepEqual(h.calls.slice(3), []);
});

test('start warns and still adds the DOM listener when menu listen fails', async () => {
  const warn = mock.method(console, 'warn', () => {});
  const h = harness();
  h.deps.eventsPort.listen = () => Promise.reject(new Error('no tauri'));
  const svc = createShortcutsService(h.deps);
  await svc.start();
  assert.equal(warn.mock.calls[0]?.arguments[0], 'menu listener not available');
  h.domTarget.dispatchEvent(new CustomEvent(MENU_DOM_EVENT, { detail: 'file.new' }));
  assert.deepEqual(h.calls, ['files.newFile']);
  svc.stop();
  warn.mock.restore();
});
