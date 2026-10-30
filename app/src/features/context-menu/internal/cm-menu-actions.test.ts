import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeView, stateWith } from '../../editor/internal/cm-probe.ts';
import { cmSelectionText, runCmMenuAction } from './cm-menu-actions.ts';

function clip(read = '') {
  const written: string[] = [];
  return { written, read: async () => read, write: async (t: string) => { written.push(t); } };
}

test('copy writes selection', async () => {
  const view = fakeView(stateWith([], 'hello', { anchor: 1, head: 3 }));
  const c = clip();
  await runCmMenuAction(view, 'copy', c);
  assert.deepEqual(c.written, ['el']);
  assert.equal(view.focused, 1);
});

test('cut writes and deletes', async () => {
  const view = fakeView(stateWith([], 'hello', { anchor: 1, head: 3 }));
  const c = clip();
  await runCmMenuAction(view, 'cut', c);
  assert.deepEqual(c.written, ['el']);
  assert.equal(view.state.doc.toString(), 'hlo');
  assert.equal(view.dispatched[0].userEvent, 'delete.cut');
});

test('paste inserts', async () => {
  const view = fakeView(stateWith([], 'ab', { anchor: 1 }));
  await runCmMenuAction(view, 'paste', clip('XY'));
  assert.equal(view.state.doc.toString(), 'aXYb');
  assert.equal(view.dispatched[0].userEvent, 'input.paste');
});

test('selectAll', async () => {
  const view = fakeView(stateWith([], 'abc', { anchor: 1 }));
  await runCmMenuAction(view, 'selectAll', clip());
  const s = view.state.selection.main;
  assert.deepEqual([s.from, s.to], [0, 3]);
  assert.equal(view.focused, 1);
});

test('empty selection copy does not write nor focus', async () => {
  const view = fakeView(stateWith([], 'abc', { anchor: 1 }));
  const c = clip();
  await runCmMenuAction(view, 'copy', c);
  assert.deepEqual(c.written, []);
  assert.equal(view.focused, 0);
});

test('cmSelectionText', () => {
  assert.equal(cmSelectionText(null), '');
  assert.equal(cmSelectionText(fakeView(stateWith([], 'abc', { anchor: 1 }))), '');
  assert.equal(cmSelectionText(fakeView(stateWith([], 'abc', { anchor: 0, head: 2 }))), 'ab');
});
