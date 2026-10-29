import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowedColor } from './color-syntax.ts';

const ACCEPTED = [
  '#fff', '#ffff', '#ffffff', '#ffffffff', '#AbC', 'transparent',
  'rgb(1, 2, 3)', 'rgba(1, 2, 3, 0.5)', 'rgb(1 2 3 / 50%)', 'hsl(10 20% 30%)', 'hsla(10deg, 20%, 30%, .5)',
  'color-mix(in srgb, #fff 20%, transparent)',
  'color-mix(in srgb, rgb(127, 255, 212) 70%, rgb(255, 250, 188))',
  'color-mix(in oklab, color-mix(in srgb, #fff, #000) 30%, hsl(1 2% 3%))',
];
const REJECTED = [
  'color-mix(in srgb, red, blue) url(evil)',
  'color-mix(in srgb, red, blue) linear-gradient(red, blue)',
  'color-mix(()', 'color-mix(in srgb, #fff, #000))', 'color-mix(in srgb, url(x), #000)',
  'color-mix(in srgb, var(--x), #000)', 'color-mix(in srgb, #fff, #000) #fff',
  'url(x)', 'var(--x)', 'linear-gradient(red, blue)', 'red',
  '#fffff', '#fffffff', '#ff', '#ggg', 'rgb(1, 2, url(x))', 'rgb(1,2,3) url(x)', 'rgb(', '',
  'color-mix(in srgb, #fff 20% 30%, #000)', 'color-mix(in srgb, #fff)', 'color-mix(in srgb;x, #fff, #000)',
];

for (const c of ACCEPTED) test(`accepts ${c}`, () => assert.equal(isAllowedColor(c), true));
for (const c of REJECTED) test(`rejects ${c}`, () => assert.equal(isAllowedColor(c), false));
