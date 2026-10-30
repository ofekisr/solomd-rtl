import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssColorToHex } from './effective-style.ts';

test('rgb converts to hex', () => {
  assert.equal(cssColorToHex('rgb(221, 120, 120)'), '#dd7878');
  assert.equal(cssColorToHex('rgba(0, 0, 0, 0.5)'), '#000000');
});

test('transparent and unparsable values give null', () => {
  assert.equal(cssColorToHex('rgba(0, 0, 0, 0)'), null);
  assert.equal(cssColorToHex('transparent'), null);
  assert.equal(cssColorToHex(''), null);
});
