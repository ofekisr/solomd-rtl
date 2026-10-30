import test from 'node:test';
import assert from 'node:assert/strict';
import { effectScope } from 'vue';
import type { EditorView } from '@codemirror/view';
import { fakeView, stateWith } from '../../editor/contracts/testkit.ts';
import { useCmContextMenu } from './useCmContextMenu.ts';
import { stubGlobal, stubNavigator } from './stubs.testkit.ts';

interface FakeEvent { pointerType?: string; clientX: number; clientY: number; prevented: boolean; preventDefault(): void }
function event(pointerType?: string): FakeEvent {
  const e: FakeEvent = { pointerType, clientX: 10, clientY: 20, prevented: false, preventDefault() { e.prevented = true; } };
  return e;
}

function setup(doc: string, selection: { anchor: number; head?: number }, hasView = true) {
  const view = fakeView(stateWith([], doc, selection));
  const scope = effectScope();
  const menu = scope.run(() => useCmContextMenu(() => (hasView ? (view as unknown as EditorView) : null)))!;
  return { view, menu };
}

test('touch and pen pointers never open the menu', () => {
  const restore = stubNavigator({ platform: 'Win32' });
  try {
    for (const type of ['touch', 'pen']) {
      const { menu } = setup('abc', { anchor: 0, head: 2 });
      const e = event(type);
      menu.onContextMenu(e as unknown as MouseEvent);
      assert.equal(menu.editorCtx.value, null);
      assert.equal(e.prevented, false);
    }
  } finally { restore(); }
});

test('Android UA leaves the system menu', () => {
  const restore = stubNavigator({ platform: 'Linux armv8l', userAgent: 'Mozilla Android' });
  try {
    const { menu } = setup('abc', { anchor: 0, head: 2 });
    menu.onContextMenu(event('mouse') as unknown as MouseEvent);
    assert.equal(menu.editorCtx.value, null);
  } finally { restore(); }
});

test('non-Windows with empty selection keeps the system menu', () => {
  const restore = stubNavigator({ platform: 'MacIntel' });
  try {
    const { menu } = setup('abc', { anchor: 1 });
    const e = event('mouse');
    menu.onContextMenu(e as unknown as MouseEvent);
    assert.equal(menu.editorCtx.value, null);
    assert.equal(e.prevented, false);
  } finally { restore(); }
});

test('non-Windows with a selection opens our menu', () => {
  const restore = stubNavigator({ platform: 'MacIntel' });
  try {
    const { menu } = setup('abc', { anchor: 0, head: 2 });
    const e = event('mouse');
    menu.onContextMenu(e as unknown as MouseEvent);
    assert.deepEqual(menu.editorCtx.value, { x: 10, y: 20, hasSelection: true });
    assert.equal(e.prevented, true);
  } finally { restore(); }
});

test('Windows always opens the menu, hasSelection reflects the selection', () => {
  const restore = stubNavigator({ platform: 'Win32' });
  try {
    const { menu } = setup('abc', { anchor: 1 });
    menu.onContextMenu(event('mouse') as unknown as MouseEvent);
    assert.deepEqual(menu.editorCtx.value, { x: 10, y: 20, hasSelection: false });
    const noView = setup('abc', { anchor: 1 }, false);
    noView.menu.onContextMenu(event('mouse') as unknown as MouseEvent);
    assert.equal(noView.menu.editorCtx.value?.hasSelection, false);
  } finally { restore(); }
});

test('onMenuAction copy closes the menu and writes the selection', async () => {
  const written: string[] = [];
  const restore = stubNavigator({ platform: 'Win32', clipboard: { writeText: async (t: string) => { written.push(t); } } });
  try {
    const { view, menu } = setup('hello', { anchor: 1, head: 3 });
    menu.onContextMenu(event('mouse') as unknown as MouseEvent);
    await menu.onMenuAction('copy');
    assert.equal(menu.editorCtx.value, null);
    assert.deepEqual(written, ['el']);
    assert.equal(view.focused, 1);
  } finally { restore(); }
});

test('onMenuAction without a view does nothing', async () => {
  const { menu } = setup('hello', { anchor: 0, head: 2 }, false);
  await menu.onMenuAction('copy');
  assert.equal(menu.editorCtx.value, null);
});

test('onMenuAction translate opens google translate with the selection', async () => {
  const opened: string[] = [];
  const restoreNav = stubNavigator({ language: 'fr-FR' });
  const restoreWin = stubGlobal('window', { open: (url: string) => { opened.push(url); } });
  const origWarn = console.warn;
  console.warn = () => undefined;
  try {
    const { view, menu } = setup('hello world', { anchor: 0, head: 5 });
    await menu.onMenuAction('translate');
    assert.equal(opened.length, 1);
    const url = new URL(opened[0]);
    assert.equal(url.searchParams.get('text'), 'hello');
    assert.equal(url.searchParams.get('tl'), 'fr');
    assert.equal(view.focused, 0);
  } finally {
    console.warn = origWarn;
    restoreWin();
    restoreNav();
  }
});
