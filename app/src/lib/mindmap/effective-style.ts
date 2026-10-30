export interface EffectiveStyle {
  color: string;
  background: string;
  fontSize: number;
  branchColor: string;
}

const RGB_PATTERN = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/u;
const HEX_RADIX = 16;
const HEX_DIGITS = 2;

function channelHex(value: string): string {
  return Number(value).toString(HEX_RADIX).padStart(HEX_DIGITS, '0');
}

export function cssColorToHex(css: string): string | null {
  const match = RGB_PATTERN.exec(css.trim());
  if (!match || match[4] === '0') return null;
  return `#${channelHex(match[1])}${channelHex(match[2])}${channelHex(match[3])}`;
}

export function readEffectiveStyle(topic: HTMLElement, fallback: EffectiveStyle): EffectiveStyle {
  const computed = getComputedStyle(topic);
  return {
    color: cssColorToHex(computed.color) ?? fallback.color,
    background: cssColorToHex(computed.backgroundColor) ?? fallback.background,
    fontSize: Number.parseInt(computed.fontSize, 10) || fallback.fontSize,
    branchColor: cssColorToHex(topic.style.borderColor) ?? fallback.branchColor,
  };
}
