import type { SettingsMigration, SettingsMigrationEnv, SettingsRecord } from '../contracts/index.ts';

const EDITOR_FONT_SIZE_DEFAULT = 14;
const PREVIEW_FONT_SIZE_DEFAULT = 15;
const PREVIEW_FONT_SIZE_MIN = 10;
const PREVIEW_FONT_SIZE_MAX = 32;

type MigrationStep = (raw: SettingsRecord, env: SettingsMigrationEnv) => void;

function valueOr(value: unknown, fallback: number): number {
  return value === undefined ? fallback : (value as number);
}

function migrateChineseLanguage(raw: SettingsRecord): void {
  if (raw.language === 'zh') raw.language = 'en';
}

function migrateAgentPanel(raw: SettingsRecord): void {
  if (raw.v4AgentPanelMigrated) return;
  raw.showAgentPanel = true;
  raw.v4AgentPanelMigrated = true;
}

function migrateFileTreeDefault(raw: SettingsRecord, env: SettingsMigrationEnv): void {
  if (raw.fileTreeDefaultDesktopMigrated) return;
  if (!env.isMobile) raw.showFileTree = true;
  raw.fileTreeDefaultDesktopMigrated = true;
}

function migrateSmartQuotesOptIn(raw: SettingsRecord): void {
  if (raw.smartQuotesOptInMigrated) return;
  raw.smartQuotes = false;
  raw.smartQuotesOptInMigrated = true;
}

function migratePreviewFontSync(raw: SettingsRecord): void {
  if (raw.v4810PreviewFontSynced) return;
  const editorSize = valueOr(raw.fontSize, EDITOR_FONT_SIZE_DEFAULT);
  const isPreviewAtOldDefault = (raw.previewFontSize ?? PREVIEW_FONT_SIZE_DEFAULT) === PREVIEW_FONT_SIZE_DEFAULT;
  if (isPreviewAtOldDefault && editorSize !== EDITOR_FONT_SIZE_DEFAULT) {
    raw.previewFontSize = Math.max(PREVIEW_FONT_SIZE_MIN, Math.min(PREVIEW_FONT_SIZE_MAX, editorSize));
  }
  raw.v4810PreviewFontSynced = true;
}

function migrateMobileLayout(raw: SettingsRecord, env: SettingsMigrationEnv): void {
  if (raw.v491MobileLayoutMigrated) return;
  if (env.isMobile) raw.rightSidebarHidden = true;
  raw.v491MobileLayoutMigrated = true;
}

const STEPS_TO_V2: readonly MigrationStep[] = [
  migrateChineseLanguage,
  migrateAgentPanel,
  migrateFileTreeDefault,
  migrateSmartQuotesOptIn,
  migratePreviewFontSync,
  migrateMobileLayout,
];

function upToV2(raw: SettingsRecord, env: SettingsMigrationEnv): SettingsRecord {
  const next: SettingsRecord = { ...raw };
  for (const step of STEPS_TO_V2) step(next, env);
  return next;
}

export const SETTINGS_MIGRATIONS: readonly SettingsMigration[] = [{ to: 2, up: upToV2 }];
