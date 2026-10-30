/**
 * Rebindable keyboard shortcuts (#180).
 *
 * Until now every app-level shortcut lived in one long if/else chain in
 * `useShortcuts.ts`, which meant the answer to "how do I change a shortcut"
 * was "you can't". This module turns that chain into data: a table of
 * bindable actions with their defaults, plus the combo parsing/formatting
 * both the dispatcher and the settings UI need.
 *
 * Combo syntax is a normalized string — `Mod+Shift+K`, `Mod+Alt+ArrowRight`,
 * `Shift+F3`, `F1`. Parts are ordered Mod, Alt, Shift, key so two spellings
 * of the same chord can never disagree. `Mod` is ⌘ on macOS and Ctrl
 * everywhere else, which is what lets one table serve every platform.
 *
 * Editor-internal keys (CodeMirror's own keymap: ⌘J AI rewrite, list
 * indentation, …) are deliberately NOT here. They live inside the editor's
 * keymap where CodeMirror resolves them against the document context, and
 * folding them into a global table would change when they fire.
 */

import { MINDMAP_BUILTIN_COMBOS } from './mindmap-keymap.ts';
import {
  activeKeyActions,
  scopeOf,
  type KeyActionDef,
  type KeyCombo,
} from './keybindings-actions.ts';
import { PUNCT_BY_CODE, formatCombo, normalizeCombo, toTauriAccelerator } from './keybindings-combo.ts';
import { combosFor } from './keybindings-resolve.ts';

export {
  KEY_ACTIONS,
  activeKeyActions,
  type KeyActionDef,
  type KeyCombo,
  type KeyScope,
} from './keybindings-actions.ts';
export {
  eventToCombo,
  formatCombo,
  normalizeCombo,
  toCodeMirrorKey,
  toTauriAccelerator,
} from './keybindings-combo.ts';
export * from './keybindings-resolve.ts';
export * from './keybindings-intercept.ts';

/**
 * Search over the bindable actions — by name (in the UI language *and* in
 * English, so "bold" finds its translated name), by id, or by the chord itself ("⌘B",
 * "ctrl shift k"). One implementation for the help sheet and the settings
 * list, so the two can never disagree about what a query matches.
 */
export function filterKeyActions(
  actions: KeyActionDef[],
  query: string,
  localizedLabel: (a: KeyActionDef) => string,
  overrides: Record<string, string | null | undefined> = {},
  mac = false,
): KeyActionDef[] {
  const words = query.trim().toLowerCase().split(/[\s+]+/).filter(Boolean);
  if (!words.length) return actions;

  // "ctrl shift k" is a chord, not three words: as text, the lone "k" would
  // match strike, backslash and everything else with a k in it. When the query
  // names a modifier, compare it to the bindings part by part instead.
  const MODS: Record<string, string> = {
    ctrl: 'Mod', control: 'Mod', cmd: 'Mod', command: 'Mod', mod: 'Mod', '⌘': 'Mod', '⌃': 'Mod',
    alt: 'Alt', option: 'Alt', opt: 'Alt', '⌥': 'Alt',
    shift: 'Shift', '⇧': 'Shift',
  };
  // "⌘⇧k" typed without spaces still means three parts.
  const parts = words.flatMap((w) => w.split(/(?=[⌘⌃⌥⇧])|(?<=[⌘⌃⌥⇧])/)).filter(Boolean);
  const wantMods = new Set(parts.filter((w) => MODS[w]).map((w) => MODS[w]));
  const keys = parts.filter((w) => !MODS[w]);
  if (wantMods.size && keys.length <= 1) {
    return actions.filter((a) =>
      combosFor(a.id, overrides).some((c) => {
        const cp = c.split('+');
        const key = cp[cp.length - 1].toLowerCase();
        const mods = new Set(cp.slice(0, -1));
        if (mods.size !== wantMods.size || [...wantMods].some((m) => !mods.has(m))) return false;
        if (!keys.length) return true;
        return key === keys[0] || (PUNCT_BY_CODE[cp[cp.length - 1]] ?? '') === keys[0];
      }),
    );
  }

  return actions.filter((a) => {
    const combos = combosFor(a.id, overrides);
    const hay = [
      localizedLabel(a),
      a.label,
      a.id,
      ...combos,
      ...combos.map((c) => formatCombo(c, mac)),
      // "ctrl" / "cmd" are what people type; the table says "Mod".
      combos.some((c) => c.includes('Mod')) ? 'ctrl cmd command control' : '',
      combos.some((c) => c.includes('Alt')) ? 'option opt' : '',
    ].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Sentinel `conflictFor` returns when a mindmap rebind hits a Mind Elixir key. */
export const MINDMAP_BUILTIN_OWNER = 'mindmap.builtin';

/** Which other action in the same scope already owns this chord, if any. */
export function conflictFor(
  combo: KeyCombo,
  actionId: string,
  overrides: Record<string, string | null | undefined> = {},
): string | null {
  const target = normalizeCombo(combo);
  const actions = activeKeyActions();
  const owner = actions.find((a) => a.id === actionId);
  const scope = owner ? scopeOf(owner) : 'global';
  if (scope === 'mindmap' && MINDMAP_BUILTIN_COMBOS.has(target)) return MINDMAP_BUILTIN_OWNER;
  for (const action of actions) {
    if (action.id === actionId || scopeOf(action) !== scope) continue;
    if (combosFor(action.id, overrides).includes(target)) return action.id;
  }
  return null;
}

/**
 * Menu-item id → Tauri accelerator, for the native menu (#180).
 *
 * An empty string means "strip the accelerator": the action moved to a chord
 * the webview handles, so leaving the old one on the menu would keep firing
 * it and a rebind would only ever *add* a shortcut. Only ids the menu
 * actually carries appear here; `set_menu_config` keeps its built-in default
 * for anything absent.
 */
export function nativeMenuAccelerators(
  overrides: Record<string, string | null | undefined> = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [actionId, menuId] of Object.entries(MENU_ITEM_BY_ACTION)) {
    if (!Object.prototype.hasOwnProperty.call(overrides, actionId)) continue;
    const combos = combosFor(actionId, overrides);
    out[menuId] = combos.length ? toTauriAccelerator(combos[0]) : '';
  }
  return out;
}

/** Menu items whose accelerator mirrors a rebindable action. */
const MENU_ITEM_BY_ACTION: Record<string, string> = {
  'file.new': 'file.new',
  'file.newText': 'file.newText',
  'file.open': 'file.open',
  'file.import': 'file.import',
  'file.save': 'file.save',
  'file.saveAs': 'file.saveAs',
  'file.closeTab': 'file.closeTab',
  'file.openExternal': 'file.openExternal',
  'window.new': 'window.new',
  'file.exit': 'file.exit',
  'export.pdfPrint': 'file.print',
  'view.toggleFileTree': 'view.toggleFileTree',
  'view.toggleRightSidebar': 'view.toggleRightSidebar',
  'view.toggleOutline': 'view.toggleOutline',
  'view.cycleView': 'view.cycleView',
  'search.global': 'search.global',
  'settings.open': 'app.settings',
  'help.markdown': 'help.markdown',
};

/** Formatted primary chord for a UI label, or '' when the action is unbound. */
export function shortcutLabel(
  actionId: string,
  overrides: Record<string, string | null | undefined> = {},
  isMac = false,
): string {
  const combos = combosFor(actionId, overrides);
  return combos.length ? formatCombo(combos[0], isMac) : '';
}
