/** Hue/saturation/value for the colour picker: h in 0..360, s and v in 0..1. */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

const HEX6_RE = /^#?([0-9a-f]{6})$/i;
const HUE_SECTORS = 6;
const FULL_TURN = 360;
const CHANNEL_MAX = 255;

export function hexToHsv(hex: string): Hsv {
  const m = HEX6_RE.exec(hex.trim());
  if (!m) return { h: 0, s: 0, v: 0 };
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & CHANNEL_MAX, (n >> 8) & CHANNEL_MAX, n & CHANNEL_MAX].map((c) => c / CHANNEL_MAX);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  return { h: hueOf(r, g, b, max, delta), s: max === 0 ? 0 : delta / max, v: max };
}

function hueOf(r: number, g: number, b: number, max: number, delta: number): number {
  if (delta === 0) return 0;
  const sector = max === r ? ((g - b) / delta) % HUE_SECTORS : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (sector * (FULL_TURN / HUE_SECTORS) + FULL_TURN) % FULL_TURN;
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const channel = (offset: number): number => {
    const k = (offset + h / (FULL_TURN / HUE_SECTORS)) % HUE_SECTORS;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const toByte = (c: number): string => Math.round(c * CHANNEL_MAX).toString(16).padStart(2, '0');
  return `#${toByte(channel(5))}${toByte(channel(3))}${toByte(channel(1))}`;
}
