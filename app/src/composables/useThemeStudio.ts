import { computed, ref, watchEffect } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { useThemeStore } from '../stores/theme';
import { studioToTheme } from '../lib/theme/from-studio';
import { pickSlot } from '../lib/theme/slots';
import { flashColorFor, type Palette, type ThemeMode, type UserTheme } from '../lib/user-theme';

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

/**
 * While the studio is open its draft is the live preview; closing hands the app back to the slots.
 * The mode comes from the slots, not `themeStore.mode`: that getter reads `preview`, which this effect writes.
 */
export function installStudioPreview(): void {
  const themeStore = useThemeStore();
  const settings = useSettingsStore();
  watchEffect(() => {
    const d = draft.value;
    if (!studioOpen.value || !d) {
      themeStore.previewVariant(null);
      return;
    }
    const mode = previewFamily.value ?? pickSlot(settings.appearance, themeStore.systemDark);
    const flashed = { ...d, light: flashedPalette(d.light, 'light'), dark: flashedPalette(d.dark, 'dark') };
    const saved = themeStore.themes.find((t) => t.id === d.id);
    themeStore.previewVariant(studioToTheme(flashed, saved).variants[mode]);
  });
}

export function useThemeStudio() {
  return { studioOpen, draft, savedSnapshot, isDirty, previewFamily, flash };
}
