import { computed, ref, watchEffect } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { themeOverride, type ThemeOverride } from '../lib/themes';
import {
  CUSTOM_CSS_BASE,
  applyUserTheme,
  fitBackdrops,
  flashColorFor,
  hasCustomCssLoaded,
  isLightColor,
  readThemePalette,
  type Palette,
  type ThemeMode,
  type UserTheme,
} from '../lib/user-theme';
import { customCssRevision } from '../lib/custom-theme';
import type { Theme } from '../types';

/**
 * Shared Theme Studio state. While the Theme page in Settings is showing, its
 * draft owns the palette, so every colour pick repaints the real app; leaving
 * the page hands the palette back to the saved active theme. The draft itself
 * survives leaving the page, so unsaved work is still there on return.
 */
const studioOpen = ref(false);
const draft = ref<UserTheme | null>(null);
/** JSON of the draft as last saved ('' for a theme never saved). */
const savedSnapshot = ref('');
/** Light/dark the studio is previewing. Never written to settings, so closing leaves the user's theme choice as it was. */
const previewFamily = ref<ThemeMode | null>(null);
/** A token blinking in a loud colour, to show where it is used. */
const flash = ref<{ mode: ThemeMode; key: string; color: string } | null>(null);

const isDirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== savedSnapshot.value);

const FLASH_BLINKS = 6;
const FLASH_STEP_MS = 220;
let flashTimer: ReturnType<typeof setInterval> | null = null;

export function effectiveTheme(): Theme {
  if (studioOpen.value && previewFamily.value) return previewFamily.value;
  return useSettingsStore().theme;
}

export function effectiveThemeOverride(): ThemeOverride {
  if (studioOpen.value && draft.value) return 'user';
  return themeOverride(useSettingsStore());
}

/** The palette as it should be painted right now, with any blinking token swapped in. */
export function flashedPalette(palette: Palette, mode: ThemeMode): Palette {
  const f = flash.value;
  if (!f || f.mode !== mode) return palette;
  return { ...palette, [f.key]: f.color };
}

/** Blink `key` a few times in a loud colour, everywhere it is used. */
export function locateToken(mode: ThemeMode, key: string, current: string): void {
  if (flashTimer) clearInterval(flashTimer);
  const color = flashColorFor(current);
  let step = 0;
  flash.value = { mode, key, color };
  flashTimer = setInterval(() => {
    step += 1;
    flash.value = step % 2 === 0 ? { mode, key, color } : null;
    if (step < FLASH_BLINKS) return;
    clearInterval(flashTimer as ReturnType<typeof setInterval>);
    flashTimer = null;
    flash.value = null;
  }, FLASH_STEP_MS);
}

const cssLightness = new Map<string, boolean>();

/** Whether the loaded CSS theme paints `mode` light; read once per CSS revision. */
export function customCssIsLight(mode: ThemeMode): boolean | null {
  const key = `${customCssRevision.value}:${mode}`;
  if (!hasCustomCssLoaded()) return null;
  if (!cssLightness.has(key)) cssLightness.set(key, isLightColor(readThemePalette(CUSTOM_CSS_BASE, mode)['--bg']));
  return cssLightness.get(key) as boolean;
}

function shownTheme(theme: UserTheme): UserTheme {
  const flashed = { ...theme, light: flashedPalette(theme.light, 'light'), dark: flashedPalette(theme.dark, 'dark') };
  return fitBackdrops(flashed, customCssIsLight);
}

/**
 * Call once from App: keeps the injected palette in step with studio + settings.
 * A custom CSS theme stays on underneath, so its gradients and component
 * styling survive; the user theme only replaces its colours.
 */
export function installUserThemeSync(): void {
  const settings = useSettingsStore();
  watchEffect(() => {
    const saved = settings.userThemes.find((ut) => ut.id === settings.activeUserThemeId) ?? null;
    const shown = studioOpen.value && draft.value ? draft.value : saved;
    applyUserTheme(shown ? shownTheme(shown) : null);
  });
}

export function useThemeStudio() {
  return { studioOpen, draft, savedSnapshot, isDirty, previewFamily, flash };
}
