import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePlainTabEdit, computeSmartEnter, type TextareaLike } from './plain-edits.ts';

const ta = (value: string, selectionStart: number, selectionEnd = selectionStart): TextareaLike => ({
  value,
  selectionStart,
  selectionEnd,
});

test('tab with caret inserts two spaces', () => {
  assert.deepEqual(computePlainTabEdit(ta('abc', 1), false), { value: 'a  bc', selStart: 3, selEnd: 3 });
});
test('tab over a multi-line selection indents every line', () => {
  const r = computePlainTabEdit(ta('a\nb\nc', 0, 3), false);
  assert.equal(r.value, '  a\n  b\nc');
  assert.equal(r.selStart, 2);
  assert.equal(r.selEnd, 7);
});
test('shift-tab outdents two spaces or a tab', () => {
  assert.equal(computePlainTabEdit(ta('  a\n\tb', 0, 6), true).value, 'a\nb');
});
test('shift-tab on an unindented line is a no-op', () => {
  assert.deepEqual(computePlainTabEdit(ta('abc', 1), true), { value: 'abc', selStart: 1, selEnd: 1 });
});
test('enter after a bullet continues the list', () => {
  assert.deepEqual(computeSmartEnter(ta('- item', 6)), { value: '- item\n- ', caret: 9 });
});
test('enter on an empty bullet ends the list', () => {
  const r = computeSmartEnter(ta('- item\n- ', 9));
  assert.ok(r);
  assert.ok(!r.value.endsWith('- '));
});
test('enter on plain text returns null', () => {
  assert.equal(computeSmartEnter(ta('hello', 5)), null);
});
