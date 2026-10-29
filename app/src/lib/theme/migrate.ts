import type { UserTheme } from '../user-theme.ts';
import { DEFAULT_SLOTS, LEGACY_TO_SLOT, type LegacyTheme, type SlotRef } from './legacy.ts';
import { fromUserTheme } from './from-studio.ts';
import { MAX_ID_LENGTH } from './tokens.ts';
import type { Theme } from './schema.ts';

export const THEME_LAYER_VERSION = 1;

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

const MARKETPLACE_PREFIX = 'mk-';
const PATH_SEPARATOR_RE = /[\\/]/;
const CSS_EXTENSION_RE = /\.css$/i;
const LOSSY_CHAR_RE = /[^A-Za-z0-9\s_-]/;
const NON_SLUG_RE = /[^a-z0-9]+/g;
const EDGE_DASH_RE = /^-+|-+$/g;
const HASH_LENGTH = 8;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX_RADIX = 16;
const DEFAULT_PAIR: SlotPair = { lightSlot: DEFAULT_SLOTS.light, darkSlot: DEFAULT_SLOTS.dark };

function fnv1a(text: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), FNV_PRIME);
  return (hash >>> 0).toString(HEX_RADIX).padStart(HASH_LENGTH, '0');
}

function slugOf(stem: string): string {
  return stem.toLowerCase().replace(NON_SLUG_RE, '-').replace(EDGE_DASH_RE, '');
}

function hashedIdFor(stem: string, slug: string): string {
  const room = MAX_ID_LENGTH - MARKETPLACE_PREFIX.length - HASH_LENGTH - 1;
  const head = slug.slice(0, room).replace(EDGE_DASH_RE, '');
  const hash = fnv1a(stem);
  return head ? `${MARKETPLACE_PREFIX}${head}-${hash}` : `${MARKETPLACE_PREFIX}${hash}`;
}

function plainIdFor(slug: string): string | null {
  const fits = slug.length <= MAX_ID_LENGTH - MARKETPLACE_PREFIX.length;
  return fits && slug.length > 0 ? MARKETPLACE_PREFIX + slug : null;
}

export function marketplaceIdFor(cssPath: string): string {
  const fileName = cssPath.split(PATH_SEPARATOR_RE).pop() ?? '';
  const stem = fileName.replace(CSS_EXTENSION_RE, '');
  const slug = slugOf(stem);
  const isLossy = LOSSY_CHAR_RE.test(stem);
  const plain = plainIdFor(slug);
  if (!isLossy && plain) return plain;
  return hashedIdFor(stem, slug);
}

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
  if (studio) return { ...base, ...studio, themesToWrite, cssToConvert: null };
  const css = customCssSlots(legacy.customCssPath);
  if (css) return { ...base, ...css, themesToWrite };
  return { ...base, themesToWrite, cssToConvert: null };
}
