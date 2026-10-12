import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  interceptedBindings, HOTKEY_INTERCEPTIONS, KEY_ACTIONS, activeKeyActions, resolveBindings, conflictFor, eventToCombo, MINDMAP_BUILTIN_OWNER,
} from './keybindings.ts';

test('the AMD/IME clashes are only reported on Windows', () => {
  assert.equal(interceptedBindings({}, 'mac').length, 0);
  assert.equal(interceptedBindings({}, 'linux').length, 0);
  assert.ok(interceptedBindings({}, 'windows').length >= 8);
});

test('every listed chord belongs to an action that ships with it', () => {
  const defaults = new Set(activeKeyActions('windows').flatMap((a) => a.defaults));
  for (const h of HOTKEY_INTERCEPTIONS) {
    assert.ok(defaults.has(h.combo), `${h.combo} is not a default of any action`);
  }
});

test('no alternative lands on a chord another action already owns', () => {
  const owners = new Map<string, string>();
  for (const a of activeKeyActions('windows')) for (const c of a.defaults) owners.set(c, a.id);
  for (const b of interceptedBindings({}, 'windows')) {
    const owner = owners.get(b.alternative);
    assert.ok(!owner || owner === b.action.id, `${b.alternative} is taken by ${owner}`);
  }
});

test('a binding the user already moved is left alone', () => {
  const before = interceptedBindings({}, 'windows').map((b) => b.action.id);
  assert.ok(before.includes('file.import'));
  const after = interceptedBindings({ 'file.import': 'Mod+Alt+Shift+L' }, 'windows').map(
    (b) => b.action.id,
  );
  assert.ok(!after.includes('file.import'));
});

test('an unbound action is not reported', () => {
  const after = interceptedBindings({ 'view.toggleReading': null }, 'windows').map(
    (b) => b.action.id,
  );
  assert.ok(!after.includes('view.toggleReading'));
});

test('the preset would leave nothing intercepted', () => {
  const overrides: Record<string, string> = {};
  for (const b of interceptedBindings({}, 'windows')) overrides[b.action.id] = b.alternative;
  assert.deepEqual(interceptedBindings(overrides, 'windows'), []);
});

test('search: a chord query matches the chord, not the letters in it', async () => {
  const { filterKeyActions, KEY_ACTIONS } = await import('./keybindings.ts');
  const ids = (q: string) => filterKeyActions(KEY_ACTIONS, q, (a) => a.label).map((a) => a.id);
  assert.deepEqual(ids('ctrl shift k'), ['palette.open']);
  assert.deepEqual(ids('⌘⇧K'), ['palette.open']);
  assert.deepEqual(ids('cmd+k'), ['fmt.link']);
  assert.deepEqual(ids('ctrl \\'), ['tile.splitRight']);
  assert.ok(ids('bold').includes('fmt.bold'));
  assert.ok(ids('heading').length >= 6);
});

function keyEvent(init: Partial<KeyboardEvent>): KeyboardEvent {
  return { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false, code: '', key: '', ...init } as KeyboardEvent;
}

test('mindmap actions never reach the global dispatcher', () => {
  const global = resolveBindings({});
  const mindmapCategoryIds = new Set(KEY_ACTIONS.filter((a) => a.category === 'mindmap').map((a) => a.id));
  for (const id of global.values()) assert.ok(!mindmapCategoryIds.has(id), id);
});

test('mindmap scope resolves its own defaults', () => {
  const scoped = resolveBindings({}, 'mindmap');
  assert.equal(scoped.get('Space'), 'mindmap.toggleNode');
  assert.equal(scoped.get('Mod+Alt+0'), 'mindmap.fit');
  assert.equal(scoped.get('Home'), 'mindmap.focusRoot');
  assert.equal(scoped.get('Shift+Slash'), 'mindmap.shortcutHelp');
  for (const id of scoped.values()) assert.ok(id.startsWith('mindmap.'), id);
});

test('conflicts are reported only within one scope', () => {
  assert.equal(conflictFor('Mod+Shift+R', 'mindmap.fit', {}), null);
  assert.equal(conflictFor('Space', 'mindmap.fit', {}), 'mindmap.toggleNode');
});

test('space bar and question mark produce bindable combos', () => {
  assert.equal(eventToCombo(keyEvent({ key: ' ', code: 'Space' })), 'Space');
  assert.equal(eventToCombo(keyEvent({ key: '?', code: 'Slash', shiftKey: true })), 'Shift+Slash');
  assert.equal(eventToCombo(keyEvent({ key: 'º', code: 'Digit0', altKey: true, metaKey: true })), 'Mod+Alt+0');
});

test('mindmap rebinds that hit a Mind Elixir built-in are conflicts', () => {
  assert.equal(conflictFor('Tab', 'mindmap.fit', {}), MINDMAP_BUILTIN_OWNER);
  assert.equal(conflictFor('Mod+Z', 'mindmap.toggleNode', {}), MINDMAP_BUILTIN_OWNER);
  assert.notEqual(conflictFor('Tab', 'file.new', {}), MINDMAP_BUILTIN_OWNER);
});
