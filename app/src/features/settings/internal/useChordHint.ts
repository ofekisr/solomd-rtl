import { shortcutLabel } from '../../../lib/keybindings';
import { isMacOS } from '../../../lib/platform';
import { useI18n } from '../../../i18n';
import { useSettingsStore } from '../../../stores/settings';

const MISSING_CHORD = '—';

/** #180 — the chord in a hint comes from the user's bindings, not from a literal baked into the translation. */
export function useChordHint(): (key: string, actionId: string) => string {
  const { t } = useI18n();
  const macChord = isMacOS();
  const settings = useSettingsStore();
  return (key, actionId) => t(key, { key: shortcutLabel(actionId, settings.keybindings, macChord) || MISSING_CHORD });
}
