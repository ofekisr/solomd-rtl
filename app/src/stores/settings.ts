import { defineStore } from 'pinia';
import { isMobile } from '../lib/platform';
import {
  SETTINGS_ACTIONS,
  SETTINGS_MIGRATIONS,
  SETTINGS_SLICES,
  SETTINGS_STORAGE_KEY,
  SETTINGS_VERSION_KEY,
  loadSettings,
  type Settings,
} from '../features/settings/contracts/index.ts';

export { defaultPdfDefaults, setRightSidebarShell, type PdfDefaults } from '../features/settings/contracts/index.ts';

// CJK + generic fallback appended after the user's chosen face. This way
// Latin glyphs come from the user's pick while CJK still falls back to
// a real CJK font instead of whatever the generic `monospace` happens to be.
const CJK_FALLBACK =
  '"PingFang SC", "PingFang TC", "Hiragino Sans GB", "Microsoft YaHei", "Heiti SC", "Noto Sans CJK SC"';

export function buildEditorFontStack(face: string): string {
  const trimmed = face.trim();
  if (!trimmed) return `${CJK_FALLBACK}, sans-serif`;
  // If user pasted a full stack already (contains comma), use as-is but still
  // append CJK fallback for safety.
  if (trimmed.includes(',')) return `${trimmed}, ${CJK_FALLBACK}`;
  const needsQuote = /\s/.test(trimmed) && !/^["']/.test(trimmed);
  const quoted = needsQuote ? `"${trimmed}"` : trimmed;
  return `${quoted}, ${CJK_FALLBACK}, "JetBrains Mono", Menlo, Consolas, monospace`;
}

type SettingsState = Settings & { [SETTINGS_VERSION_KEY]: number };

const IS_DEV = import.meta.env?.DEV === true;

function loadFromStorage(): ReturnType<typeof loadSettings> {
  return loadSettings(localStorage.getItem(SETTINGS_STORAGE_KEY), SETTINGS_SLICES, SETTINGS_MIGRATIONS, {
    report: IS_DEV ? console.warn : undefined,
    isMobile: isMobile(),
  });
}

export function defaults(): Settings {
  return Object.assign({}, ...SETTINGS_SLICES.map((slice) => slice.defaults())) as Settings;
}

let hadStoredSettingsAtLoad = false;

export function hadStoredSettings(): boolean {
  return hadStoredSettingsAtLoad;
}

function load(): SettingsState {
  try {
    const { settings, hadStored } = loadFromStorage();
    if (hadStored) hadStoredSettingsAtLoad = true;
    return settings as unknown as SettingsState;
  } catch {
    return defaults() as SettingsState;
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => load(),
  actions: {
    persist() {
      try {
        // v4.3.0 PR #75 — drop transient `_rsPanesBeforeHide` from disk;
        // it's only meaningful for the current session.
        const { _rsPanesBeforeHide, ...rest } = this.$state;
        void _rsPanesBeforeHide;
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(rest));
      } catch {}
    },
    ...SETTINGS_ACTIONS,
  },
});
