import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { groupSlotOptions, importIdFor, isPairedTheme, parseSlotValue, slotValue } from './picker.ts';
import type { Theme } from './schema.ts';

const load = (id: string): Theme => JSON.parse(readFileSync(new URL(`./builtin/${id}.json`, import.meta.url), 'utf8'));
const solomd = load('solomd');
const nord = load('nord');
const mine: Theme = { ...nord, id: 'my-nord', name: 'My Nord', source: 'mine' };

test('groups options by source in fixed order and drops empty groups', () => {
  const groups = groupSlotOptions([mine, solomd, nord], 'dark');
  assert.deepEqual(groups.map((g) => g.source), ['builtin', 'mine']);
});

test('only variants of the requested mode are offered', () => {
  const values = groupSlotOptions([solomd], 'light').flatMap((g) => g.options.map((o) => o.value));
  assert.ok(values.length > 0);
  for (const v of values) assert.equal(solomd.variants[parseSlotValue(v).variant].mode, 'light');
});

test('slot value round-trips', () => {
  const ref = { themeId: 'nord', variant: 'dark' };
  assert.deepEqual(parseSlotValue(slotValue(ref)), ref);
});

test('a theme with both modes is paired, so picking it fills both slots', () => {
  assert.equal(isPairedTheme(solomd), true);
  const single: Theme = { ...nord, variants: { dark: nord.variants.dark } };
  assert.equal(isPairedTheme(single), false);
  assert.equal(isPairedTheme(undefined), false);
});

test('import id: built-in collision gets a my- prefix', () => {
  assert.deepEqual(importIdFor('nord', [solomd, nord]), { id: 'my-nord', replaces: false });
});

test('import id: existing mine theme is replaced in place', () => {
  assert.deepEqual(importIdFor('my-nord', [nord, mine]), { id: 'my-nord', replaces: true });
});

test('import id: fresh id is unchanged', () => {
  assert.deepEqual(importIdFor('fresh', [solomd, nord]), { id: 'fresh', replaces: false });
});

test('import id: prefixed collision gets a numeric suffix', () => {
  const taken: Theme = { ...mine, id: 'my-nord-2' };
  const other: Theme = { ...mine, id: 'my-nord' };
  assert.equal(importIdFor('nord', [nord, other, taken]).id, 'my-nord-3');
});

test('import id: a 64-char colliding id stays within the limit', () => {
  const long = 'a'.repeat(64);
  const builtin: Theme = { ...nord, id: long };
  const first = importIdFor(long, [builtin]);
  assert.ok(first.id.length <= 64);
  const clash: Theme = { ...mine, id: first.id };
  const second = importIdFor(long, [builtin, clash]);
  assert.ok(second.id.length <= 64);
  assert.notEqual(second.id, first.id);
});
