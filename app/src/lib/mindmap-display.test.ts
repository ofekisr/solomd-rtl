import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MAP_DISPLAY, arrowMainBranch, arrowSubBranch, parseMapDisplay, resolveMapDisplay, straightMainBranch, straightSubBranch } from './mindmap-display.ts';

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

test('parseMapDisplay keeps a known theme and drops an unknown one', () => {
  assert.deepEqual(parseMapDisplay({ theme: 'forest' }), { theme: 'forest' });
  assert.deepEqual(parseMapDisplay({ theme: 'neon' }), {});
});

test('resolveMapDisplay resolves theme override → default → preset default', () => {
  assert.equal(resolveMapDisplay({ theme: 'mono' }, { theme: 'ocean' }).theme, 'mono');
  assert.equal(resolveMapDisplay({}, { theme: 'ocean' }).theme, 'ocean');
  assert.equal(resolveMapDisplay({}, {}).theme, 'default');
});

test('down layout branches run from parent bottom-center to child top-center', () => {
  const box = { pT: 0, pL: 0, pW: 100, pH: 40, cT: 100, cL: 200, cW: 80, cH: 30, direction: 'down' };
  assert.equal(straightMainBranch(box), 'M 50 40 L 240 100');
  assert.equal(straightSubBranch(box), 'M 50 40 L 240 100');
});

test('arrow branches are the straight segment plus a two-wing head at the child', () => {
  const box = { pT: 0, pL: 0, pW: 100, pH: 40, cT: 100, cL: 0, cW: 100, cH: 30, direction: 'down' };
  const path = arrowSubBranch(box);
  assert.ok(path.startsWith('M 50 40 L 50 100 M '), path);
  assert.match(path, / L 50 100 L /);
  const wings = [...path.matchAll(/M ([\d.-]+) ([\d.-]+) L 50 100 L ([\d.-]+) ([\d.-]+)$/g)][0];
  assert.ok(wings, path);
  assert.ok(Number(wings[2]) < 100 && Number(wings[4]) < 100, 'wings sit above the tip');
  assert.ok(Math.abs(Number(wings[1]) + Number(wings[3]) - 100) < 0.05, 'wings are symmetric around x=50');
});

test('arrow main branch on the left side points at the child right edge', () => {
  const box = { pT: 0, pL: 300, pW: 100, pH: 40, cT: 100, cL: 100, cW: 80, cH: 30, direction: 'lhs' };
  assert.ok(arrowMainBranch(box).startsWith('M 350 20 L 180 115 M '));
});

test('parseMapDisplay accepts the arrow branch style', () => {
  assert.deepEqual(parseMapDisplay({ branchStyle: 'arrow' }), { branchStyle: 'arrow' });
});

test('foldedCount accepts known modes and defaults to both', () => {
  assert.deepEqual(parseMapDisplay({ foldedCount: 'direct' }), { foldedCount: 'direct' });
  assert.deepEqual(parseMapDisplay({ foldedCount: true }), {});
  assert.equal(resolveMapDisplay({}, {}).foldedCount, 'both');
  assert.equal(resolveMapDisplay({}, { foldedCount: 'off' }).foldedCount, 'off');
  assert.equal(resolveMapDisplay({ foldedCount: 'all' }, { foldedCount: 'off' }).foldedCount, 'all');
});
