import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMenubarMenus } from './windows-menubar-menus.ts';

const menus = buildMenubarMenus((k) => k, (id) => (id === 'file.save' ? 'Ctrl+S' : ''));

describe('buildMenubarMenus', () => {
  it('builds the four menus', () => {
    assert.deepEqual(Object.keys(menus), ['file', 'edit', 'view', 'help']);
  });
  it('uses the chord lookup for rebindable shortcuts', () => {
    assert.ok(menus.file.some((e) => 'id' in e && e.id === 'file.save' && e.shortcut === 'Ctrl+S'));
  });
  it('falls back to Alt+F4 for exit and keeps fixed edit chords', () => {
    assert.ok(menus.file.some((e) => 'id' in e && e.id === 'file.exit' && e.shortcut === 'Alt+F4'));
    assert.ok(menus.edit.some((e) => 'id' in e && e.id === 'edit.undo' && e.shortcut === 'Ctrl+Z'));
  });
  it('keeps item ids unique', () => {
    const ids = Object.values(menus).flat().filter((e): e is Extract<typeof e, { id: string }> => 'id' in e).map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
