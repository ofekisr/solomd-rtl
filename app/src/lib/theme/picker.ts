import type { Theme, ThemeMode } from './schema';
import type { SlotRef } from './legacy';

export const SLOT_SEP = '::';

export type SlotOption = { value: string; label: string };
export type SlotGroup = { source: Theme['source']; options: SlotOption[] };

const SOURCES: Theme['source'][] = ['builtin', 'catalog', 'mine'];

function optionsFor(theme: Theme, mode: ThemeMode): SlotOption[] {
  return Object.entries(theme.variants)
    .filter(([, v]) => v.mode === mode)
    .map(([key, v]) => ({
      value: `${theme.id}${SLOT_SEP}${key}`,
      label: v.label ? `${theme.name} · ${v.label}` : theme.name,
    }));
}

export function groupSlotOptions(themes: Theme[], mode: ThemeMode): SlotGroup[] {
  return SOURCES.map((source) => ({
    source,
    options: themes.filter((t) => t.source === source).flatMap((t) => optionsFor(t, mode)),
  })).filter((g) => g.options.length > 0);
}

export function slotValue(ref: SlotRef): string {
  return `${ref.themeId}${SLOT_SEP}${ref.variant}`;
}

export function parseSlotValue(value: string): SlotRef {
  const [themeId, variant] = value.split(SLOT_SEP);
  return { themeId, variant };
}

export function isPairedTheme(theme: Theme | undefined): boolean {
  if (!theme) return false;
  const modes = new Set(Object.values(theme.variants).map((v) => v.mode));
  return modes.size > 1;
}
