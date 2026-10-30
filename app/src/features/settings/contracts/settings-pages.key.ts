import type { Component, InjectionKey } from 'vue';
import type { PageKey } from '../../../lib/settings-nav';

export interface SettingsPageEntry {
  key: PageKey;
  component: Component;
}

export const SETTINGS_PAGES_KEY: InjectionKey<readonly SettingsPageEntry[]> = Symbol('settings-pages');
