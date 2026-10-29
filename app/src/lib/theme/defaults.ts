import type { ThemeMode } from './schema.ts';

export const SOLOMD_CODE = {
  light: {
    keyword: '#a626a4', string: '#50a14f', number: '#986801', comment: '#a0a1a7', function: '#4078f2',
    variable: '#383a42', type: '#c18401', property: '#e45649', operator: '#0184bc',
  },
  dark: {
    keyword: '#c678dd', string: '#98c379', number: '#d19a66', comment: '#5c6370', function: '#61afef',
    variable: '#e06c75', type: '#e5c07b', property: '#e06c75', operator: '#56b6c2',
  },
} as const satisfies Record<ThemeMode, Record<string, string>>;

export const DANGER = { light: '#d64545', dark: '#e86d6d' } as const;
export const TEXT_ON_ACCENT = { onLight: '#1a1a1a', onDark: '#ffffff' } as const;

export const MIX = {
  muted: 0.35, faint: 0.6, panel: 0.04, hover: 0.06, active: 0.12, border: 0.14,
  activeLine: 0.04, bracket: 0.25, search: 0.3, searchActive: 0.5,
  h3: 0.3, h4: 0.6, h6: 0.2, url: 0.3, selection: 0.78,
} as const;

export const DEFAULT_STYLE = {
  radius: 1, panelOpacity: 1, panelBlur: 0, activeLine: true, nodeRadius: 1,
  heading: { bold: true }, link: { underline: true }, quote: { italic: true },
  comment: { italic: true }, keyword: {}, function: {}, string: {},
} as const;
