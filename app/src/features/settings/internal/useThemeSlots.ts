import { useI18n } from '../../../i18n';
import { cssImportIdFor, fileStem } from '../../../lib/theme/ids';
import { groupSlotOptions, isPairedTheme, parseSlotValue, slotValue } from '../../../lib/theme/picker';
import type { Theme as AppTheme, ThemeMode } from '../../../lib/theme/schema';
import { useFiles } from '../../../composables/useFiles';
import { dialogPort, fsPort } from '../../../platform/index.ts';
import { useSettingsStore } from '../../../stores/settings';
import { useTabsStore } from '../../../stores/tabs';
import { useThemeStore } from '../../../stores/theme';
import { useToastsStore } from '../../../stores/toasts';

const SLOT_MODES: readonly { mode: ThemeMode; labelKey: string }[] = [
  { mode: 'light', labelKey: 'settings.lightSlot' },
  { mode: 'dark', labelKey: 'settings.darkSlot' },
];

const SOURCE_LABEL_KEYS: Record<AppTheme['source'], string> = {
  builtin: 'themeStudio.builtIn',
  catalog: 'settings.themeCatalog',
  mine: 'themeStudio.myThemes',
};

const THEME_FILE_EXTENSIONS = ['json', 'css'];

export function useThemeSlots(close: () => void) {
  const { t } = useI18n();
  const settings = useSettingsStore();
  const themeStore = useThemeStore();
  const tabs = useTabsStore();
  const toasts = useToastsStore();
  const files = useFiles();

  function slotGroups(mode: ThemeMode) {
    return groupSlotOptions(themeStore.themes, mode).map((g) => ({
      label: t(SOURCE_LABEL_KEYS[g.source]),
      options: g.options,
    }));
  }

  function currentSlotValue(mode: ThemeMode): string {
    return slotValue(mode === 'light' ? settings.lightSlot : settings.darkSlot);
  }

  function onSlot(mode: ThemeMode, value: string): void {
    const ref = parseSlotValue(value);
    const theme = themeStore.themes.find((th) => th.id === ref.themeId);
    if (isPairedTheme(theme)) themeStore.useTheme(ref.themeId);
    else settings.setSlot(mode, ref);
  }

  function importThemeContent(path: string, content: string): Promise<AppTheme> {
    if (!path.toLowerCase().endsWith('.css')) return themeStore.importJson(content);
    return themeStore.importCss(content, { id: cssImportIdFor(path), name: fileStem(path) });
  }

  async function importThemeFile(): Promise<void> {
    const path = await dialogPort.open({
      multiple: false,
      defaultPath: await files.filePickerStartDir(),
      filters: [{ name: 'Theme', extensions: THEME_FILE_EXTENSIONS }],
    });
    if (typeof path !== 'string') return;
    try {
      const { content } = await fsPort.readFile({ path });
      const theme = await importThemeContent(path, content);
      themeStore.useTheme(theme.id);
    } catch (e) {
      toasts.error(`${t('settings.importFailed')}: ${String((e as Error)?.message ?? e)}`);
    }
  }

  function openThemeStudio(): void {
    tabs.openThemeStudio();
    close();
  }

  return { SLOT_MODES, themeStore, slotGroups, currentSlotValue, onSlot, importThemeFile, openThemeStudio };
}
