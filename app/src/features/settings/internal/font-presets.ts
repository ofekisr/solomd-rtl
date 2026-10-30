export interface FontPreset {
  label: string;
  value: string;
}

export const CUSTOM_FONT_VALUE = '__custom__';
export const CUSTOM_PDF_FONT_VALUE = '__custom_pdf__';

export const FONT_FAMILIES: readonly FontPreset[] = [
  { label: 'JetBrains Mono', value: 'JetBrains Mono' },
  { label: 'SF Mono', value: 'SF Mono' },
  { label: 'Menlo', value: 'Menlo' },
  { label: 'Consolas', value: 'Consolas' },
  { label: 'Fira Code', value: 'Fira Code' },
  { label: 'System Sans', value: '-apple-system, "Segoe UI", system-ui, sans-serif' },
  { label: 'Georgia (Serif)', value: 'Georgia' },
  { label: 'Times New Roman (Serif)', value: 'Times New Roman' },
  { label: 'PingFang SC', value: 'PingFang SC' },
  { label: 'Microsoft YaHei', value: 'Microsoft YaHei' },
  { label: 'Source Han Sans', value: 'Source Han Sans SC' },
  { label: 'Source Han Serif', value: 'Source Han Serif SC' },
  { label: 'LXGW WenKai', value: 'LXGW WenKai' },
  { label: 'LXGW Bright', value: 'LXGW Bright' },
  { label: 'TsangerJinKai', value: 'TsangerJinKai03 W04' },
];

const PRESET_VALUES: ReadonlySet<string> = new Set(FONT_FAMILIES.map((f) => f.value));

export function isPresetFont(value: string): boolean {
  return PRESET_VALUES.has(value);
}

export function pdfFontSelectValue(pdfFontFamily: string): string {
  if (isPresetFont(pdfFontFamily)) return pdfFontFamily;
  return pdfFontFamily ? CUSTOM_PDF_FONT_VALUE : '';
}
