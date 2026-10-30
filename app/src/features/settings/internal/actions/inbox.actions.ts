import type { SettingsThis } from './settings-this.ts';

export const inboxActions = {
  setDailyNotesFolder(this: SettingsThis, p: string) {
    this.dailyNotesFolder = p;
    this.persist();
  },
  setDailyNotesFormat(this: SettingsThis, f: string) {
    this.dailyNotesFormat = f;
    this.persist();
  },
  setDailyNotesTemplate(this: SettingsThis, t: string) {
    this.dailyNotesTemplate = t;
    this.persist();
  },
  // v4.6 F6 — Inbox workflow toggles.
  toggleInboxWorkflow(this: SettingsThis) {
    this.inboxWorkflowEnabled = !this.inboxWorkflowEnabled;
    this.persist();
  },
  toggleAutoAdvanceInbox(this: SettingsThis) {
    this.autoAdvanceInboxAfterOrganize = !this.autoAdvanceInboxAfterOrganize;
    this.persist();
  },
};
