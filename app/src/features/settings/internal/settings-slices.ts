import type { SettingsRecord, SettingsSlice } from '../contracts/index.ts';
import { generalSlice } from './slices/general.slice.ts';
import { layoutSlice } from './slices/layout.slice.ts';
import { explorerSlice } from './slices/explorer.slice.ts';
import { previewSlice } from './slices/preview.slice.ts';
import { appearanceSlice } from './slices/appearance.slice.ts';
import { writingSlice } from './slices/writing.slice.ts';
import { attachmentsSlice } from './slices/attachments.slice.ts';
import { inboxSlice } from './slices/inbox.slice.ts';
import { mindmapSlice } from './slices/mindmap.slice.ts';
import { gitSlice } from './slices/git.slice.ts';
import { integrationsSlice } from './slices/integrations.slice.ts';
import { aiSlice } from './slices/ai.slice.ts';
import { exportSlice } from './slices/export.slice.ts';
import { appSlice } from './slices/app.slice.ts';

function asRecordSlice<S extends SettingsRecord>(slice: SettingsSlice<S>): SettingsSlice {
  return slice as unknown as SettingsSlice;
}

export const SETTINGS_SLICES: readonly SettingsSlice[] = [
  asRecordSlice(generalSlice),
  asRecordSlice(layoutSlice),
  asRecordSlice(explorerSlice),
  asRecordSlice(previewSlice),
  asRecordSlice(appearanceSlice),
  asRecordSlice(writingSlice),
  asRecordSlice(attachmentsSlice),
  asRecordSlice(inboxSlice),
  asRecordSlice(mindmapSlice),
  asRecordSlice(gitSlice),
  asRecordSlice(integrationsSlice),
  asRecordSlice(aiSlice),
  asRecordSlice(exportSlice),
  asRecordSlice(appSlice),
];
