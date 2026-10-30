import type { GeneralSettings } from './slices/general.slice.ts';
import type { LayoutSettings } from './slices/layout.slice.ts';
import type { ExplorerSettings } from './slices/explorer.slice.ts';
import type { PreviewSettings } from './slices/preview.slice.ts';
import type { AppearanceSettings } from './slices/appearance.slice.ts';
import type { WritingSettings } from './slices/writing.slice.ts';
import type { AttachmentsSettings } from './slices/attachments.slice.ts';
import type { InboxSettings } from './slices/inbox.slice.ts';
import type { MindmapSettings } from './slices/mindmap.slice.ts';
import type { GitSettings } from './slices/git.slice.ts';
import type { IntegrationsSettings } from './slices/integrations.slice.ts';
import type { AiSettings } from './slices/ai.slice.ts';
import type { ExportSettings } from './slices/export.slice.ts';
import type { AppSettings } from './slices/app.slice.ts';

export type Settings = GeneralSettings
  & LayoutSettings
  & ExplorerSettings
  & PreviewSettings
  & AppearanceSettings
  & WritingSettings
  & AttachmentsSettings
  & InboxSettings
  & MindmapSettings
  & GitSettings
  & IntegrationsSettings
  & AiSettings
  & ExportSettings
  & AppSettings;

export type SettingsKey = keyof Settings;
