import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createFileOpenService, type FileOpenDeps, type FileOpenService } from './file-open.service.ts';

type DragHandler = (e: { payload: unknown }) => Promise<void> | void;

interface Harness {
  deps: FileOpenDeps;
  calls: string[];
  dragHandler: () => DragHandler;
  openedHandler: () => (e: { payload: string }) => Promise<void>;
  unlistened: () => number;
  inserts: Array<{ path: string; paneId: string }>;
}

function installGlobals(search: string): Array<{ path: string; paneId: string }> {
  const inserts: Array<{ path: string; paneId: string }> = [];
  const target = new EventTarget();
  const win = Object.assign(target, {
    devicePixelRatio: 1,
    location: { search },
  });
  target.addEventListener('solomd:insert-image-path', (e) =>
    inserts.push((e as CustomEvent<{ path: string; paneId: string }>).detail),
  );
  Object.assign(globalThis, { window: win, document: Object.assign(new EventTarget(), { visibilityState: 'hidden' }) });
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem() {}, removeItem() {} }, configurable: true });
  return inserts;
}

function makeHarness(search = ''): Harness {
  const inserts = installGlobals(search);
  const calls: string[] = [];
  let drag: DragHandler = () => {};
  let opened: (e: { payload: string }) => Promise<void> = async () => {};
  let unlistened = 0;
  const deps: FileOpenDeps = {
    eventsPort: {
      listen: (async (_name: string, h: (e: { payload: string }) => Promise<void>) => {
        opened = h;
        return () => { unlistened++; };
      }) as FileOpenDeps['eventsPort']['listen'],
    },
    windowPort: {
      deepLink: { onOpenUrl: async () => () => {}, getCurrent: async () => ['file:///cold.md'] },
      currentWebview: () => ({
        setZoom: async () => {},
        onDragDropEvent: async (h) => { drag = h as DragHandler; return () => {}; },
      }),
    },
    androidPort: {
      androidSystemInsets: async () => ({ top: 0, bottom: 0 }),
      androidRestartApp: async () => null,
      androidRequestAllFilesAccess: async () => null,
    },
    windowCommandsPort: { drainPendingOpens: async () => ['/pending.md'] },
    openerPort: { openPath: async () => {} },
    openPath: async (p, o) => { calls.push(`${p}|${o?.bypassNewWindow}`); },
    getActiveFilePath: () => null,
    getSafTreeUri: () => null,
    setFolder() {},
    setSafVault() {},
    isFileTreeShown: () => true,
    toggleFileTree() {},
    showToast: async () => {},
    loadSafFs: async () => ({ safPersistedTrees: async () => [], safResolvePicked: async () => null }),
    setAndroidPickerOpen() {},
    setAndroidRestartNeeded() {},
    getFocusedPaneId: () => 'pane-1',
    isAndroid: () => false,
  };
  return { deps, calls, dragHandler: () => drag, openedHandler: () => opened, unlistened: () => unlistened, inserts };
}

async function runStartup(svc: FileOpenService): Promise<void> {
  await svc.initAndroid();
  await svc.listenOpenedFile();
  svc.listenAndroidEvents();
  await svc.handleDeepLinks();
  await svc.drainPendingOpens();
  await svc.openPathFromQuery();
  await svc.listenDragDrop();
}

describe('file-open.service', () => {
  let h: Harness;
  beforeEach(() => { h = makeHarness('?path=%2Finitial.md'); });

  it('opens deep link cold start once, then drained pending, then ?path= in order', async () => {
    await runStartup(createFileOpenService(h.deps));
    assert.deepEqual(h.calls, ['file:///cold.md|true', '/pending.md|true', '/initial.md|true']);
  });

  it('step methods in App.vue order open files, then drag-drop opens dropped path', async () => {
    const svc = createFileOpenService(h.deps);
    await svc.initAndroid();
    await svc.listenOpenedFile();
    svc.listenAndroidEvents();
    await svc.handleDeepLinks();
    await svc.drainPendingOpens();
    await svc.openPathFromQuery();
    await svc.listenDragDrop();
    assert.deepEqual(h.calls, ['file:///cold.md|true', '/pending.md|true', '/initial.md|true']);
    await h.dragHandler()({ payload: { type: 'drop', paths: ['/c.md'], position: { x: 0, y: 0 } } });
    assert.equal(h.calls.at(-1), '/c.md|true');
  });

  it('opened-file event bypasses new-window routing; stop unlistens once', async () => {
    const svc = createFileOpenService(h.deps);
    await runStartup(svc);
    await h.openedHandler()({ payload: '/os.md' });
    assert.equal(h.calls.at(-1), '/os.md|true');
    svc.stop();
    svc.stop();
    assert.equal(h.unlistened(), 1);
  });

  it('drag-drop routes images to insert event and others to openPath', async () => {
    await runStartup(createFileOpenService(h.deps));
    h.calls.length = 0;
    await h.dragHandler()({ payload: { type: 'drop', paths: ['/a.PNG', '/b.md'], position: { x: 0, y: 0 } } });
    assert.deepEqual(h.inserts, [{ path: '/a.PNG', paneId: 'pane-1' }]);
    assert.deepEqual(h.calls, ['/b.md|true']);
  });

  it('ignores non-drop drag events', async () => {
    await runStartup(createFileOpenService(h.deps));
    h.calls.length = 0;
    await h.dragHandler()({ payload: { type: 'over', position: { x: 0, y: 0 } } });
    assert.deepEqual(h.calls, []);
  });

  it('openExternalFile warns and skips when no active path', async () => {
    let opened = 0;
    h.deps.openerPort = { openPath: async () => { opened++; } };
    await createFileOpenService(h.deps).openExternalFile();
    assert.equal(opened, 0);
  });

  it('onAndroidFolderPick closes picker, sets folder, shows tree if hidden', () => {
    const log: string[] = [];
    h.deps.setAndroidPickerOpen = (o) => log.push(`picker:${o}`);
    h.deps.setFolder = (p) => log.push(`folder:${p}`);
    h.deps.isFileTreeShown = () => false;
    h.deps.toggleFileTree = () => log.push('toggle');
    createFileOpenService(h.deps).onAndroidFolderPick('/x');
    assert.deepEqual(log, ['picker:false', 'folder:/x', 'toggle']);
  });
});
