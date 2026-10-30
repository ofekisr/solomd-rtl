import type { ViewMode } from '../../../../types.ts';
import type { Appearance } from '../../../../lib/theme/migrate.ts';
import type { Settings } from '../settings-types.ts';

/** The cross-called actions, typed minimally so no area imports another area's object (no circular types). */
export interface SettingsCalls {
  persist(): void;
  setViewMode(mode: ViewMode): void;
  exitReadingMode(): void;
  setAppearance(appearance: Appearance): void;
  ensureRightSidebarVisible(): void;
  setGlobalZoom(n: number): void;
  setFontSize(n: number): void;
  setPreviewFontSize(n: number): void;
}

export type SettingsThis = Settings & SettingsCalls;
