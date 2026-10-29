import type { Theme, ThemeMode } from './schema';
import type { SlotRef } from './legacy';
import { MAX_ID_LENGTH } from './tokens.ts';

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

const IMPORT_PREFIX = 'my-';

function withinLimit(base: string, suffix: string): string {
  return base.slice(0, MAX_ID_LENGTH - suffix.length) + suffix;
}

function freeId(base: string, taken: Set<string>): string {
  let candidate = withinLimit(base, '');
  for (let n = 2; taken.has(candidate); n += 1) candidate = withinLimit(base, `-${n}`);
  return candidate;
}

export function importIdFor(id: string, existing: Theme[]): { id: string; replaces: boolean } {
  const match = existing.find((t) => t.id === id);
  if (!match) return { id, replaces: false };
  if (match.source === 'mine') return { id, replaces: true };
  const taken = new Set(existing.map((t) => t.id));
  return { id: freeId(`${IMPORT_PREFIX}${id}`, taken), replaces: false };
}
