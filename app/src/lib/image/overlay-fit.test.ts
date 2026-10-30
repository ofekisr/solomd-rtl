import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitDisplaySize, FIT_PADDING } from './overlay-fit.ts';

test('fit: downscales a large image to the padded viewport', () => {
  assert.equal(FIT_PADDING, 80);
  assert.deepEqual(fitDisplaySize(2000, 1000, 1080, 580), { width: 1000, height: 500 });
});

test('fit: upscales at most 2x', () => {
  assert.deepEqual(fitDisplaySize(100, 50, 1080, 580), { width: 200, height: 100 });
});

test('fit: height-limited content', () => {
  assert.deepEqual(fitDisplaySize(1000, 2000, 1080, 580), { width: 250, height: 500 });
});

test('fit: unknown natural size fills the padded viewport', () => {
  assert.deepEqual(fitDisplaySize(0, 0, 1080, 580), { width: 1000, height: 500 });
  assert.deepEqual(fitDisplaySize(10, -1, 1080, 580), { width: 1000, height: 500 });
});
