import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MAP_DISPLAY, parseMapDisplay, resolveMapDisplay, straightMainBranch, straightSubBranch } from './mindmap-display.ts';

test('parseMapDisplay keeps valid keys and drops the rest', () => {
  const parsed = parseMapDisplay({ compact: true, branchStyle: 'zigzag', textColor: '#ff0000', font: 'mono', extra: 1 });
  assert.deepEqual(parsed, { compact: true, textColor: '#ff0000', font: 'mono' });
});

test('parseMapDisplay rejects unsafe colors and non-objects', () => {
  assert.deepEqual(parseMapDisplay({ textColor: 'url(javascript:x)' }), {});
  assert.deepEqual(parseMapDisplay('compact'), {});
  assert.deepEqual(parseMapDisplay(null), {});
});

test('resolveMapDisplay prefers override, then defaults, then built-ins', () => {
  const resolved = resolveMapDisplay({ compact: true }, { compact: false, font: 'serif' });
  assert.deepEqual(resolved, { ...DEFAULT_MAP_DISPLAY, compact: true, font: 'serif' });
});

test('straight branches are single line segments', () => {
  const box = { pT: 0, pL: 0, pW: 100, pH: 40, cT: 100, cL: 200, cW: 80, cH: 30, direction: 'rhs' };
  assert.match(straightMainBranch(box), /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  assert.match(straightSubBranch(box), /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
});

test('left-side branches end on the child right edge', () => {
  const box = { pT: 0, pL: 300, pW: 100, pH: 40, cT: 100, cL: 100, cW: 80, cH: 30, direction: 'lhs' };
  assert.equal(straightSubBranch(box), 'M 300 20 L 180 115');
});
