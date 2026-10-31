import { nextTick } from 'vue';
import { useI18n } from '../../i18n';
import { useTabsStore } from '../../stores/tabs';
import { useTilesStore } from '../../stores/tiles';
import { useToastsStore } from '../../stores/toasts';
import { useWorkspaceStore } from '../../stores/workspace';
import { useFiles } from '../useFiles';
import { isMarkdownSourcePath, normalizeSeparators, resolveSourcePath, type MindmapSource } from '../../lib/mindmap/source';

const GOTO_EVENT = 'solomd:outline-goto';

export function useMindmapJump() {
  const tabs = useTabsStore();
  const tiles = useTilesStore();
  const files = useFiles();
  const workspace = useWorkspaceStore();
  const toasts = useToastsStore();
  const { t } = useI18n();

  function dispatchGoto(line: number): void {
    window.dispatchEvent(new CustomEvent(GOTO_EVENT, { detail: { line, paneId: tiles.focusedPaneId } }));
  }

  function warnUnavailable(): void {
    toasts.info(t('mindmap.sourceUnavailable'));
  }

  async function jumpToPath(path: string, line: number): Promise<void> {
    const root = workspace.currentFolder;
    if (!root || !isMarkdownSourcePath(path)) return warnUnavailable();
    const abs = resolveSourcePath(root, path);
    await files.openPath(abs, { bypassNewWindow: true, revealInTree: false });
    await nextTick();
    const openPath = tabs.activeTab?.filePath;
    if (openPath === undefined || normalizeSeparators(openPath) !== normalizeSeparators(abs)) return warnUnavailable();
    dispatchGoto(line);
  }

  async function jumpTo(source: MindmapSource, tabId: string): Promise<void> {
    if (source.path) return jumpToPath(source.path, source.line);
    tabs.activate(tabId);
    await nextTick();
    dispatchGoto(source.line);
  }

  return { jumpTo };
}
