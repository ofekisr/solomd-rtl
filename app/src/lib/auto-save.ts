export const DEFAULT_AUTO_SAVE_DELAY_MS = 1000;
export const MIN_AUTO_SAVE_DELAY_MS = 300;
export const MAX_AUTO_SAVE_DELAY_MS = 60_000;

export function clampAutoSaveDelay(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_AUTO_SAVE_DELAY_MS;
  return Math.min(MAX_AUTO_SAVE_DELAY_MS, Math.max(MIN_AUTO_SAVE_DELAY_MS, Math.round(value)));
}

export interface AutoSaveCandidate {
  filePath?: string | null;
  language?: string;
  content: string;
  savedContent: string;
}

const UNSAVABLE_EXTENSIONS = /\.xmind$/i;
const UNSAVABLE_LANGUAGES = new Set(['git-diff']);

export function canAutoSave(tab: AutoSaveCandidate, isConflictPending: boolean): boolean {
  if (!tab.filePath || isConflictPending) return false;
  if (tab.content === tab.savedContent) return false;
  if (tab.language && UNSAVABLE_LANGUAGES.has(tab.language)) return false;
  return !UNSAVABLE_EXTENSIONS.test(tab.filePath);
}
