import type { ResolvedVariant } from './resolve.ts';
import type { ThemeMode } from './schema.ts';

const FALLBACK_RGB = [128, 128, 128];
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

/** Mermaid derives shades with its own colour maths, so it needs plain hex, not CSS functions. */
export function cssColorToHex(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? FALLBACK_RGB;
  probe.remove();
  return `#${rgb.map((c) => Math.round(c).toString(HEX_RADIX).padStart(2, '0')).join('')}`;
}
