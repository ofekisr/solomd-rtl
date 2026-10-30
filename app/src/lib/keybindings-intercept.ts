import {
  activeKeyActions,
  currentPlatform,
  type KeyActionDef,
  type KeyCombo,
} from './keybindings-actions.ts';
import { normalizeCombo } from './keybindings-combo.ts';
import { combosFor } from './keybindings-resolve.ts';

/**
 * Chords another program takes over before SoloMD can see them.
 *
 * Reported from a Windows 10 machine with an AMD card (2026-09-20): AMD
 * Software's global hotkeys swallow most of the Ctrl+Shift row, so those
 * commands simply never fire — the driver's own overlay answers instead.
 * Microsoft Pinyin takes one more. These are *global* hotkeys, registered by
 * the other program at the OS level, so there is nothing the app can do at
 * runtime except say so and offer somewhere else to put the command.
 *
 * Defaults deliberately stay as they are: most people do not run this
 * software, and moving everyone's keys to dodge one vendor's overlay costs
 * more muscle memory than it saves. The settings panel flags the affected
 * rows and offers the alternatives below in one click.
 *
 * Only chords that are really *intercepted* belong here. Ctrl+Shift+P is a
 * habit clash with VS Code's palette, not an interception, and listing it
 * would blur what this table means.
 */
export interface HotkeyInterception {
  /** The chord, as `combosFor` spells it. */
  combo: KeyCombo;
  /** What takes it — shown to the user verbatim. */
  source: string;
  platforms: ('mac' | 'windows' | 'linux')[];
  /** Where the compatibility preset moves the command. */
  alternative: KeyCombo;
}

const AMD = 'AMD Software: Adrenalin Edition';

export const HOTKEY_INTERCEPTIONS: HotkeyInterception[] = [
  { combo: 'Mod+Shift+L', source: AMD, platforms: ['windows'], alternative: 'Mod+Alt+Shift+L' },
  { combo: 'Mod+Shift+R', source: AMD, platforms: ['windows'], alternative: 'Mod+Alt+R' },
  { combo: 'Mod+Shift+E', source: AMD, platforms: ['windows'], alternative: 'Mod+Alt+E' },
  { combo: 'Mod+Shift+C', source: AMD, platforms: ['windows'], alternative: 'Mod+Alt+Shift+C' },
  { combo: 'Mod+Shift+I', source: AMD, platforms: ['windows'], alternative: 'Mod+Alt+I' },
  { combo: 'Mod+Shift+J', source: AMD, platforms: ['windows'], alternative: 'Mod+Alt+J' },
  { combo: 'Mod+Shift+S', source: AMD, platforms: ['windows'], alternative: 'Mod+Alt+S' },
  { combo: 'Mod+Shift+O', source: AMD, platforms: ['windows'], alternative: 'Mod+Alt+O' },
  { combo: 'Mod+Shift+F', source: 'Microsoft Pinyin', platforms: ['windows'], alternative: 'Mod+Alt+F' },
];

export interface InterceptedBinding {
  action: KeyActionDef;
  combo: KeyCombo;
  source: string;
  alternative: KeyCombo;
}

/**
 * Which bindings *currently in effect* are intercepted on this platform.
 *
 * Reads the effective chords, so a user who already moved a command off the
 * clashing key is not told about it again, and the preset has nothing left to
 * do for them. An alternative already taken by something else is dropped
 * rather than offered — the preset must never create a conflict of its own.
 */
export function interceptedBindings(
  overrides: Record<string, string | null | undefined> = {},
  platform: 'mac' | 'windows' | 'linux' = currentPlatform(),
): InterceptedBinding[] {
  // Resolved here rather than via `combosFor`, which looks actions up against
  // the *running* platform — that would read the wrong table whenever a
  // caller (a test, mostly) pins a different one.
  const effective = (action: KeyActionDef): KeyCombo[] => {
    const override = overrides[action.id];
    if (override === null) return [];
    return override ? [normalizeCombo(override)] : action.defaults.map(normalizeCombo);
  };
  const actions = activeKeyActions(platform);
  const taken = new Map<KeyCombo, string>();
  for (const action of actions) {
    for (const combo of effective(action)) taken.set(combo, action.id);
  }
  const out: InterceptedBinding[] = [];
  for (const action of actions) {
    for (const combo of effective(action)) {
      const hit = HOTKEY_INTERCEPTIONS.find(
        (h) => normalizeCombo(h.combo) === combo && h.platforms.includes(platform),
      );
      if (!hit) continue;
      const alternative = normalizeCombo(hit.alternative);
      const owner = taken.get(alternative);
      if (owner && owner !== action.id) continue;
      out.push({ action, combo, source: hit.source, alternative });
    }
  }
  return out;
}

/**
 * The "writer" preset: Mod+B is bold, as in Typora, Word and every rich-text
 * box on the web, and the file tree moves to where bold was. It is a swap, so
 * it can never leave either command without a key or create a conflict.
 */
export const WRITER_PRESET: Record<string, KeyCombo> = {
  'fmt.bold': 'Mod+B',
  'view.toggleFileTree': 'Mod+Shift+B',
};

/** True when both halves of the swap are in effect (however they got there). */
export function writerPresetActive(
  overrides: Record<string, string | null | undefined> = {},
): boolean {
  return Object.entries(WRITER_PRESET).every(([id, combo]) => {
    const now = combosFor(id, overrides);
    return now.length === 1 && now[0] === normalizeCombo(combo);
  });
}
