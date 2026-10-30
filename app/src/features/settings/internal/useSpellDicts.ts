import { ref, type Ref } from 'vue';
import { openerPort, settingsPort } from '../../../platform/index.ts';
import { useToastsStore } from '../../../stores/toasts';

const BUNDLED_DICT = 'en_US';
const RESCAN_DELAY_MS = 1500;

export interface SpellDicts {
  spellDicts: Ref<string[]>;
  refreshSpellDicts: () => Promise<void>;
  openDictsFolder: () => Promise<void>;
}

/**
 * #246 — the dictionaries actually present, so the picker can't offer a
 * language that would fail to load. `spellcheck_list_dicts` scans
 * `<config>/dictionaries/` and always includes the bundled en_US.
 */
export function useSpellDicts(): SpellDicts {
  const toasts = useToastsStore();
  const spellDicts = ref<string[]>([BUNDLED_DICT]);

  async function refreshSpellDicts(): Promise<void> {
    try {
      spellDicts.value = await settingsPort.spellcheckListDicts();
    } catch {
      spellDicts.value = [BUNDLED_DICT];
    }
  }

  /** Create + reveal the folder, then re-scan so a just-added pair shows up. */
  async function openDictsFolder(): Promise<void> {
    try {
      const dir = await settingsPort.spellcheckDictsDir();
      await openerPort.openPath(dir);
      setTimeout(refreshSpellDicts, RESCAN_DELAY_MS);
    } catch (e) {
      toasts.error(`${e}`);
    }
  }

  void refreshSpellDicts();
  return { spellDicts, refreshSpellDicts, openDictsFolder };
}
