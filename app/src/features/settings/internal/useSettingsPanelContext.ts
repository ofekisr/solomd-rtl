import { inject, provide, type InjectionKey } from 'vue';

export interface SettingsPanelContext {
  close: () => void;
  openThemeMarketplace: () => void;
}

const SETTINGS_PANEL_CONTEXT: InjectionKey<SettingsPanelContext> = Symbol('settings-panel-context');

export function provideSettingsPanelContext(context: SettingsPanelContext): void {
  provide(SETTINGS_PANEL_CONTEXT, context);
}

export function useSettingsPanelContext(): SettingsPanelContext {
  const context = inject(SETTINGS_PANEL_CONTEXT);
  if (!context) throw new Error('settings page rendered outside SettingsPanel');
  return context;
}
