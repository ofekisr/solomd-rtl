export type LegacyTheme = 'light' | 'dark' | 'nord' | 'solarized-light' | 'solarized-dark' | 'monokai' | 'github-light' | 'dracula';
export type SlotRef = { themeId: string; variant: string };

export const LEGACY_TO_SLOT: Record<LegacyTheme, SlotRef & { variant: 'light' | 'dark' }> = {
  light: { themeId: 'solomd', variant: 'light' },
  dark: { themeId: 'solomd', variant: 'dark' },
  nord: { themeId: 'nord', variant: 'dark' },
  'solarized-light': { themeId: 'solarized', variant: 'light' },
  'solarized-dark': { themeId: 'solarized', variant: 'dark' },
  monokai: { themeId: 'monokai', variant: 'dark' },
  'github-light': { themeId: 'github', variant: 'light' },
  dracula: { themeId: 'dracula', variant: 'dark' },
};

export const BUILTIN_NAMES: Record<string, string> = {
  solomd: 'SoloMD', nord: 'Nord', solarized: 'Solarized', monokai: 'Monokai', github: 'GitHub', dracula: 'Dracula',
};

export const BUILTIN_IDS = Object.keys(BUILTIN_NAMES) as readonly string[];

export const DEFAULT_SLOTS = { light: LEGACY_TO_SLOT.light, dark: LEGACY_TO_SLOT.dark } as const;
