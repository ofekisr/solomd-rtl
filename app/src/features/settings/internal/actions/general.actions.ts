import type { SettingsThis } from './settings-this.ts';

export const generalActions = {
  setFontSize(this: SettingsThis, n: number) {
    this.fontSize = Math.max(10, Math.min(28, n));
    // #133 — the Settings "Font size" slider is the single base size
    // users expect to govern every view. Keep the preview pane in lockstep so
    // changing it visibly resizes the rendered side too (split panes then
    // match). The ⌃⌘+/− preview-zoom axis can still nudge previewFontSize on
    // its own afterwards for users who want the panes to differ.
    this.previewFontSize = Math.max(10, Math.min(32, this.fontSize));
    this.persist();
  },
  setFontFamily(this: SettingsThis, f: string) {
    this.fontFamily = f;
    this.persist();
  },
  toggleWordWrap(this: SettingsThis) {
    this.wordWrap = !this.wordWrap;
    this.persist();
  },
  toggleLineNumbers(this: SettingsThis) {
    this.showLineNumbers = !this.showLineNumbers;
    this.persist();
  },
  toggleSolidCursor(this: SettingsThis) {
    this.solidCursor = !this.solidCursor;
    this.persist();
  },
  toggleAlwaysShowMarkers(this: SettingsThis) {
    this.alwaysShowMarkers = !this.alwaysShowMarkers;
    this.persist();
  },
  toggleHighlightCurrentLine(this: SettingsThis) {
    this.highlightCurrentLine = !this.highlightCurrentLine;
    this.persist();
  },
  setCodeFontFamily(this: SettingsThis, f: string) {
    this.codeFontFamily = f;
    this.persist();
  },
  toggleLivePreview(this: SettingsThis) {
    this.livePreview = !this.livePreview;
    this.persist();
  },
  setUiFontSize(this: SettingsThis, n: number) {
    this.uiFontSize = Math.max(10, Math.min(20, n));
    this.persist();
  },
  setLanguage(this: SettingsThis, lang: 'en' | 'ja' | 'ko' | 'de' | 'fr' | 'es' | 'pt' | 'it' | 'pl' | 'nl' | 'tr' | 'sv' | 'uk' | 'ru') {
    this.language = lang;
    this.persist();
  },
  toggleLimitEditorWidth(this: SettingsThis) {
    this.limitEditorWidth = !this.limitEditorWidth;
    this.persist();
  },
  toggleStatusBarViewModes(this: SettingsThis) {
    this.showStatusBarViewModes = !this.showStatusBarViewModes;
    this.persist();
  },
  setGlobalZoom(this: SettingsThis, n: number) {
    // Clamp to a sane range: 0.75 (text uncomfortably small) to 2.5 (text
    // huge for accessibility / 8K screens). Round to 0.05 so the slider
    // / shortcuts don't accumulate floating-point drift.
    const clean = Math.max(0.75, Math.min(2.5, Math.round((n || 1) * 20) / 20));
    this.globalZoom = clean;
    this.persist();
  },
  zoomIn(this: SettingsThis) {
    this.setGlobalZoom((this.globalZoom || 1) + 0.1);
  },
  zoomOut(this: SettingsThis) {
    this.setGlobalZoom((this.globalZoom || 1) - 0.1);
  },
  resetZoom(this: SettingsThis) {
    this.setGlobalZoom(1);
  },
  toggleWheelZoom(this: SettingsThis) {
    this.wheelZoomEnabled = !this.wheelZoomEnabled;
    this.persist();
  },
  toggleFolding(this: SettingsThis) {
    this.foldingEnabled = !this.foldingEnabled;
    this.persist();
  },
  /** v4.3.0 PR #74 — editor-only font size convenience wrappers. The
   *  underlying field is the existing `fontSize`. */
  editorFontIn(this: SettingsThis) { this.setFontSize((this.fontSize || 14) + 1); },
  editorFontOut(this: SettingsThis) { this.setFontSize((this.fontSize || 14) - 1); },
  resetEditorFontSize(this: SettingsThis) { this.setFontSize(14); },
};
