import type { Theme, ThemeMode, Variant } from './schema.ts';
import type { Appearance, LegacyThemeSettings } from './migrate.ts';
import { DEFAULT_SLOTS, type SlotRef } from './legacy.ts';

export type ActiveVariant = { theme: Theme; variantKey: string; variant: Variant };

export function pickSlot(appearance: Appearance, systemDark: boolean): ThemeMode {
  if (appearance !== 'system') return appearance;
  return systemDark ? 'dark' : 'light';
}

function lookup(themes: Theme[], ref: SlotRef, mode: ThemeMode): ActiveVariant | null {
  const theme = themes.find((t) => t.id === ref.themeId);
  if (!theme) return null;
  const exact = theme.variants[ref.variant];
  if (exact?.mode === mode) return { theme, variantKey: ref.variant, variant: exact };
  const key = Object.keys(theme.variants).find((k) => theme.variants[k].mode === mode);
  return key ? { theme, variantKey: key, variant: theme.variants[key] } : null;
}

export function findVariant(themes: Theme[], ref: SlotRef, mode: ThemeMode): ActiveVariant {
  const found = lookup(themes, ref, mode) ?? lookup(themes, DEFAULT_SLOTS[mode], mode);
  if (!found) throw new Error('built-in SoloMD theme missing');
  return found;
}

export function legacyAfterCss(legacy: LegacyThemeSettings | null, cssConverted: boolean): LegacyThemeSettings | null {
  if (!legacy || cssConverted) return legacy;
  return { ...legacy, customCssPath: '' };
}

export function canApplyMigration(failedWrites: string[]): boolean {
  return failedWrites.length === 0;
}

export function legacyForMigration(hadStoredSettings: boolean, state: LegacyThemeSettings): LegacyThemeSettings | null {
  return hadStoredSettings ? state : null;
}

export function slotsForPick(theme: Theme, variantKey: string): Partial<Record<ThemeMode, SlotRef>> {
  const keys = Object.keys(theme.variants);
  const pickedKey = keys.includes(variantKey) ? variantKey : keys[0];
  const picks: Partial<Record<ThemeMode, SlotRef>> = {};
  for (const key of [...keys].reverse()) picks[theme.variants[key].mode] = { themeId: theme.id, variant: key };
  picks[theme.variants[pickedKey].mode] = { themeId: theme.id, variant: pickedKey };
  return picks;
}

export function normalizeSlotRef(raw: unknown, mode: ThemeMode): SlotRef {
  const ref = raw as Partial<SlotRef> | null;
  const isValid = typeof ref?.themeId === 'string' && typeof ref.variant === 'string' && ref.themeId !== '' && ref.variant !== '';
  return isValid ? { themeId: ref.themeId as string, variant: ref.variant as string } : { ...DEFAULT_SLOTS[mode] };
}
