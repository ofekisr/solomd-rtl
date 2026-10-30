import { SETTINGS_SLICES, type SettingsSlice } from '../features/settings/contracts/index.ts';

export { SETTINGS_SLICES };

export function settingsSliceKeys(slices: readonly SettingsSlice[] = SETTINGS_SLICES): string[] {
  return slices.flatMap((slice) => Object.keys(slice.defaults()));
}
