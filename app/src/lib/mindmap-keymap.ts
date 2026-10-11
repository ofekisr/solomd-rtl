import type { KeyCombo } from './keybindings';

export interface MindmapBuiltinKey {
  combo: KeyCombo;
  label: string;
}

export const MINDMAP_BUILTIN_KEYS: readonly MindmapBuiltinKey[] = [
  { combo: 'Tab', label: 'Add child' },
  { combo: 'Enter', label: 'Add sibling after' },
  { combo: 'Shift+Enter', label: 'Add sibling before' },
  { combo: 'Mod+Enter', label: 'Insert parent' },
  { combo: 'F2', label: 'Edit topic' },
  { combo: 'Delete', label: 'Remove node' },
  { combo: 'Backspace', label: 'Remove node' },
  { combo: 'ArrowUp', label: 'Select previous' },
  { combo: 'ArrowDown', label: 'Select next' },
  { combo: 'ArrowLeft', label: 'Select left' },
  { combo: 'ArrowRight', label: 'Select right' },
  { combo: 'Alt+ArrowUp', label: 'Move node up' },
  { combo: 'Alt+ArrowDown', label: 'Move node down' },
  { combo: 'PageUp', label: 'Move node up' },
  { combo: 'PageDown', label: 'Move node down' },
  { combo: 'Mod+ArrowLeft', label: 'Layout: all left' },
  { combo: 'Mod+ArrowRight', label: 'Layout: all right' },
  { combo: 'Mod+ArrowUp', label: 'Layout: both sides' },
  { combo: 'F1', label: 'Center map' },
  { combo: 'Mod+Equal', label: 'Zoom in' },
  { combo: 'Mod+Minus', label: 'Zoom out' },
  { combo: 'Mod+0', label: 'Reset zoom' },
  { combo: 'Mod+K', label: 'Then 0 collapse all, = expand all, 1–9 expand to level' },
  { combo: 'Mod+Z', label: 'Undo' },
  { combo: 'Mod+Shift+Z', label: 'Redo' },
  { combo: 'Mod+Y', label: 'Redo' },
  { combo: 'Mod+C', label: 'Copy subtree' },
  { combo: 'Mod+X', label: 'Cut subtree' },
  { combo: 'Mod+V', label: 'Paste subtree' },
];

export const MINDMAP_BUILTIN_COMBOS: ReadonlySet<KeyCombo> = new Set(
  MINDMAP_BUILTIN_KEYS.map((k) => k.combo),
);

export function builtinLabelFor(combo: KeyCombo): string | undefined {
  return MINDMAP_BUILTIN_KEYS.find((k) => k.combo === combo)?.label;
}
