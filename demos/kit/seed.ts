import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const CONTENT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const TABS_KEY = 'solomd.tabs.v1';
const SETTINGS_KEY = 'solomd.settings.v1';
const SEEDED_FLAG = 'demo.seeded';

export type SeedLanguage = 'markdown' | 'mindmap';
export type SeedLens = 'data' | 'map' | 'doc';

export interface SeedDoc {
  fileName: string;
  content: string;
  language: SeedLanguage;
  mindmapLens?: SeedLens;
}

export type SettingsPatch = Record<string, unknown>;

const BASE_SETTINGS: SettingsPatch = {
  theme: 'light',
  language: 'en',
  restoreSession: true,
  perWorkspaceTabs: false,
  telemetryEnabled: false,
  autoCheckUpdate: false,
  welcomeShown: true,
  agentWizardSeen: true,
  showAgentPanel: false,
  v4AgentPanelMigrated: true,
  showFileTree: false,
  fileTreeDefaultDesktopMigrated: true,
};

export function loadContent(fileName: string): string {
  return readFileSync(path.join(CONTENT_DIR, fileName), 'utf8');
}

export function doc(fileName: string, options: { lens?: SeedLens } = {}): SeedDoc {
  const language: SeedLanguage = fileName.endsWith('.mmap') ? 'mindmap' : 'markdown';
  return { fileName, content: loadContent(fileName), language, mindmapLens: options.lens };
}

function toTabs(docs: SeedDoc[]): Array<Record<string, unknown>> {
  return docs.map((d, index) => ({
    id: `demo-tab-${index}`,
    fileName: d.fileName,
    content: d.content,
    savedContent: d.content,
    encoding: 'UTF-8',
    language: d.language,
    hadBom: false,
    lineEnding: 'lf',
    ...(d.mindmapLens ? { mindmapLens: d.mindmapLens } : {}),
  }));
}

/** Writes tabs + settings once per session (first load only), so in-story reloads keep user edits. */
export async function seed(page: Page, docs: SeedDoc[], settings: SettingsPatch = {}): Promise<void> {
  const tabs = toTabs(docs);
  const payload = {
    tabsKey: TABS_KEY,
    settingsKey: SETTINGS_KEY,
    flag: SEEDED_FLAG,
    tabs: JSON.stringify({ tabs, activeId: tabs[0]?.id ?? '' }),
    settings: JSON.stringify({ ...BASE_SETTINGS, ...settings }),
  };
  await page.addInitScript((p) => {
    if (sessionStorage.getItem(p.flag)) return;
    localStorage.clear();
    localStorage.setItem(p.settingsKey, p.settings);
    localStorage.setItem(p.tabsKey, p.tabs);
    sessionStorage.setItem(p.flag, '1');
  }, payload);
}
