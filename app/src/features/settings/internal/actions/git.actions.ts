import type { SettingsThis } from './settings-this.ts';

export const gitActions = {
  toggleAutoGit(this: SettingsThis) {
    this.autoGitEnabled = !this.autoGitEnabled;
    // v4.0.2: panel visibility decoupled from autoGit (#55) — hiding the
    // pane no longer disables sync. Re-enabling sync surfaces the panel
    // again only if the user hasn't explicitly hidden it.
    if (this.autoGitEnabled && !this.showHistoryPanel) this.showHistoryPanel = true;
    this.persist();
  },
  toggleHistoryPanel(this: SettingsThis) {
    this.showHistoryPanel = !this.showHistoryPanel;
    if (this.showHistoryPanel) this.ensureRightSidebarVisible();
    this.persist();
  },
  trustGitRepo(this: SettingsThis, root: string) {
    if (this.gitTrustedRepos.includes(root)) return;
    this.gitTrustedRepos = [...this.gitTrustedRepos, root];
    this.persist();
  },
  toggleGitCommit(this: SettingsThis) {
    this.showGitCommit = !this.showGitCommit;
    this.persist();
  },
  toggleGitLog(this: SettingsThis) {
    this.showGitLog = !this.showGitLog;
    this.persist();
  },
  setGitDockHeight(this: SettingsThis, px: number) {
    this.gitDockHeight = Math.round(px);
    this.persist();
  },
  setAutoGitDebounceSeconds(this: SettingsThis, n: number) {
    this.autoGitDebounceSeconds = Math.max(5, Math.min(600, Math.round(n) || 30));
    this.persist();
  },
};
