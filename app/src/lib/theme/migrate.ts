import type { UserTheme } from '../user-theme.ts';
import { DEFAULT_SLOTS, LEGACY_TO_SLOT, type LegacyTheme, type SlotRef } from './legacy.ts';
import { fromUserTheme } from './from-studio.ts';
import { marketplaceIdFor } from './ids.ts';
import type { Theme } from './schema.ts';

export { marketplaceIdFor };
export const THEME_LAYER_VERSION = 2;

export type Appearance = 'light' | 'dark' | 'system';
export type LegacyThemeSettings = {
  theme?: string;
  customCssPath?: string;
  activeUserThemeId?: string;
  userThemes?: UserTheme[];
};
export type MigrationPlan = {
  appearance: Appearance;
  lightSlot: SlotRef;
  darkSlot: SlotRef;
  themesToWrite: Theme[];
  cssToConvert: string | null;
};
type SlotPair = Pick<MigrationPlan, 'lightSlot' | 'darkSlot'>;
type ModePlan = SlotPair & { appearance: Appearance };

const DEFAULT_PAIR: SlotPair = { lightSlot: DEFAULT_SLOTS.light, darkSlot: DEFAULT_SLOTS.dark };

function builtinPlan(name: string | undefined): ModePlan {
  const slot = name ? LEGACY_TO_SLOT[name as LegacyTheme] : undefined;
  if (!slot) return { appearance: 'system', ...DEFAULT_PAIR };
  const variantsOfTheme = Object.values(LEGACY_TO_SLOT).filter((s) => s.themeId === slot.themeId);
  return {
    appearance: slot.variant,
    lightSlot: variantsOfTheme.find((s) => s.variant === 'light') ?? DEFAULT_PAIR.lightSlot,
    darkSlot: variantsOfTheme.find((s) => s.variant === 'dark') ?? DEFAULT_PAIR.darkSlot,
  };
}

function bothSlots(themeId: string): SlotPair {
  return { lightSlot: { themeId, variant: 'light' }, darkSlot: { themeId, variant: 'dark' } };
}

function studioSlots(legacy: LegacyThemeSettings, written: Theme[]): SlotPair | null {
  const activeId = legacy.activeUserThemeId;
  if (!activeId || !written.some((t) => t.id === activeId)) return null;
  return bothSlots(activeId);
}

function customCssSlots(cssPath: string | undefined): (SlotPair & { cssToConvert: string }) | null {
  if (!cssPath) return null;
  return { ...bothSlots(marketplaceIdFor(cssPath)), cssToConvert: cssPath };
}

export function planMigration(legacy: LegacyThemeSettings | null): MigrationPlan {
  if (!legacy) return { ...builtinPlan(undefined), themesToWrite: [], cssToConvert: null };
  const themesToWrite = (legacy.userThemes ?? []).map(fromUserTheme);
  const base = builtinPlan(legacy.theme);
  const studio = studioSlots(legacy, themesToWrite);
  if (studio) return { ...base, ...studio, themesToWrite, cssToConvert: legacy.customCssPath || null };
  const css = customCssSlots(legacy.customCssPath);
  if (css) return { ...base, ...css, themesToWrite };
  return { ...base, themesToWrite, cssToConvert: null };
}
