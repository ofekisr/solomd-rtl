import { ref, watchEffect } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { themeOverride, type ThemeOverride } from '../lib/themes';
import { applyUserTheme, type ThemeMode, type UserTheme } from '../lib/user-theme';
import type { Theme } from '../types';

/**
 * Shared Theme Studio state. While the studio is open its draft owns the
 * palette, so every colour pick repaints the real app; closing hands the
 * palette back to the saved active theme.
 */
const studioOpen = ref(false);
const draft = ref<UserTheme | null>(null);
/** Light/dark the studio is previewing. Never written to settings, so closing leaves the user's theme choice as it was. */
const previewFamily = ref<ThemeMode | null>(null);

const CUSTOM_CSS_STYLE_ID = 'solomd-custom-theme';

export function effectiveTheme(): Theme {
  if (studioOpen.value && previewFamily.value) return previewFamily.value;
  return useSettingsStore().theme;
}

export function effectiveThemeOverride(): ThemeOverride {
  if (studioOpen.value && draft.value) return 'user';
  return themeOverride(useSettingsStore());
}

/** Call once from App: keeps the injected palette in step with studio + settings. */
export function installUserThemeSync(): void {
  const settings = useSettingsStore();
  watchEffect(() => {
    const saved = settings.userThemes.find((ut) => ut.id === settings.activeUserThemeId) ?? null;
    const shown = studioOpen.value && draft.value ? draft.value : saved;
    applyUserTheme(shown ? { ...shown, light: { ...shown.light }, dark: { ...shown.dark } } : null);
    const customCss = document.getElementById(CUSTOM_CSS_STYLE_ID) as HTMLStyleElement | null;
    if (customCss) customCss.disabled = !!shown;
  });
}

export function useThemeStudio() {
  return { studioOpen, draft, previewFamily };
}
