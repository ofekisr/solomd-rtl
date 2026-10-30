import test from 'node:test';
import assert from 'node:assert/strict';
import { createWindowService, type WindowDeps } from './window.service.ts';
import { fakePorts } from './fake-ports.ts';

interface Harness {
  deps: WindowDeps;
  ports: ReturnType<typeof fakePorts>;
  doc: { title: string; documentElement: { style: { zoom: string } } };
  zoom: { value: number };
  log: string[];
}

function setUa(ua: string): void {
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ua }, configurable: true });
}

function harness(wheelEnabled = true): Harness {
  const ports = fakePorts();
  const doc = { title: '', documentElement: { style: { zoom: '' } } };
  const zoom = { value: 1 };
  const log: string[] = [];
  const deps: WindowDeps = {
    windowPort: ports.window,
    eventsPort: ports.events,
    windowCommandsPort: ports.windowCommands,
    document: doc,
    isDev: false,
    getGlobalZoom: () => zoom.value,
    setGlobalZoom: (z) => void (zoom.value = z),
    isWheelZoomEnabled: () => wheelEnabled,
    autoSaveDirtyTabs: async () => void log.push('autoSave'),
    persistSession: () => void log.push('persist'),
    reloadWindows: () => void log.push('reload'),
    getAuxLabels: () => ['aux-1', 'aux-2'],
    unregisterWindow: (l) => void log.push(`unregister:${l}`),
    isAuxLabel: (l) => l.startsWith('aux'),
  };
  return { deps, ports, doc, zoom, log };
}

function wheel(deltaY: number) {
  return { ctrlKey: true, metaKey: false, deltaY, preventDefault() {} } as unknown as WheelEvent;
}

test('applyWindowTitle sets document.title and skips setTitle on macOS', async () => {
  setUa('Mozilla/5.0 (Macintosh; Intel Mac OS X)');
  const h = harness();
  await createWindowService(h.deps).applyWindowTitle('a.md');
  assert.equal(h.doc.title, 'a.md — SoloMD');
  assert.deepEqual(h.ports.calls, []);
});

test('applyWindowTitle calls setTitle off macOS and uses bare name when no file', async () => {
  setUa('Mozilla/5.0 (Windows NT 10.0)');
  const h = harness();
  await createWindowService(h.deps).applyWindowTitle();
  assert.equal(h.doc.title, 'SoloMD');
  assert.deepEqual(h.ports.calls, ['window.setTitle:SoloMD']);
});

test('wheel zoom ignores small deltas and steps 0.1 on accumulated delta', () => {
  const h = harness();
  const svc = createWindowService(h.deps);
  svc.onWheelZoom(wheel(-5));
  assert.equal(h.zoom.value, 1);
  svc.onWheelZoom(wheel(-10));
  assert.ok(Math.abs(h.zoom.value - 1.1) < 1e-9);
});

test('wheel zoom does nothing when disabled and requires ctrl/meta', () => {
  const off = harness(false);
  createWindowService(off.deps).onWheelZoom(wheel(-100));
  assert.equal(off.zoom.value, 1);
  const on = harness();
  createWindowService(on.deps).onWheelZoom({ ctrlKey: false, metaKey: false, deltaY: -100, preventDefault() {} } as unknown as WheelEvent);
  assert.equal(on.zoom.value, 1);
});

test('applyZoom sets native zoom and clears css zoom', async () => {
  const h = harness();
  h.doc.documentElement.style.zoom = '2';
  createWindowService(h.deps).applyZoom(1.5);
  await new Promise((r) => setImmediate(r));
  assert.ok(h.ports.calls.includes('window.setZoom:1.5'));
  assert.equal(h.doc.documentElement.style.zoom, '');
});

test('onWindowBlur autosaves', () => {
  const h = harness();
  createWindowService(h.deps).onWindowBlur();
  assert.deepEqual(h.log, ['autoSave']);
});

test('close-requested persists session then force closes', async () => {
  setUa('x');
  const h = harness();
  const svc = createWindowService(h.deps);
  await svc.start();
  await h.ports.events.emit('solomd://close-requested', null);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(h.log.filter((l) => l === 'persist'), ['persist']);
  assert.ok(h.ports.calls.includes('windowCommands.forceCloseWindow'));
});

test('start cleans aux registry on main window; window-destroyed unregisters aux only', async () => {
  const h = harness();
  const svc = createWindowService(h.deps);
  await svc.start();
  assert.deepEqual(h.log, ['reload', 'unregister:aux-1', 'unregister:aux-2']);
  await h.ports.events.emit('solomd://window-destroyed', 'aux-9');
  await h.ports.events.emit('solomd://window-destroyed', 'main');
  assert.deepEqual(h.log.slice(3), ['unregister:aux-9']);
});

test('stop runs only the window-destroyed unlisten, once', async () => {
  const h = harness();
  const svc = createWindowService(h.deps);
  await svc.start();
  svc.stop();
  svc.stop();
  assert.equal(h.ports.calls.filter((c) => c === 'events.unlisten:solomd://window-destroyed').length, 1);
  assert.equal(h.ports.calls.filter((c) => c.startsWith('events.unlisten:solomd://close')).length, 0);
});
