import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { hadStoredSettings, useSettingsStore } from './settings';
import { useToastsStore } from './toasts';
import { parseTheme, type Theme, type ThemeMode, type Variant } from '../lib/theme/schema';
import { resolveVariant, type ResolvedVariant } from '../lib/theme/resolve';
import { findVariant, legacyForMigration, pickSlot, type ActiveVariant } from '../lib/theme/slots';
import { bundledThemes, loadMyThemes, removeMyTheme, saveMyTheme } from '../lib/theme/sources';
import { applyTheme } from '../lib/theme/apply';
import { convertMarketplaceCss } from '../lib/theme/from-css';
import { THEME_LAYER_VERSION, marketplaceIdFor, planMigration, type LegacyThemeSettings } from '../lib/theme/migrate';

const DARK_QUERY = '(prefers-color-scheme: dark)';
type Report = { name: string; dropped: string[] };
type CssMeta = { id: string; name: string; author?: string };

export const useThemeStore = defineStore('theme', {
  state: () => ({
    themes: bundledThemes() as Theme[],
    loaded: false,
    systemDark: window.matchMedia(DARK_QUERY).matches,
    preview: null as Variant | null,
    revision: 0,
    lastReport: null as Report | null,
  }),
  getters: {
    mode(): ThemeMode {
      if (this.preview) return this.preview.mode;
      return pickSlot(useSettingsStore().appearance, this.systemDark);
    },
    active(): ActiveVariant {
      const s = useSettingsStore();
      const ref = this.mode === 'dark' ? s.darkSlot : s.lightSlot;
      return findVariant(this.themes, ref, this.mode);
    },
    resolved(): ResolvedVariant {
      return resolveVariant(this.preview ?? this.active.variant);
    },
  },
  actions: {
    async init() {
      window.matchMedia(DARK_QUERY).addEventListener('change', (e) => {
        this.systemDark = e.matches;
      });
      await this.reloadMine();
      await this.migrateOnce();
      this.loaded = true;
    },
    async reloadMine() {
      const { themes, errors } = await loadMyThemes();
      this.themes = [...bundledThemes(), ...themes];
      for (const e of errors) useToastsStore().warning(`Theme skipped: ${e}`);
    },
    async migrateOnce() {
      const s = useSettingsStore();
      if (s.themeLayerVersion >= THEME_LAYER_VERSION) return;
      const plan = planMigration(legacyForMigration(hadStoredSettings(), s as LegacyThemeSettings));
      for (const t of plan.themesToWrite) await saveMyTheme(t).catch(() => undefined);
      if (plan.cssToConvert) await this.migrateCss(plan.cssToConvert);
      s.applyMigration(plan, THEME_LAYER_VERSION);
      await this.reloadMine();
    },
    async migrateCss(path: string) {
      try {
        const { content } = await invoke<{ content: string }>('read_file', { path });
        const name = (path.split(/[\\/]/).pop() ?? path).replace(/\.css$/i, '');
        await this.importCss(content, { id: marketplaceIdFor(path), name });
      } catch (e) {
        useToastsStore().warning(`Could not convert ${path}: ${String(e)}`);
      }
    },
    paint() {
      applyTheme(this.resolved);
      this.revision += 1;
    },
    async save(theme: Theme) {
      await saveMyTheme(theme);
      await this.reloadMine();
    },
    async remove(id: string) {
      await removeMyTheme(id);
      await this.reloadMine();
    },
    useTheme(id: string) {
      const theme = this.themes.find((t) => t.id === id);
      if (!theme) return;
      const s = useSettingsStore();
      for (const [key, v] of Object.entries(theme.variants)) s.setSlot(v.mode, { themeId: id, variant: key });
    },
    async importCss(css: string, meta: CssMeta): Promise<Theme> {
      const { theme, dropped } = convertMarketplaceCss(css, meta);
      await this.save(theme);
      this.lastReport = { name: theme.name, dropped };
      return theme;
    },
    async importJson(text: string): Promise<Theme> {
      const r = parseTheme(JSON.parse(text));
      if (!r.ok) throw new Error(r.error);
      const theme: Theme = { ...r.theme, source: 'mine', origin: 'json' };
      await this.save(theme);
      this.lastReport = { name: theme.name, dropped: [] };
      return theme;
    },
    previewVariant(v: Variant | null) {
      this.preview = v;
    },
  },
});
