import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLOSED_FLYOUT, isFlyoutKey, moveFlyout, openFlyout, toggleFlyout } from './mindmap-flyout.ts';

test('opening starts on the selected option, or the first one', () => {
  assert.deepEqual(openFlyout(2, 3), { isOpen: true, activeIndex: 2 });
  assert.deepEqual(openFlyout(-1, 3), { isOpen: true, activeIndex: 0 });
  assert.deepEqual(openFlyout(0, 0), CLOSED_FLYOUT);
});

test('toggle closes an open flyout', () => {
  assert.deepEqual(toggleFlyout(openFlyout(1, 3), 1, 3), CLOSED_FLYOUT);
  assert.deepEqual(toggleFlyout(CLOSED_FLYOUT, 1, 3), { isOpen: true, activeIndex: 1 });
});

test('arrow keys wrap around, Home and End jump', () => {
  const open = openFlyout(2, 3);
  assert.equal(moveFlyout(open, 'ArrowDown', 3).activeIndex, 0);
  assert.equal(moveFlyout(openFlyout(0, 3), 'ArrowUp', 3).activeIndex, 2);
  assert.equal(moveFlyout(open, 'Home', 3).activeIndex, 0);
  assert.equal(moveFlyout(openFlyout(0, 3), 'End', 3).activeIndex, 2);
});

test('Escape closes; keys on a closed flyout do nothing', () => {
  assert.deepEqual(moveFlyout(openFlyout(0, 3), 'Escape', 3), CLOSED_FLYOUT);
  assert.deepEqual(moveFlyout(CLOSED_FLYOUT, 'ArrowDown', 3), CLOSED_FLYOUT);
  assert.equal(isFlyoutKey('Tab'), false);
  assert.equal(isFlyoutKey('Escape'), true);
});
