export type PdfMmField =
  | 'customWidthMm'
  | 'customHeightMm'
  | 'customMarginTopMm'
  | 'customMarginRightMm'
  | 'customMarginBottomMm'
  | 'customMarginLeftMm';

const MARGIN_FIELD_PREFIX = 'customMargin';
const MARGIN_RANGE_MM = { min: 5, max: 100 } as const;
const SIZE_RANGE_MM = { min: 50, max: 500 } as const;

export function isMmOutOfRange(field: PdfMmField, value: number): boolean {
  const range = field.startsWith(MARGIN_FIELD_PREFIX) ? MARGIN_RANGE_MM : SIZE_RANGE_MM;
  return !Number.isFinite(value) || value < range.min || value > range.max;
}
