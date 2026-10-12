export type BranchStyle = 'curve' | 'straight';
export type MapFont = 'system' | 'serif' | 'mono';

export interface MapDisplay { compact?: boolean; branchStyle?: BranchStyle; textColor?: string; font?: MapFont }
export type ResolvedMapDisplay = { compact: boolean; branchStyle: BranchStyle; textColor: string | null; font: MapFont };
export interface BranchBox { pT: number; pL: number; pW: number; pH: number; cT: number; cL: number; cW: number; cH: number; direction: string }

const BRANCH_STYLES: readonly BranchStyle[] = ['curve', 'straight'];
const MAP_FONTS: readonly MapFont[] = ['system', 'serif', 'mono'];
const SAFE_COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,20})$/i;
const LEFT_DIRECTION = 'lhs';
const HALF = 2;

export const DEFAULT_MAP_DISPLAY: ResolvedMapDisplay = { compact: false, branchStyle: 'curve', textColor: null, font: 'system' };

export const FONT_STACKS: Readonly<Record<MapFont, string>> = {
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", Menlo, Consolas, monospace',
};

export function isSafeColor(value: unknown): value is string {
  return typeof value === 'string' && SAFE_COLOR_PATTERN.test(value.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseMapDisplay(value: unknown): MapDisplay {
  if (!isRecord(value)) return {};
  const out: MapDisplay = {};
  if (typeof value.compact === 'boolean') out.compact = value.compact;
  if (BRANCH_STYLES.includes(value.branchStyle as BranchStyle)) out.branchStyle = value.branchStyle as BranchStyle;
  if (isSafeColor(value.textColor)) out.textColor = value.textColor.trim();
  if (MAP_FONTS.includes(value.font as MapFont)) out.font = value.font as MapFont;
  return out;
}

export function resolveMapDisplay(override: MapDisplay, defaults: MapDisplay): ResolvedMapDisplay {
  return {
    compact: override.compact ?? defaults.compact ?? DEFAULT_MAP_DISPLAY.compact,
    branchStyle: override.branchStyle ?? defaults.branchStyle ?? DEFAULT_MAP_DISPLAY.branchStyle,
    textColor: override.textColor ?? defaults.textColor ?? DEFAULT_MAP_DISPLAY.textColor,
    font: override.font ?? defaults.font ?? DEFAULT_MAP_DISPLAY.font,
  };
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

function childAnchorX(p: BranchBox): number {
  return p.direction === LEFT_DIRECTION ? p.cL + p.cW : p.cL;
}

export function straightMainBranch(p: BranchBox): string {
  return line(p.pL + p.pW / HALF, p.pT + p.pH / HALF, childAnchorX(p), p.cT + p.cH / HALF);
}

export function straightSubBranch(p: BranchBox): string {
  const parentX = p.direction === LEFT_DIRECTION ? p.pL : p.pL + p.pW;
  return line(parentX, p.pT + p.pH / HALF, childAnchorX(p), p.cT + p.cH / HALF);
}
