export type MindmapMode = 'map' | 'source' | 'outline';

export const MINDMAP_MODES: readonly MindmapMode[] = ['map', 'source', 'outline'];
export const DEFAULT_MINDMAP_MODE: MindmapMode = 'map';
const CYCLE = 'cycle';

export const VIEW_ACTIONS: Readonly<Record<string, MindmapMode | typeof CYCLE>> = {
  'mindmap.viewMap': 'map',
  'mindmap.viewSource': 'source',
  'mindmap.viewOutline': 'outline',
  'mindmap.cycleView': CYCLE,
};

export function normalizeMindmapMode(value: unknown): MindmapMode {
  return MINDMAP_MODES.includes(value as MindmapMode) ? (value as MindmapMode) : DEFAULT_MINDMAP_MODE;
}

export function nextMindmapMode(mode: MindmapMode): MindmapMode {
  const index = MINDMAP_MODES.indexOf(mode);
  return MINDMAP_MODES[(index + 1) % MINDMAP_MODES.length];
}

export function targetModeFor(actionId: string, current: MindmapMode): MindmapMode | null {
  const target = VIEW_ACTIONS[actionId];
  if (target === undefined) return null;
  return target === CYCLE ? nextMindmapMode(current) : target;
}

export type SourceExit = { ok: true } | { ok: false; error: string };

export function checkSourceExit(text: string, parse: (text: string) => SourceExit): SourceExit {
  const result = parse(text);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
