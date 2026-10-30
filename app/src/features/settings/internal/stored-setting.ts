import { SETTINGS_STORAGE_KEY } from '../contracts/settings-slice.port.ts';
import type { Settings, SettingsKey } from './settings-types.ts';

export function readStoredSetting<K extends SettingsKey>(key: K): Settings[K] | undefined {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return undefined;
    return (parsed as Partial<Settings>)[key];
  } catch {
    return undefined;
  }
}
