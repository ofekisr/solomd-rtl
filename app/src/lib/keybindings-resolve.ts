import {
  activeKeyActions,
  scopeOf,
  type KeyCombo,
  type KeyScope,
} from './keybindings-actions.ts';
import { normalizeCombo } from './keybindings-combo.ts';

/**
 * Effective binding table: defaults with the user's overrides applied.
 *
 * An override of `null` means "unbound" — a user who wants ⌘E back for the
 * browser/OS gets to switch ours off rather than being told to live with it.
 */
export function resolveBindings(
  overrides: Record<string, string | null | undefined> = {},
  scope: KeyScope = 'global',
): Map<KeyCombo, string> {
  const map = new Map<KeyCombo, string>();
  for (const action of activeKeyActions()) {
    if (scopeOf(action) !== scope) continue;
    const override = overrides[action.id];
    if (override === null) continue;
    const combos = override ? [normalizeCombo(override)] : action.defaults.map(normalizeCombo);
    for (const combo of combos) {
      // First writer wins, so an earlier action in the table keeps a chord a
      // later one also asks for. The settings UI surfaces the clash before it
      // gets here; this is the tiebreak for a hand-edited settings file.
      if (!map.has(combo)) map.set(combo, action.id);
    }
  }
  return map;
}

/** The chords currently bound to one action (for display in settings). */
export function combosFor(
  actionId: string,
  overrides: Record<string, string | null | undefined> = {},
): KeyCombo[] {
  const action = activeKeyActions().find((a) => a.id === actionId);
  if (!action) return [];
  const override = overrides[actionId];
  if (override === null) return [];
  return override ? [normalizeCombo(override)] : action.defaults.map(normalizeCombo);
}
