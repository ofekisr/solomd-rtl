import { computed, ref, watch, watchEffect } from 'vue';
import { createOwnerStack } from '../lib/owner-stack';
import { useSettingsStore } from '../stores/settings';
import { useThemeStore } from '../stores/theme';
import { studioToTheme } from '../lib/theme/from-studio';
import { pickSlot } from '../lib/theme/slots';
import { flashColorFor, type Palette, type ThemeMode, type UserTheme } from '../lib/user-theme';

/**
 * Shared Theme Studio state. While a Theme Studio tab is mounted, its draft
 * owns the palette, so every colour pick repaints the real app; closing the
 * tab hands the palette back to the saved active theme. The draft itself
 * survives the tab unmounting, so unsaved work is still there on return.
 */
const previewVersion = ref(0);
const previewOwners = createOwnerStack<symbol>(() => { previewVersion.value += 1; });
const studioOpen = computed(() => {
  void previewVersion.value;
  return previewOwners.size > 0;
});
const draft = ref<UserTheme | null>(null);
/** JSON of the draft as last saved ('' for a theme never saved). */
const savedSnapshot = ref('');
/** Light/dark the studio is previewing. Never written to settings, so closing leaves the user's theme choice as it was. */
const previewFamily = ref<ThemeMode | null>(null);
/** A token blinking in a loud colour, to show where it is used. */
const flash = ref<{ mode: ThemeMode; key: string; color: string } | null>(null);

type SaveHandler = () => Promise<boolean>;

const saveVersion = ref(0);
const saveHandlers = createOwnerStack<SaveHandler>(() => { saveVersion.value += 1; });
const activeSaveHandler = computed<SaveHandler | null>(() => {
  void saveVersion.value;
  return saveHandlers.top() ?? null;
});

/** Mark one mounted studio instance as previewing; call the returned function on unmount. */
function acquirePreview(): () => void {
  return previewOwners.acquire(Symbol('theme-studio-preview'));
}

/** The newest registered handler saves; unregistering removes only this one. */
function registerSave(fn: SaveHandler): () => void {
  return saveHandlers.acquire(fn);
}

let previewTargetCount = 0;

export function nextPreviewTargetId(): string {
  previewTargetCount += 1;
  return `theme-studio-preview-${previewTargetCount}`;
}

const SAVE_HANDLER_WAIT_MS = 2000;

function waitForSaveHandler(): Promise<SaveHandler | null> {
  if (activeSaveHandler.value) return Promise.resolve(activeSaveHandler.value);
  return new Promise((resolve) => {
    const stop = watch(activeSaveHandler, (fn) => {
      if (!fn) return;
      clearTimeout(timer);
      stop();
      resolve(fn);
    });
    const timer = setTimeout(() => {
      stop();
      resolve(null);
    }, SAVE_HANDLER_WAIT_MS);
  });
}

async function saveDraft(): Promise<boolean> {
  const handler = await waitForSaveHandler();
  return handler ? handler() : false;
}

function resetDraft(): void {
  draft.value = null;
  savedSnapshot.value = '';
}

const hasSaveHandler = computed(() => activeSaveHandler.value !== null);

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
  return { studioOpen, draft, savedSnapshot, isDirty, previewFamily, flash, acquirePreview, registerSave, hasSaveHandler, saveDraft, resetDraft };
}
