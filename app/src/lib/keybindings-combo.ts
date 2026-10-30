import type { KeyCombo } from './keybindings-actions.ts';

/** Keys whose `event.key` is punctuation — spelled by code for stability. */
export const PUNCT_BY_CODE: Record<string, string> = {
  Comma: ',',
  Slash: '/',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Semicolon: ';',
  Quote: "'",
  Period: '.',
  Backquote: '`',
};
const CODE_BY_PUNCT: Record<string, string> = Object.fromEntries(
  Object.entries(PUNCT_BY_CODE).map(([code, ch]) => [ch, code]),
);

/**
 * Normalized chord for a keydown, or null when the event carries no usable
 * key (a bare modifier, an IME composition).
 *
 * The `event.code` preference for Alt combos is load-bearing, not a style
 * choice: macOS composes Option+letter into another glyph (⌥C arrives as
 * "ç", ⌥N as "Dead"), so matching on `event.key` would make every Alt
 * shortcut silently dead there. Scoped to Alt so non-Latin layouts keep
 * using `key` for everything else.
 */
export function eventToCombo(e: KeyboardEvent): KeyCombo | null {
  if (e.isComposing) return null;
  const raw = e.key;
  if (!raw || raw === 'Dead' || raw === 'Unidentified') {
    // Alt on macOS can produce "Dead" — fall through to the code path below
    // rather than dropping the event.
    if (!(e.altKey && /^(Key[A-Z]|Digit\d)$/.test(e.code))) return null;
  }
  if (['Control', 'Meta', 'Shift', 'Alt', 'CapsLock'].includes(raw)) return null;

  let key: string;
  if (e.altKey && /^Key[A-Z]$/.test(e.code)) {
    key = e.code.slice(3).toUpperCase();
  } else if (e.altKey && /^Digit\d$/.test(e.code)) {
    // Same story for the number row: ⌥8 arrives as "•", ⌥7 as "¶".
    key = e.code.slice(5);
  } else if (PUNCT_BY_CODE[e.code]) {
    key = e.code;
  } else if (/^F\d{1,2}$/.test(raw)) {
    key = raw;
  } else if (raw === ' ') {
    key = 'Space';
  } else if (raw.length === 1) {
    key = raw.toUpperCase();
  } else {
    key = raw; // ArrowLeft, Enter, Escape, Tab, Backspace…
  }

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Mod');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}

/** Canonical ordering, so `Shift+Mod+k` and `Mod+Shift+K` are one binding. */
export function normalizeCombo(combo: string): KeyCombo {
  const parts = combo.split('+').map((p) => p.trim()).filter(Boolean);
  const key = parts.pop() ?? '';
  const mods = new Set(parts.map((p) => p.toLowerCase()));
  const out: string[] = [];
  if (mods.has('mod') || mods.has('cmd') || mods.has('ctrl') || mods.has('control') || mods.has('meta')) out.push('Mod');
  if (mods.has('alt') || mods.has('option')) out.push('Alt');
  if (mods.has('shift')) out.push('Shift');
  const punctCode = CODE_BY_PUNCT[key];
  out.push(punctCode ?? (key.length === 1 ? key.toUpperCase() : key));
  return out.join('+');
}

/** Human-readable chord: `⌘⇧K` on macOS, `Ctrl+Shift+K` elsewhere. */
export function formatCombo(combo: KeyCombo, isMac: boolean): string {
  const parts = combo.split('+');
  const key = parts.pop() ?? '';
  const has = (m: string) => parts.includes(m);
  const shown = PUNCT_BY_CODE[key] ?? key.replace(/^Arrow/, '');
  if (isMac) {
    return `${has('Mod') ? '⌘' : ''}${has('Alt') ? '⌥' : ''}${has('Shift') ? '⇧' : ''}${shown}`;
  }
  const mods = [has('Mod') && 'Ctrl', has('Alt') && 'Alt', has('Shift') && 'Shift'].filter(Boolean);
  return [...mods, shown].join('+');
}

/** `Mod+Shift+K` → `CmdOrCtrl+Shift+K` (Tauri's accelerator grammar). */
export function toTauriAccelerator(combo: KeyCombo): string {
  const parts = combo.split('+');
  const key = parts.pop() ?? '';
  const out: string[] = [];
  if (parts.includes('Mod')) out.push('CmdOrCtrl');
  if (parts.includes('Alt')) out.push('Alt');
  if (parts.includes('Shift')) out.push('Shift');
  const named: Record<string, string> = {
    Comma: 'Comma', Slash: 'Slash', BracketLeft: 'BracketLeft', BracketRight: 'BracketRight',
    Backslash: 'Backslash', Minus: 'Minus', Equal: 'Equal', Semicolon: 'Semicolon',
    Quote: 'Quote', Period: 'Period', Backquote: 'Backquote',
  };
  out.push(named[key] ?? key);
  return out.join('+');
}

/**
 * `Mod+Shift+K` → `Mod-Shift-k`, CodeMirror's keymap spelling. Used for the
 * one editor-level chord that is user-bindable (AI rewrite); the popup
 * navigation keys stay hard-wired because they only mean anything while a
 * popup is open.
 */
export function toCodeMirrorKey(combo: KeyCombo): string {
  const parts = combo.split('+');
  const key = parts.pop() ?? '';
  const out: string[] = [];
  if (parts.includes('Mod')) out.push('Mod');
  if (parts.includes('Alt')) out.push('Alt');
  if (parts.includes('Shift')) out.push('Shift');
  const punct: Record<string, string> = {
    Comma: ',', Slash: '/', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
    Minus: '-', Equal: '=', Semicolon: ';', Quote: "'", Period: '.', Backquote: '`',
  };
  out.push(punct[key] ?? (key.length === 1 ? key.toLowerCase() : key));
  return out.join('-');
}
