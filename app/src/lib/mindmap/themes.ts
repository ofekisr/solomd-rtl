export type MapThemeId = 'default' | 'ocean' | 'forest' | 'mono' | 'highContrast';
export type ThemeFamily = 'light' | 'dark';
export type MapThemeVarName = '--bgcolor' | '--root-bgcolor' | '--root-color' | '--main-bgcolor' | '--main-color' | '--color' | '--selected';

export interface MapThemeVariant { readonly palette: readonly string[]; readonly cssVar: Readonly<Record<MapThemeVarName, string>> }
export interface MapThemePreset { readonly id: MapThemeId; readonly labelKey: string; readonly light: MapThemeVariant; readonly dark: MapThemeVariant }
export interface MapThemeInput { name: string; type: ThemeFamily; palette: string[]; cssVar: Record<MapThemeVarName, string> }

export const PALETTE_SIZE = 8;
export const AA_TEXT_CONTRAST = 4.5;
export const DEFAULT_MAP_THEME: MapThemeId = 'default';
const THEME_NAME_PREFIX = 'solomd';

const WCAG = { linearThreshold: 0.03928, linearDivisor: 12.92, offset: 0.055, scale: 1.055, gamma: 2.4, flare: 0.05, red: 0.2126, green: 0.7152, blue: 0.0722, channelMax: 255 } as const;
const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX_RADIX = 16;
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
const BYTE = 0xff;

export const MAP_THEMES: readonly MapThemePreset[] = [
  {
    id: 'default',
    labelKey: 'mindmap.themeDefault',
    light: {
      palette: ['#dd7878', '#ea76cb', '#8839ef', '#e64553', '#fe640b', '#df8e1d', '#40a02b', '#209fb5'],
      cssVar: { '--bgcolor': '#f6f6f6', '--root-bgcolor': '#4c4f69', '--root-color': '#ffffff', '--main-bgcolor': '#ffffff', '--main-color': '#444446', '--color': '#777777', '--selected': '#4dc4ff' },
    },
    dark: {
      palette: ['#848fa0', '#748be9', '#d2f9fe', '#4145a5', '#789afa', '#706cf4', '#ef987f', '#775dd5'],
      cssVar: { '--bgcolor': '#252526', '--root-bgcolor': '#2d3748', '--root-color': '#ffffff', '--main-bgcolor': '#4c4f69', '--main-color': '#ffffff', '--color': '#cccccc', '--selected': '#4dc4ff' },
    },
  },
  {
    id: 'ocean',
    labelKey: 'mindmap.themeOcean',
    light: {
      palette: ['#0077b6', '#0096c7', '#00b4d8', '#48cae4', '#023e8a', '#0081a7', '#00afb9', '#2a9d8f'],
      cssVar: { '--bgcolor': '#f0f8fc', '--root-bgcolor': '#03045e', '--root-color': '#ffffff', '--main-bgcolor': '#ffffff', '--main-color': '#023e8a', '--color': '#1d4e6b', '--selected': '#00b4d8' },
    },
    dark: {
      palette: ['#48cae4', '#90e0ef', '#00b4d8', '#ade8f4', '#4cc9f0', '#56cfe1', '#72efdd', '#64dfdf'],
      cssVar: { '--bgcolor': '#0b1d2a', '--root-bgcolor': '#0077b6', '--root-color': '#ffffff', '--main-bgcolor': '#12324a', '--main-color': '#e0f4ff', '--color': '#a9d6ec', '--selected': '#72efdd' },
    },
  },
  {
    id: 'forest',
    labelKey: 'mindmap.themeForest',
    light: {
      palette: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#606c38', '#bc6c25', '#dda15e', '#588157'],
      cssVar: { '--bgcolor': '#f4f8f1', '--root-bgcolor': '#1b4332', '--root-color': '#ffffff', '--main-bgcolor': '#ffffff', '--main-color': '#1b4332', '--color': '#3a5a40', '--selected': '#52b788' },
    },
    dark: {
      palette: ['#74c69d', '#95d5b2', '#b7e4c7', '#52b788', '#a3b18a', '#dda15e', '#e9c46a', '#90be6d'],
      cssVar: { '--bgcolor': '#13201a', '--root-bgcolor': '#2d6a4f', '--root-color': '#ffffff', '--main-bgcolor': '#1f3a2d', '--main-color': '#e8f5ec', '--color': '#b7d8c4', '--selected': '#95d5b2' },
    },
  },
  {
    id: 'mono',
    labelKey: 'mindmap.themeMono',
    light: {
      palette: ['#222222', '#444444', '#666666', '#888888', '#333333', '#555555', '#777777', '#999999'],
      cssVar: { '--bgcolor': '#fafafa', '--root-bgcolor': '#222222', '--root-color': '#ffffff', '--main-bgcolor': '#ffffff', '--main-color': '#222222', '--color': '#444444', '--selected': '#888888' },
    },
    dark: {
      palette: ['#eeeeee', '#cccccc', '#aaaaaa', '#888888', '#dddddd', '#bbbbbb', '#999999', '#777777'],
      cssVar: { '--bgcolor': '#1a1a1a', '--root-bgcolor': '#eeeeee', '--root-color': '#111111', '--main-bgcolor': '#2a2a2a', '--main-color': '#eeeeee', '--color': '#cccccc', '--selected': '#aaaaaa' },
    },
  },
  {
    id: 'highContrast',
    labelKey: 'mindmap.themeHighContrast',
    light: {
      palette: ['#000000', '#0000cc', '#b30000', '#006600', '#7a00a3', '#8a4b00', '#005f73', '#3d3d3d'],
      cssVar: { '--bgcolor': '#ffffff', '--root-bgcolor': '#000000', '--root-color': '#ffffff', '--main-bgcolor': '#ffffff', '--main-color': '#000000', '--color': '#000000', '--selected': '#0050ff' },
    },
    dark: {
      palette: ['#ffffff', '#ffd400', '#00e5ff', '#7dff7d', '#ff8cff', '#ffa64d', '#8cb4ff', '#ff6b6b'],
      cssVar: { '--bgcolor': '#000000', '--root-bgcolor': '#ffffff', '--root-color': '#000000', '--main-bgcolor': '#000000', '--main-color': '#ffffff', '--color': '#ffffff', '--selected': '#ffd400' },
    },
  },
];

