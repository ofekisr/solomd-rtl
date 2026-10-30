import type { SettingsThis } from './settings-this.ts';

export const writingActions = {
  toggleSpellCheck(this: SettingsThis) {
    this.spellCheck = !this.spellCheck;
    this.persist();
  },
  toggleFocusMode(this: SettingsThis) {
    this.focusMode = !this.focusMode;
    this.persist();
  },
  toggleTypewriterMode(this: SettingsThis) {
    this.typewriterMode = !this.typewriterMode;
    this.persist();
  },
  toggleVimMode(this: SettingsThis) {
    this.vimMode = !this.vimMode;
    this.persist();
  },
  setWindowsEditorEngine(this: SettingsThis, engine: 'native' | 'codemirror') {
    this.windowsEditorEngine = engine === 'codemirror' ? 'codemirror' : 'native';
    this.persist();
  },
  toggleSpellcheckEnabled(this: SettingsThis) {
    this.spellcheckEnabled = !this.spellcheckEnabled;
    this.persist();
  },
  toggleWritingStats(this: SettingsThis) {
    this.showWritingStats = !this.showWritingStats;
    this.persist();
  },
  toggleWorkspaceDailyTotal(this: SettingsThis) {
    this.showWorkspaceDailyTotal = !this.showWorkspaceDailyTotal;
    this.persist();
  },
  togglePomodoroShowControls(this: SettingsThis) {
    this.pomodoroShowControls = !this.pomodoroShowControls;
    this.persist();
  },
  togglePomodoroAutoEngageFocus(this: SettingsThis) {
    this.pomodoroAutoEngageFocus = !this.pomodoroAutoEngageFocus;
    this.persist();
  },
  setPomodoroDefaultMinutes(this: SettingsThis, n: number) {
    const clean = Math.max(1, Math.min(600, Math.round(n) || 25));
    this.pomodoroDefaultMinutes = clean;
    this.persist();
  },
  toggleSlashCommandsEnabled(this: SettingsThis) {
    this.slashCommandsEnabled = !this.slashCommandsEnabled;
    this.persist();
  },
  setSpellcheckLang(this: SettingsThis, code: string) {
    this.spellcheckLang = code || 'en_US';
    this.persist();
  },
};
