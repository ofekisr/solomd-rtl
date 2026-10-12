import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isHoverPanActive, type HoverPanState } from './mindmap-hover-pan.ts';

const idle: HoverPanState = { isToggled: false, isAltDown: false, pointerType: 'mouse', buttons: 0, isPaused: false };

test('option held pans when the toggle is off', () => {
  assert.equal(isHoverPanActive(idle), false);
  assert.equal(isHoverPanActive({ ...idle, isAltDown: true }), true);
});

test('the toggle inverts option', () => {
  assert.equal(isHoverPanActive({ ...idle, isToggled: true }), true);
  assert.equal(isHoverPanActive({ ...idle, isToggled: true, isAltDown: true }), false);
});

test('pressed buttons, non-mouse pointers and pauses never pan', () => {
  const active = { ...idle, isAltDown: true };
  assert.equal(isHoverPanActive({ ...active, buttons: 1 }), false);
  assert.equal(isHoverPanActive({ ...active, pointerType: 'pen' }), false);
  assert.equal(isHoverPanActive({ ...active, isPaused: true }), false);
});
