import { fsPort } from '../../../platform/index.ts';
import type { useTabsStore } from '../../../stores/tabs';

type TabsStore = ReturnType<typeof useTabsStore>;

interface RepointableTab {
  id: string;
  filePath?: string;
  content?: string;
  savedContent?: string;
}

/** Point an open tab at a path that just moved on disk.
 *
 *  #91 again: the dirty check has to be snapshotted BEFORE markSaved, which
 *  sets savedContent = content as part of its bookkeeping — comparing after
 *  it always says "clean" and a dirty tab loses its unsaved edits to whatever
 *  is on disk. Clean tabs are reloaded because a move can rewrite the body
 *  (relative links get re-anchored to the new folder). */
export async function repointTab(tabs: TabsStore, tab: RepointableTab, next: string): Promise<void> {
  const wasClean = tab.savedContent === tab.content;
  if (!wasClean) {
    tabs.renamePath(tab.id, next);
    return;
  }
  tabs.markSaved(tab.id, next);
  try {
    const fr = await fsPort.readFile({ path: next });
    tabs.setContent(tab.id, fr.content);
    tabs.markSaved(tab.id, next);
  } catch (err) {
    console.warn('[FileTree] tab reload after move failed', err);
  }
}

/** Every tab under the moved path follows it — a folder move has to repoint
 *  each open note inside it, not just an exact match. */
export function repointTabs(tabs: TabsStore, from: string, to: string, isDir: boolean): void {
  const prefixes = isDir ? [from + '/', from + '\\'] : [];
  for (const tab of [...tabs.tabs] as RepointableTab[]) {
    const fp = tab.filePath;
    if (!fp) continue;
    let next: string | null = null;
    if (fp === from) {
      next = to;
    } else if (prefixes.some((pre) => fp.startsWith(pre))) {
      next = to + fp.slice(from.length);
    }
    if (next) void repointTab(tabs, tab, next);
  }
}
