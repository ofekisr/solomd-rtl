import { nextTick } from 'vue';
import { useTabsStore } from '../stores/tabs';
import { useTilesStore } from '../stores/tiles';
import { useFiles } from './useFiles';
import type { MindmapSource } from '../lib/mindmap-source';

const GOTO_EVENT = 'solomd:outline-goto';

export function useMindmapJump() {
  const tabs = useTabsStore();
  const tiles = useTilesStore();
  const files = useFiles();

  async function jumpTo(source: MindmapSource, tabId: string): Promise<void> {
    if (source.path) await files.openPath(source.path);
    else tabs.activate(tabId);
    await nextTick();
    window.dispatchEvent(new CustomEvent(GOTO_EVENT, { detail: { line: source.line, paneId: tiles.focusedPaneId } }));
  }

  return { jumpTo };
}
