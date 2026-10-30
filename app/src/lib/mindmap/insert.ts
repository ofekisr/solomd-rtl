import type { PasteFormat } from './paste.ts';

export type PasteMapTarget = 'selected' | 'root';

export function resolveInsertTargetId(selectedId: string | null, rootId: string, mode: PasteMapTarget): string {
  return mode === 'selected' && selectedId !== null ? selectedId : rootId;
}

export type PasteMapSetting = 'ask' | PasteMapTarget;
export const PASTE_MAP_SETTINGS: readonly PasteMapSetting[] = ['ask', 'selected', 'root'];
const WHOLE_MAP_FORMAT: PasteFormat = 'mmap';

export function normalizePasteMapSetting(value: unknown): PasteMapSetting {
  return PASTE_MAP_SETTINGS.includes(value as PasteMapSetting) ? (value as PasteMapSetting) : 'ask';
}

export function needsPasteDialog(format: PasteFormat, hasSelection: boolean, setting: PasteMapSetting): boolean {
  return format === WHOLE_MAP_FORMAT && hasSelection && setting === 'ask';
}

export function pasteMode(format: PasteFormat, setting: PasteMapSetting): PasteMapTarget {
  return format === WHOLE_MAP_FORMAT && setting !== 'ask' ? setting : 'selected';
}
