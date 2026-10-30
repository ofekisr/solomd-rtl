import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useSettingsStore, type PdfDefaults } from '../../../stores/settings';
import { CUSTOM_PDF_FONT_VALUE, pdfFontSelectValue as selectValueFor } from './font-presets.ts';
import { isMmOutOfRange, type PdfMmField } from './pdf-mm-range.ts';

export interface PdfDefaultsForm {
  pdfMmRangeError: Ref<boolean>;
  pdfFontSelectValue: ComputedRef<string>;
  onCustomMmChange: (field: PdfMmField, raw: string) => void;
  onSelectPdfFont: (value: string) => void;
}

export function usePdfDefaultsForm(): PdfDefaultsForm {
  const settings = useSettingsStore();
  const pdfMmRangeError = ref(false);

  /** Out-of-range values still reach the store, which clamps them; the flag only shows inline feedback. */
  function onCustomMmChange(field: PdfMmField, raw: string): void {
    const value = Number(raw);
    pdfMmRangeError.value = isMmOutOfRange(field, value);
    settings.setPdfDefaults({ [field]: value } as Partial<PdfDefaults>);
  }

  /** The dropdown shares the editor's font list; the empty value means "inherit the stylesheet default". */
  const pdfFontSelectValue = computed(() => selectValueFor(settings.pdfDefaults.fontFamily));

  function onSelectPdfFont(value: string): void {
    if (value === CUSTOM_PDF_FONT_VALUE) return;
    settings.setPdfDefaults({ fontFamily: value });
  }
  return { pdfMmRangeError, pdfFontSelectValue, onCustomMmChange, onSelectPdfFont };
}
