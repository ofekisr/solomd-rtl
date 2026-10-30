import type { SettingsThis } from './settings-this.ts';

export const previewActions = {
  toggleReadingByDefaultOnMobile(this: SettingsThis) {
    this.readingByDefaultOnMobile = !this.readingByDefaultOnMobile;
    this.persist();
  },
  setPreviewMaxWidth(this: SettingsThis, n: number) {
    this.previewMaxWidth = Math.max(480, Math.min(1600, Math.round(n)));
    this.persist();
  },
  togglePlantuml(this: SettingsThis) {
    this.plantumlEnabled = !this.plantumlEnabled;
    this.persist();
  },
  setPlantumlServer(this: SettingsThis, s: string) {
    this.plantumlServer = s.trim();
    this.persist();
  },
  togglePreviewFitWidth(this: SettingsThis) {
    this.previewFitWidth = !this.previewFitWidth;
    this.persist();
  },
  toggleCodeBlockLineNumbers(this: SettingsThis) {
    this.codeBlockLineNumbers = !this.codeBlockLineNumbers;
    this.persist();
  },
  toggleCodeBlockWrap(this: SettingsThis) {
    this.codeBlockWrap = !this.codeBlockWrap;
    this.persist();
  },
  toggleDistinctSplitPanes(this: SettingsThis) {
    this.distinctSplitPanes = !this.distinctSplitPanes;
    this.persist();
  },
  toggleMarkdownHardBreaks(this: SettingsThis) {
    this.markdownHardBreaks = !this.markdownHardBreaks;
    this.persist();
  },
  toggleSmartQuotes(this: SettingsThis) {
    this.smartQuotes = !this.smartQuotes;
    this.persist();
  },
  toggleMarkdownAutoNumberHeadings(this: SettingsThis) {
    this.markdownAutoNumberHeadings = !this.markdownAutoNumberHeadings;
    this.persist();
  },
  /** v4.3.0 PR #74 — preview-only font size. Editor font is the existing
   *  `setFontSize`; this one drives `--content-font-size` (Preview.vue). */
  setPreviewFontSize(this: SettingsThis, n: number) {
    this.previewFontSize = Math.max(10, Math.min(32, Math.round(n || 15)));
    this.persist();
  },
  previewFontIn(this: SettingsThis) { this.setPreviewFontSize((this.previewFontSize || 15) + 1); },
  previewFontOut(this: SettingsThis) { this.setPreviewFontSize((this.previewFontSize || 15) - 1); },
  resetPreviewFontSize(this: SettingsThis) { this.setPreviewFontSize(15); },
};
