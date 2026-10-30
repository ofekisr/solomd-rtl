import { z } from 'zod';
import type { SlotRef } from '../../../../lib/theme/legacy.ts';
import { DEFAULT_SLOTS } from '../../../../lib/theme/legacy.ts';
import type { Appearance } from '../../../../lib/theme/migrate.ts';
import { normalizeSlotRef } from '../../../../lib/theme/slots.ts';
import type { UserTheme } from '../../../../lib/user-theme.ts';
import { normalizeUserThemes } from '../../../../lib/user-theme.ts';
import type { Theme } from '../../../../types.ts';
import type { SettingsSlice } from '../../contracts/index.ts';

export type AppearanceSettings = {
  theme: Theme;
  // Custom CSS theme override (path to a .css file on disk)
  customCssPath: string;
  // Theme Studio — user-built light+dark palettes; one may be active.
  userThemes: UserTheme[];
  activeUserThemeId: string;
  /** Light / Dark / follow the OS. Picks which slot paints the app. */
  appearance: Appearance;
  lightSlot: SlotRef;
  darkSlot: SlotRef;
  /** 0 until the one-time migration to the theme layer ran. */
  themeLayerVersion: number;
};

const schema = z.object({
  theme: z.enum(['light', 'dark', 'nord', 'solarized-light', 'solarized-dark', 'monokai', 'github-light', 'dracula']),
  customCssPath: z.string(),
  userThemes: z.array(z.custom<UserTheme>()),
  activeUserThemeId: z.string(),
  appearance: z.enum(['light', 'dark', 'system']),
  lightSlot: z.custom<SlotRef>(),
  darkSlot: z.custom<SlotRef>(),
  themeLayerVersion: z.number(),
});

function defaults(): AppearanceSettings {
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    theme: prefersDark ? 'dark' : 'light',
    customCssPath: '',
    userThemes: [],
    activeUserThemeId: '',
    appearance: 'system',
    lightSlot: DEFAULT_SLOTS.light,
    darkSlot: DEFAULT_SLOTS.dark,
    themeLayerVersion: 0,
  };
}

export const appearanceSlice: SettingsSlice<AppearanceSettings> = {
  id: 'appearance',
  schema,
  defaults,
  normalize(parsed, merged) {
    merged.userThemes = normalizeUserThemes(parsed.userThemes);
    if (!merged.userThemes.some((ut) => ut.id === merged.activeUserThemeId)) merged.activeUserThemeId = '';
    if (!['light', 'dark', 'system'].includes(merged.appearance)) merged.appearance = 'system';
    merged.lightSlot = normalizeSlotRef(parsed.lightSlot, 'light');
    merged.darkSlot = normalizeSlotRef(parsed.darkSlot, 'dark');
  },
};
