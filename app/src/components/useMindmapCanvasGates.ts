import type { MindElixirInstance } from 'mind-elixir';
import { useSettingsStore } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import { shortcutLabel } from '../lib/keybindings';
import { isMacOS } from '../lib/platform';
import { createGateController, type GateMenuAction, type GateNotice } from '../lib/mindmap/gate-controller';

const GATE_MENU_LABEL_KEYS: Record<GateMenuAction, string> = {
  'mindmap.markGateTarget': 'mindmap.gateMarkTarget',
  'mindmap.insertGate': 'mindmap.gateInsert',
  'mindmap.followGate': 'mindmap.gateFollow',
  'mindmap.gateBack': 'mindmap.gateBackMenu',
  'mindmap.repairGate': 'mindmap.gateRepair',
  'mindmap.removeGate': 'mindmap.gateRemove',
};

export interface GatesDeps {
  getMind(): MindElixirInstance | null;
  isEditBlocked(): boolean;
  scheduleSync(): void;
}

export function useMindmapCanvasGates(deps: GatesDeps) {
  const settings = useSettingsStore();
  const toasts = useToastsStore();
  const { t } = useI18n();

  function gateMenuLabels(): Record<GateMenuAction, string> {
    const labels: Record<GateMenuAction, string> = { ...GATE_MENU_LABEL_KEYS };
    for (const id of Object.keys(GATE_MENU_LABEL_KEYS) as GateMenuAction[]) labels[id] = t(GATE_MENU_LABEL_KEYS[id]);
    return labels;
  }

  function gateMenuKeys(): Partial<Record<GateMenuAction, string>> {
    const ids = Object.keys(GATE_MENU_LABEL_KEYS) as GateMenuAction[];
    return Object.fromEntries(ids.map((id) => [id, shortcutLabel(id, settings.keybindings, isMacOS())]));
  }

  return createGateController({
    getMind: deps.getMind,
    isReadOnly: () => deps.isEditBlocked(),
    brokenLabel: () => t('mindmap.gateBroken'),
    notify: (key: GateNotice) => toasts.info(t(`mindmap.${key}`)),
    onChange: deps.scheduleSync,
  }, gateMenuLabels(), gateMenuKeys());
}
