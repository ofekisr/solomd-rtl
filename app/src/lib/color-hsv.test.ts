import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hexToHsv, hsvToHex } from './color-hsv.ts';

describe('color-hsv', () => {
  it('reads primaries and greys', () => {
    assert.deepEqual(hexToHsv('#ff0000'), { h: 0, s: 1, v: 1 });
    assert.deepEqual(hexToHsv('#00ff00'), { h: 120, s: 1, v: 1 });
    assert.deepEqual(hexToHsv('#0000ff'), { h: 240, s: 1, v: 1 });
    assert.deepEqual(hexToHsv('#000000'), { h: 0, s: 0, v: 0 });
  });

  it('round-trips colours', () => {
    for (const hex of ['#67e8b9', '#0d1424', '#ffffff', '#c084fc', '#808080', '#ff00c8']) {
      assert.equal(hsvToHex(hexToHsv(hex)), hex);
    }
  });

  it('treats junk as black', () => {
    assert.deepEqual(hexToHsv('nope'), { h: 0, s: 0, v: 0 });
  });
});
