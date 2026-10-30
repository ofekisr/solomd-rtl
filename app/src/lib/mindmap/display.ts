import { DEFAULT_MAP_THEME, isMapThemeId, type MapThemeId } from './themes.ts';

export type BranchStyle = 'curve' | 'straight' | 'arrow';
export type FoldedCountMode = 'off' | 'direct' | 'all' | 'both';
export type MapFont = 'system' | 'serif' | 'mono';

export interface MapDisplay { compact?: boolean; branchStyle?: BranchStyle; textColor?: string; font?: MapFont; theme?: MapThemeId; foldedCount?: FoldedCountMode }
export type ResolvedMapDisplay = { compact: boolean; branchStyle: BranchStyle; textColor: string | null; font: MapFont; theme: MapThemeId; foldedCount: FoldedCountMode };
export interface BranchBox { pT: number; pL: number; pW: number; pH: number; cT: number; cL: number; cW: number; cH: number; direction: string; gap?: number }

const BRANCH_STYLES: readonly BranchStyle[] = ['curve', 'straight', 'arrow'];
const FOLDED_COUNT_MODES: readonly FoldedCountMode[] = ['off', 'direct', 'all', 'both'];
const MAP_FONTS: readonly MapFont[] = ['system', 'serif', 'mono'];
const SAFE_COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,20})$/i;
const LEFT_DIRECTION = 'lhs';
const DOWN_DIRECTION = 'down';
const HALF = 2;
export const DEFAULT_NODE_GAP = 0;
const ARROW_HEAD_LENGTH = 9;
const ARROW_HEAD_SPREAD = Math.PI / 7;
const COORD_DECIMALS = 2;

export const DEFAULT_MAP_DISPLAY: ResolvedMapDisplay = { compact: false, branchStyle: 'curve', textColor: null, font: 'system', theme: DEFAULT_MAP_THEME, foldedCount: 'both' };

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
  if (isMapThemeId(value.theme)) out.theme = value.theme;
  if (FOLDED_COUNT_MODES.includes(value.foldedCount as FoldedCountMode)) out.foldedCount = value.foldedCount as FoldedCountMode;
  return out;
}

export function resolveMapDisplay(override: MapDisplay, defaults: MapDisplay): ResolvedMapDisplay {
  return {
    compact: override.compact ?? defaults.compact ?? DEFAULT_MAP_DISPLAY.compact,
    branchStyle: override.branchStyle ?? defaults.branchStyle ?? DEFAULT_MAP_DISPLAY.branchStyle,
    textColor: override.textColor ?? defaults.textColor ?? DEFAULT_MAP_DISPLAY.textColor,
    font: override.font ?? defaults.font ?? DEFAULT_MAP_DISPLAY.font,
    theme: override.theme ?? defaults.theme ?? DEFAULT_MAP_DISPLAY.theme,
    foldedCount: override.foldedCount ?? defaults.foldedCount ?? DEFAULT_MAP_DISPLAY.foldedCount,
  };
}

interface Segment { x1: number; y1: number; x2: number; y2: number }

function round(value: number): number {
  return Number(value.toFixed(COORD_DECIMALS));
}

function line(s: Segment): string {
  return `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`;
}

function downSegment(p: BranchBox): Segment {
  return { x1: p.pL + p.pW / HALF, y1: p.pT + p.pH, x2: p.cL + p.cW / HALF, y2: p.cT };
}

function childAnchorX(p: BranchBox): number {
  return p.direction === LEFT_DIRECTION ? p.cL + p.cW : p.cL;
}

function mainSegment(p: BranchBox): Segment {
  if (p.direction === DOWN_DIRECTION) return downSegment(p);
  return { x1: p.pL + p.pW / HALF, y1: p.pT + p.pH / HALF, x2: childAnchorX(p), y2: p.cT + p.cH / HALF };
}

function subSegment(p: BranchBox): Segment {
  if (p.direction === DOWN_DIRECTION) return downSegment(p);
  const gap = p.gap ?? DEFAULT_NODE_GAP;
  const isLeft = p.direction === LEFT_DIRECTION;
  const x1 = isLeft ? p.pL + gap : p.pL + p.pW - gap;
  const x2 = isLeft ? p.cL + p.cW - gap : p.cL + gap;
  return { x1, y1: p.pT + p.pH / HALF, x2, y2: p.cT + p.cH / HALF };
}

function wing(s: Segment, angle: number): string {
  return `${round(s.x2 - ARROW_HEAD_LENGTH * Math.cos(angle))} ${round(s.y2 - ARROW_HEAD_LENGTH * Math.sin(angle))}`;
}

function arrow(s: Segment): string {
  const heading = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
  const tip = `${s.x2} ${s.y2}`;
  return `${line(s)} M ${wing(s, heading - ARROW_HEAD_SPREAD)} L ${tip} L ${wing(s, heading + ARROW_HEAD_SPREAD)}`;
}

export const straightMainBranch = (p: BranchBox): string => line(mainSegment(p));
export const straightSubBranch = (p: BranchBox): string => line(subSegment(p));
export const arrowMainBranch = (p: BranchBox): string => arrow(mainSegment(p));
export const arrowSubBranch = (p: BranchBox): string => arrow(subSegment(p));
