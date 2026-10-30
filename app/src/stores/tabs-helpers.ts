import type { Tab } from '../types';

/** Android SAF save-as hands back a content:// URI whose last '/'
 *  segment is the percent-encoded documentId ("primary%3A…%2Fnote.md");
 *  decode it so the tab shows "note.md", not the raw id. */
export function fileNameFromSavedPath(filePath: string, fallback: string): string {
  if (!filePath.startsWith('content://')) return filePath.split(/[\\/]/).pop() ?? fallback;
  try {
    return decodeURIComponent(filePath).split(/[\\/:]/).filter(Boolean).pop() ?? fallback;
  } catch {
    return filePath.split(/[\\/]/).pop() ?? fallback;
  }
}

/** Dedup by id AND by path. The id check matters for untitled tabs (no path):
 *  a carried untitled and its copy persisted in the new workspace's bucket
 *  share an id, so without it untitled tabs would multiply on every switch.
 *  Carried tabs win (they hold the live, possibly-unsaved content). */
export function mergeTabsDedup(carried: Tab[], restored: Tab[]): Tab[] {
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();
  const merged: Tab[] = [];
  for (const t of [...carried, ...restored]) {
    if (seenIds.has(t.id)) continue;
    if (t.filePath && seenPaths.has(t.filePath)) continue;
    seenIds.add(t.id);
    if (t.filePath) seenPaths.add(t.filePath);
    merged.push(t);
  }
  return merged;
}
