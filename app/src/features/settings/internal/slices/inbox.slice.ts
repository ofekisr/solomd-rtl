import { z } from 'zod';
import type { SettingsSlice } from '../../contracts/index.ts';

export type InboxSettings = {
  // v2.0 F3: daily notes
  dailyNotesFolder: string;
  dailyNotesFormat: string;
  dailyNotesTemplate: string;
  // v4.6 F6 — Inbox workflow. Master opt-out for the whole inbox surface
  // (file-tree row, status-bar pill, dedicated InboxView, ⌘E auto-advance).
  // Default on — mirrors Tolaria's per-vault InboxConfig.explicitOrganization,
  // but stored locally (not in files). When off, ⌘E falls back to the plain
  // `inbox: true|false` toggle and the InboxView / inbox filter are hidden.
  inboxWorkflowEnabled: boolean;
  // v4.6 F6 — when on, marking a note organized (⌘E) inside the inbox context
  // (InboxView open or inbox filter active) auto-advances to the next inbox
  // note. Default on. Matches Tolaria's auto_advance_inbox_after_organize.
  autoAdvanceInboxAfterOrganize: boolean;
};

const schema = z.object({
  dailyNotesFolder: z.string(),
  dailyNotesFormat: z.string(),
  dailyNotesTemplate: z.string(),
  inboxWorkflowEnabled: z.boolean(),
  autoAdvanceInboxAfterOrganize: z.boolean(),
});

function defaults(): InboxSettings {
  return {
    dailyNotesFolder: 'Daily',
    dailyNotesFormat: 'YYYY-MM-DD.md',
    dailyNotesTemplate: '',
    inboxWorkflowEnabled: true,
    autoAdvanceInboxAfterOrganize: true,
  };
}

export const inboxSlice: SettingsSlice<InboxSettings> = {
  id: 'inbox',
  schema,
  defaults,
};