export const MAP_THEME_IDS: readonly MapThemeId[] = MAP_THEMES.map((preset) => preset.id);

export function isMapThemeId(value: unknown): value is MapThemeId {
  return typeof value === 'string' && MAP_THEME_IDS.includes(value as MapThemeId);
}

function presetFor(id: MapThemeId): MapThemePreset {
  return MAP_THEMES.find((preset) => preset.id === id) ?? MAP_THEMES[0];
}

export function mapThemeVariant(id: MapThemeId, family: ThemeFamily): MapThemeInput {
  const variant = presetFor(id)[family];
  return { name: `${THEME_NAME_PREFIX}-${id}-${family}`, type: family, palette: [...variant.palette], cssVar: { ...variant.cssVar } };
}

function linearChannel(byte: number): number {
  const c = byte / WCAG.channelMax;
  return c <= WCAG.linearThreshold ? c / WCAG.linearDivisor : ((c + WCAG.offset) / WCAG.scale) ** WCAG.gamma;
}

function relativeLuminance(hex: string): number {
  const match = HEX6.exec(hex);
  if (!match) throw new Error(`Expected #rrggbb, got ${hex}`);
  const n = Number.parseInt(match[1], HEX_RADIX);
  const r = linearChannel((n >> RED_SHIFT) & BYTE);
  const g = linearChannel((n >> GREEN_SHIFT) & BYTE);
  const b = linearChannel(n & BYTE);
  return WCAG.red * r + WCAG.green * g + WCAG.blue * b;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + WCAG.flare) / (dark + WCAG.flare);
}
