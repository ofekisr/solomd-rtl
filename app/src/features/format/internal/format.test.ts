import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeView, stateWith } from '../../editor/internal/cm-probe.ts';
import { formatMarkdownInView, transformCaseInView } from './cm-format.ts';
import { formatMath, openTableWith, tableRangeAt } from './doc-commands.ts';
import { CURSOR_MARKER, insertMarkdownInView } from './insert-markdown.ts';

test('transformCaseInView cycles word under caret and selects it', () => {
  const view = fakeView(stateWith([], 'hello world', { anchor: 8 }));
  transformCaseInView(view, 'cycle');
  assert.equal(view.state.doc.toString(), 'hello WORLD');
  const sel = view.state.selection.main;
  assert.deepEqual([sel.anchor, sel.head], [6, 11]);
  assert.equal(view.focused, 1);
});

test('transformCaseInView explicit mode and empty doc', () => {
  const view = fakeView(stateWith([], 'hello world', { anchor: 0, head: 11 }));
  transformCaseInView(view, 'title');
  assert.equal(view.state.doc.toString(), 'Hello World');
  const empty = fakeView(stateWith([], ''));
  transformCaseInView(empty, 'cycle');
  assert.equal(empty.dispatched.length, 0);
});

test('formatMarkdownInView bold', () => {
  const view = fakeView(stateWith([], 'x', { anchor: 0, head: 1 }));
  formatMarkdownInView(view, 'bold');
  assert.equal(view.state.doc.toString(), '**x**');
  assert.equal(view.dispatched[0].userEvent, 'input.format');
  assert.equal(view.dispatched[0].scrollIntoView, true);
  assert.equal(view.focused, 1);
});

test('insertMarkdownInView marker and leading break', () => {
  const v1 = fakeView(stateWith([], 'ab', { anchor: 2 }));
  insertMarkdownInView(v1, `[${CURSOR_MARKER}]()`);
  assert.equal(v1.state.doc.toString(), 'ab[]()');
  assert.equal(v1.state.selection.main.head, 3);
  const v2 = fakeView(stateWith([], 'ab', { anchor: 2 }));
  insertMarkdownInView(v2, '\n---\n');
  assert.equal(v2.state.doc.toString(), 'ab\n\n---\n');
  assert.equal((v2.dispatched[0].changes as { insert: string }).insert, '\n\n---\n');
  const v3 = fakeView(stateWith([], 'ab\n', { anchor: 3 }));
  insertMarkdownInView(v3, '\n---\n');
  assert.equal(v3.state.doc.toString(), 'ab\n\n---\n');
  assert.equal((v3.dispatched[0].changes as { insert: string }).insert, '\n---\n');
});

test('tableRangeAt', () => {
  const src = 'intro\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\nafter';
  const range = tableRangeAt(src, 15);
  assert.ok(range);
  assert.equal(src.slice(range.from, range.to), '| a | b |\n| - | - |\n| 1 | 2 |');
  assert.equal(tableRangeAt(src, 2), null);
});

test('formatMath', () => {
  assert.equal(formatMath('', 0, 0, 'x', false), '$x$');
  assert.equal(formatMath('', 0, 0, 'x', true), '$$\nx\n$$');
  assert.equal(formatMath('see $a$ here', 4, 7, 'x', true), '$$x$$');
  assert.equal(formatMath('a\n$a$\nb', 2, 5, 'x', true), '$$\nx\n$$');
});

test('openTableWith happy path hands the table to the editor and replaces the range', async () => {
  const { tableEditor } = await import('./table-editor-bus.ts');
  const calls: Array<[number, number, string]> = [];
  const src = 'x\n| a |\n| - |\n| 1 |\ny';
  openTableWith(
    { getDoc: () => src, getCaret: () => 4, replaceRange: (f, t, s) => calls.push([f, t, s]) },
    { info: () => undefined },
    (k) => k,
  );
  const session = tableEditor.session!;
  assert.equal(session.source, '| a |\n| - |\n| 1 |');
  session.apply('NEW');
  assert.deepEqual(calls, [[2, 19, 'NEW']]);
  tableEditor.session = null;
});

test('openTableWith toasts on empty doc and when not in table', () => {
  const toasts: string[] = [];
  const notify = { info: (m: string) => toasts.push(m) };
  const doc = (s: string) => ({ getDoc: () => s, getCaret: () => 0, replaceRange: () => undefined });
  openTableWith(doc(''), notify, (k) => k);
  openTableWith(doc('plain text'), notify, (k) => k);
  assert.deepEqual(toasts, ['tableEditor.notInTable', 'tableEditor.notInTable']);
});
