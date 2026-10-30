import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanAI, dispatchFormat, dispatchInsert, openExternal, shortPath, type TabsLike, type ToastsLike } from './toolbar-actions.ts';

function fakeToasts() {
  const calls: string[] = [];
  const toasts: ToastsLike = {
    warning: (m) => calls.push(`warning:${m}`),
    info: (m) => calls.push(`info:${m}`),
    success: (m) => calls.push(`success:${m}`),
  };
  return { toasts, calls };
}

describe('shortPath', () => {
  it('returns the last segment for posix and windows paths', () => {
    assert.equal(shortPath('/a/b/c.md'), 'c.md');
    assert.equal(shortPath('C:\\a\\b\\c.md'), 'c.md');
  });
  it('falls back to the input when the last segment is empty', () => {
    assert.equal(shortPath('/a/b/'), '/a/b/');
    assert.equal(shortPath('plain'), 'plain');
  });
});

describe('cleanAI', () => {
  it('warns without an active document', () => {
    const { toasts, calls } = fakeToasts();
    cleanAI({ activeTab: null, setContent: () => {} }, toasts);
    assert.deepEqual(calls, ['warning:No active document']);
  });
  it('reports when nothing changes', () => {
    const { toasts, calls } = fakeToasts();
    const tabs: TabsLike = { activeTab: { id: 't', content: 'plain text' }, setContent: () => assert.fail('no write') };
    cleanAI(tabs, toasts);
    assert.deepEqual(calls, ['info:No AI artifacts found']);
  });
});

describe('openExternal', () => {
  it('warns with the given message when the tab has no file', async () => {
    const { toasts, calls } = fakeToasts();
    const opener = { openPath: async () => assert.fail('no open') };
    await openExternal({ tabs: { activeTab: { id: 't', content: '' }, setContent: () => {} }, toasts, opener, noFileMessage: 'no file' });
    assert.deepEqual(calls, ['warning:no file']);
  });
  it('opens the path through the opener and reports failures', async () => {
    const { toasts, calls } = fakeToasts();
    const opened: string[] = [];
    const tabs: TabsLike = { activeTab: { id: 't', content: '', filePath: '/x.md' }, setContent: () => {} };
    await openExternal({ tabs, toasts, opener: { openPath: async (p: string) => { opened.push(p); } }, noFileMessage: '' });
    assert.deepEqual(opened, ['/x.md']);
    await openExternal({ tabs, toasts, opener: { openPath: async () => { throw new Error('boom'); } }, noFileMessage: '' });
    assert.deepEqual(calls, ['warning:Failed: Error: boom']);
  });
});

describe('event dispatchers', () => {
  const events: CustomEvent[] = [];
  const target = new EventTarget();
  const globals = globalThis as unknown as { window?: EventTarget };
  const previous = globals.window;
  beforeEach(() => {
    events.length = 0;
    globals.window = target;
    for (const name of ['solomd:format-markdown', 'solomd:insert-markdown']) {
      target.addEventListener(name, (e) => events.push(e as CustomEvent));
    }
  });
  afterEach(() => { globals.window = previous; });

  it('dispatchFormat sends the kind', () => {
    dispatchFormat('bold');
    assert.equal(events[0]?.type, 'solomd:format-markdown');
    assert.deepEqual(events[0]?.detail, { kind: 'bold' });
  });
  it('dispatchInsert sends snippet and pane id', () => {
    dispatchInsert('x', 'p1');
    assert.equal(events[0]?.type, 'solomd:insert-markdown');
    assert.deepEqual(events[0]?.detail, { snippet: 'x', paneId: 'p1' });
  });
});
