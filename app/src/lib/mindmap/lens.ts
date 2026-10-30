import type { ViewMode } from '../../types.ts';

export type MindmapLens = 'data' | 'map' | 'doc';
export type CellPart = 'json' | 'map' | 'outlinePreview' | 'outlineText' | 'wideMap' | 'outlineReading';
export type JsonExit = { ok: true } | { ok: false; error: string };

export const MINDMAP_LENSES: readonly MindmapLens[] = ['data', 'map', 'doc'];
export const DEFAULT_MINDMAP_LENS: MindmapLens = 'map';
export const MINDMAP_SET_LENS_EVENT = 'solomd:mindmap-set-lens';
export type SetLensDetail = { tabId: string; lens: MindmapLens };
const CYCLE = 'cycle';

const LEGACY_MODE_TO_LENS: Readonly<Record<string, MindmapLens>> = { source: 'data', outline: 'doc', map: 'map' };

const LENS_ACTIONS: Readonly<Record<string, MindmapLens | typeof CYCLE>> = {
  'mindmap.lensData': 'data',
  'mindmap.lensMap': 'map',
  'mindmap.lensDoc': 'doc',
  'mindmap.cycleLens': CYCLE,
};

const LEGACY_LENS_ACTION_IDS: Readonly<Record<string, string>> = {
  'mindmap.viewMap': 'mindmap.lensMap',
  'mindmap.viewSource': 'mindmap.lensData',
  'mindmap.viewOutline': 'mindmap.lensDoc',
  'mindmap.cycleView': 'mindmap.cycleLens',
};

const CELLS: Readonly<Record<ViewMode, Readonly<Record<MindmapLens, readonly CellPart[]>>>> = {
  edit: { data: ['json'], map: ['outlineText'], doc: ['outlineText'] },
  split: { data: ['json', 'map'], map: ['map', 'outlinePreview'], doc: ['outlineText', 'outlinePreview'] },
  liveEdit: { data: ['map'], map: ['map'], doc: ['outlinePreview'] },
  preview: { data: ['outlinePreview'], map: ['outlinePreview'], doc: ['outlinePreview'] },
  reading: { data: ['wideMap'], map: ['wideMap'], doc: ['outlineReading'] },
};

function hasOwnKey(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function normalizeLens(value: unknown): MindmapLens {
  return MINDMAP_LENSES.includes(value as MindmapLens) ? (value as MindmapLens) : DEFAULT_MINDMAP_LENS;
}

export function resolveTabLens(tab: { mindmapLens?: unknown; mindmapMode?: unknown }): MindmapLens {
  if (tab.mindmapLens !== undefined) return normalizeLens(tab.mindmapLens);
  const legacy = tab.mindmapMode;
  if (typeof legacy !== 'string' || !hasOwnKey(LEGACY_MODE_TO_LENS, legacy)) return DEFAULT_MINDMAP_LENS;
  return LEGACY_MODE_TO_LENS[legacy];
}

export function nextLens(lens: MindmapLens): MindmapLens {
  return MINDMAP_LENSES[(MINDMAP_LENSES.indexOf(lens) + 1) % MINDMAP_LENSES.length];
}

export function dataToggleTarget(lens: MindmapLens): MindmapLens {
  return lens === 'data' ? DEFAULT_MINDMAP_LENS : 'data';
}

export function isLensAction(actionId: string): boolean {
  return hasOwnKey(LENS_ACTIONS, actionId);
}

export function targetLensFor(actionId: string, current: MindmapLens): MindmapLens | null {
  if (!isLensAction(actionId)) return null;
  const target = LENS_ACTIONS[actionId];
  return target === CYCLE ? nextLens(current) : target;
}

export function lensCell(lens: MindmapLens, view: ViewMode): readonly CellPart[] {
  return CELLS[view][lens];
}

export function cellHas(parts: readonly CellPart[], part: CellPart): boolean {
  return parts.includes(part);
}

export function migrateLensKeybindings(bindings: Record<string, string | null>): Record<string, string | null> {
  const out = { ...bindings };
  for (const [legacy, next] of Object.entries(LEGACY_LENS_ACTION_IDS)) {
    if (!hasOwnKey(out, legacy)) continue;
    if (!hasOwnKey(out, next)) out[next] = out[legacy];
    delete out[legacy];
  }
  return out;
}

export function checkJsonExit(text: string, parse: (text: string) => JsonExit): JsonExit {
  const result = parse(text);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
