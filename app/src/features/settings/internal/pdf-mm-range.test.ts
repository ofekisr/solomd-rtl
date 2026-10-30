import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMmOutOfRange } from './pdf-mm-range.ts';

test('size fields accept 50-500 mm inclusive', () => {
  assert.equal(isMmOutOfRange('customWidthMm', 50), false);
  assert.equal(isMmOutOfRange('customHeightMm', 500), false);
  assert.equal(isMmOutOfRange('customWidthMm', 49.9), true);
  assert.equal(isMmOutOfRange('customHeightMm', 501), true);
});

test('margin fields accept 5-100 mm inclusive', () => {
  for (const f of ['customMarginTopMm', 'customMarginRightMm', 'customMarginBottomMm', 'customMarginLeftMm'] as const) {
    assert.equal(isMmOutOfRange(f, 5), false);
    assert.equal(isMmOutOfRange(f, 100), false);
    assert.equal(isMmOutOfRange(f, 4), true);
    assert.equal(isMmOutOfRange(f, 500), true);
  }
});

test('non-finite input is out of range', () => {
  assert.equal(isMmOutOfRange('customWidthMm', Number.NaN), true);
  assert.equal(isMmOutOfRange('customMarginTopMm', Number.POSITIVE_INFINITY), true);
  assert.equal(isMmOutOfRange('customWidthMm', Number('abc')), true);
});
