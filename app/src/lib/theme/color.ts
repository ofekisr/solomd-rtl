import { isHexColor, luminance, mix, toHex6 } from '../user-theme.ts';

const PERCENT = 100;
const LIGHT_SPLIT = 0.5;
const NUMERIC_RGB_RE = /^rgba?\(\s*\d/i;

/** `amount` (0–1) of `b` mixed into `a`; non-hex inputs stay a CSS `color-mix()`. */
export function mixColor(a: string, b: string, amount: number): string {
  if (isHexColor(a) && isHexColor(b)) return mix(a, b, amount);
  const share = Math.round(amount * PERCENT);
  return `color-mix(in srgb, ${a} ${PERCENT - share}%, ${b})`;
}

function isReadableRgb(color: string): boolean {
  return NUMERIC_RGB_RE.test(color.trim());
}

export function isLight(color: string): boolean {
  if (!isHexColor(color) && !isReadableRgb(color)) return false;
  return luminance(toHex6(color)) > LIGHT_SPLIT;
}
