import type { ResolvedVariant } from './resolve.ts';
import type { ThemeMode } from './schema.ts';

const FALLBACK_RGB: Rgb = [128, 128, 128];
const HEX_RADIX = 16;

export interface MermaidConfig {
  theme: 'base';
  themeVariables: Record<string, string | boolean>;
}

export function mermaidConfigFor(r: ResolvedVariant, toHex: (c: string) => string): MermaidConfig {
  const { app, diagrams, surfaces } = r.colors;
  return {
    theme: 'base',
    themeVariables: {
      darkMode: r.mode === 'dark',
      background: toHex(app.bg),
      primaryColor: toHex(diagrams.nodeBg),
      primaryBorderColor: toHex(diagrams.nodeBorder),
      primaryTextColor: toHex(diagrams.text),
      secondaryColor: toHex(surfaces.hover),
      tertiaryColor: toHex(surfaces.active),
      lineColor: toHex(diagrams.line),
      textColor: toHex(diagrams.text),
    },
  };
}

export function graphvizThemeFor(mode: ThemeMode): 'dark' | 'default' {
  return mode === 'dark' ? 'dark' : 'default';
}

const UNIT_CHANNEL_MAX = 255;
const RGB_FN = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/;
const SRGB_FN = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/;

export type Rgb = [number, number, number];

export function parseComputedColor(value: string): Rgb | null {
  const text = value.trim();
  const rgb = RGB_FN.exec(text);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map(Math.round) as Rgb;
  const srgb = SRGB_FN.exec(text);
  if (!srgb) return null;
  return [Number(srgb[1]), Number(srgb[2]), Number(srgb[3])].map((c) => Math.round(c * UNIT_CHANNEL_MAX)) as Rgb;
}

/** Mermaid derives shades with its own colour maths, so it needs plain hex, not CSS functions. */
export function cssColorToHex(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.appendChild(probe);
  try {
    const rgb = parseComputedColor(getComputedStyle(probe).color) ?? FALLBACK_RGB;
    return `#${rgb.map((c) => c.toString(HEX_RADIX).padStart(2, '0')).join('')}`;
  } finally {
    probe.remove();
  }
}
