import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeCombo, resolveBindings } from './keybindings.ts';
import { MINDMAP_BUILTIN_COMBOS, MINDMAP_BUILTIN_KEYS } from './mindmap-keymap.ts';

test('every built-in combo is already normalized', () => {
  for (const { combo } of MINDMAP_BUILTIN_KEYS) assert.equal(normalizeCombo(combo), combo);
});

test('the combo set mirrors the table', () => {
  assert.equal(MINDMAP_BUILTIN_COMBOS.size, MINDMAP_BUILTIN_KEYS.length);
});

test('scoped mindmap defaults do not shadow Mind Elixir built-ins', () => {
  for (const combo of resolveBindings({}, 'mindmap').keys()) {
    assert.ok(!MINDMAP_BUILTIN_COMBOS.has(combo), combo);
  }
});

test('core editing keys are covered', () => {
  for (const combo of ['Tab', 'Enter', 'F2', 'Delete', 'Mod+Z', 'Mod+K']) {
    assert.ok(MINDMAP_BUILTIN_COMBOS.has(combo), combo);
  }
});
