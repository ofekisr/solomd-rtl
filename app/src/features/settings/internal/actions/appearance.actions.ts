import type { SlotRef } from '../../../../lib/theme/legacy.ts';
import type { Appearance, MigrationPlan } from '../../../../lib/theme/migrate.ts';
import type { UserTheme } from '../../../../lib/user-theme.ts';
import type { SettingsThis } from './settings-this.ts';

export const appearanceActions = {
  setAppearance(this: SettingsThis, appearance: Appearance) {
    this.appearance = appearance;
    this.persist();
  },
  setSlot(this: SettingsThis, mode: 'light' | 'dark', ref: SlotRef) {
    if (mode === 'light') this.lightSlot = ref;
    else this.darkSlot = ref;
    this.persist();
  },
  applyMigration(this: SettingsThis, plan: MigrationPlan, version: number) {
    this.appearance = plan.appearance;
    this.lightSlot = plan.lightSlot;
    this.darkSlot = plan.darkSlot;
    this.themeLayerVersion = version;
    this.persist();
  },
  /** Toolbar button: flip to the other mode of what is showing now. */
  toggleTheme(this: SettingsThis, currentMode: 'light' | 'dark') {
    this.setAppearance(currentMode === 'dark' ? 'light' : 'dark');
  },
  saveUserTheme(this: SettingsThis, theme: UserTheme) {
    const i = this.userThemes.findIndex((ut) => ut.id === theme.id);
    if (i === -1) this.userThemes.push(theme);
    else this.userThemes.splice(i, 1, theme);
    this.persist();
  },
  deleteUserTheme(this: SettingsThis, id: string) {
    this.userThemes = this.userThemes.filter((ut) => ut.id !== id);
    if (this.activeUserThemeId === id) this.activeUserThemeId = '';
    this.persist();
  },
};
