import { useI18n } from '../../../i18n';
import { useSettingsStore } from '../../../stores/settings';
import { shortcutLabel } from '../../../lib/keybindings';
import { isMacOS } from '../../../lib/platform';

/** #180 — tooltips show the chord that works right now, not one baked into the translation. */
export function useToolbarTips() {
  const { t } = useI18n();
  const settings = useSettingsStore();
  const macChord = isMacOS();

  function chord(actionId: string): string {
    return shortcutLabel(actionId, settings.keybindings, macChord) || '';
  }

  function tip(labelKey: string, actionId: string): string {
    const label = t(labelKey);
    const key = shortcutLabel(actionId, settings.keybindings, macChord);
    return key ? `${label} (${key})` : label;
  }

  return { tip, chord, macChord };
}
