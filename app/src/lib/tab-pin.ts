type PinnableTab = { id: string; pinned?: boolean };

export function pinnedCount(tabs: readonly PinnableTab[]): number {
  return tabs.filter((t) => t.pinned).length;
}

export function closableIds(ids: readonly string[], tabs: readonly PinnableTab[]): string[] {
  const pinned = new Set(tabs.filter((t) => t.pinned).map((t) => t.id));
  return ids.filter((id) => !pinned.has(id));
}

/** Pinned tabs stay a leading group: a drop index is clamped to the moving tab's own group. */
export function clampReorderIndex(tabs: readonly PinnableTab[], tabId: string, intendedIndex: number): number {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return intendedIndex;
  const boundary = pinnedCount(tabs);
  return tab.pinned ? Math.min(intendedIndex, boundary) : Math.max(intendedIndex, boundary);
}

/** Pinning appends to the pinned group; unpinning puts the tab first among the unpinned.
 *  Mutates in place so tab objects keep their identity for views that hold them. */
export function togglePinned(tabs: PinnableTab[], tabId: string): void {
  const index = tabs.findIndex((t) => t.id === tabId);
  if (index < 0) return;
  const [tab] = tabs.splice(index, 1);
  tab.pinned = !tab.pinned;
  tabs.splice(pinnedCount(tabs), 0, tab);
}
