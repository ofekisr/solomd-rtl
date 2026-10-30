import type { SettingsThis } from './settings-this.ts';

export const integrationsActions = {
  setWorkspaceBibliography(this: SettingsThis, p: string) {
    this.workspaceBibliography = p;
    this.persist();
  },
  setWorkspaceCsl(this: SettingsThis, p: string) {
    this.workspaceCsl = p;
    this.persist();
  },
  toggleRagEnabled(this: SettingsThis) {
    this.ragEnabled = !this.ragEnabled;
    this.persist();
  },
  toggleQuickCapture(this: SettingsThis) {
    this.quickCaptureEnabled = !this.quickCaptureEnabled;
    this.persist();
  },
  setQuickCaptureShortcut(this: SettingsThis, accel: string) {
    this.quickCaptureShortcut = accel.trim();
    this.persist();
  },
};
