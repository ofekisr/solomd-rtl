import type { PdfDefaults } from '../slices/export.slice.ts';
import { defaultPdfDefaults, mergePdfDefaults } from '../slices/export.slice.ts';
import type { SettingsThis } from './settings-this.ts';

export const exportActions = {
  /**
   * v2.5 F3: shallow-merge a partial `pdfDefaults` patch. Used by the
   * Settings panel so each `<select>`/`<input>` only has to send the one
   * field it changed.
   */
  setPdfDefaults(this: SettingsThis, patch: Partial<PdfDefaults>) {
    this.pdfDefaults = mergePdfDefaults({ ...this.pdfDefaults, ...patch });
    this.persist();
  },
  resetPdfDefaults(this: SettingsThis) {
    this.pdfDefaults = defaultPdfDefaults();
    this.persist();
  },
  toggleImageExportBranding(this: SettingsThis) {
    this.imageExportBranding = !this.imageExportBranding;
    this.persist();
  },
  setDocxPreset(this: SettingsThis, preset: 'plain' | 'report' | 'academic') {
    this.docxPreset = preset;
    this.persist();
  },
  setPrintTheme(this: SettingsThis, mode: 'light' | 'dark' | 'follow') {
    this.printTheme = mode;
    this.persist();
  },
};
