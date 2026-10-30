import { computed } from 'vue';
import { fsPort } from '../../../platform/index.ts';
import { useWorkspaceStore } from '../../../stores/workspace';
import { useSettingsStore } from '../../../stores/settings';
import { useToastsStore } from '../../../stores/toasts';
import { useI18n } from '../../../i18n';
import { isSafPath } from '../../../lib/saf-fs';
import { sortEntries, sortNeedsTimes, type TreeSortMode } from '../../../lib/tree-sort';
import type { FileTreeState } from './useFileTreeState.ts';
import { orderFilePath, orderKey } from './tree-paths.ts';
import type { TreeEntry, TreeNode } from './tree-types.ts';

const SORT_LABEL_KEYS: Record<TreeSortMode, string> = {
  'name-asc': 'explorer.sortNameAsc',
  'name-desc': 'explorer.sortNameDesc',
  'created-asc': 'explorer.sortCreatedAsc',
  'created-desc': 'explorer.sortCreatedDesc',
  'modified-desc': 'explorer.sortModifiedDesc',
  manual: 'explorer.sortManual',
};

interface SortDeps {
  refreshPreservingExpansion: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// #342 — sort order. One mode per workspace (settings.explorerSortByFolder);
// "manual" keeps a per-folder name list in <vault>/.solomd/order.json, which
// is written only once the user actually drags something into place — the
// file is not created just by opening a vault (see #236).
// ---------------------------------------------------------------------------
export function useTreeSort(state: FileTreeState, deps: SortDeps) {
  const { root, manualOrder, sortOpen, filterOpen } = state;
  const workspace = useWorkspaceStore();
  const settings = useSettingsStore();
  const toasts = useToastsStore();
  const { t } = useI18n();

  const sortMode = computed<TreeSortMode>(
    () => (workspace.currentFolder && settings.explorerSortByFolder[workspace.currentFolder]) || 'name-asc',
  );

  function orderPath(): string | null {
    const rootPath = workspace.currentFolder;
    if (!rootPath || isSafPath(rootPath)) return null;
    return orderFilePath(rootPath);
  }
  async function loadManualOrder() {
    manualOrder.value = {};
    const path = orderPath();
    if (!path) return;
    try {
      const fr = await fsPort.readFile({ path });
      const parsed = JSON.parse(fr.content);
      if (parsed && typeof parsed === 'object') {
        const clean: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (Array.isArray(v)) clean[k] = v.filter((x) => typeof x === 'string');
        }
        manualOrder.value = clean;
      }
    } catch {
      /* no order file yet — every folder falls back to creation order */
    }
  }
  async function saveManualOrder() {
    const path = orderPath();
    if (!path) return;
    try {
      await fsPort.fsCreateDir({ path: path.replace(/[\\/][^\\/]+$/, '') }).catch(() => {});
      await fsPort.writeFile({
        path,
        content: JSON.stringify(manualOrder.value, null, 2) + '\n',
        encoding: 'UTF-8',
      });
    } catch (err) {
      toasts.error(String(err));
    }
  }
  function sortChildren<T extends TreeEntry>(folder: string, children: T[]): T[] {
    return sortEntries(children, sortMode.value, manualOrder.value[orderKey(workspace.currentFolder, folder)] ?? []);
  }
  /** Re-apply the current order to everything already loaded (no re-listing). */
  function resortLoaded() {
    function walk(n: TreeNode | null | undefined) {
      if (!n || !n.children) return;
      n.children = sortChildren(n.path, n.children);
      n.children.forEach(walk);
    }
    walk(root.value);
  }
  function setSortMode(mode: TreeSortMode) {
    sortOpen.value = false;
    const folder = workspace.currentFolder;
    if (!folder) return;
    const hadTimes = sortNeedsTimes(sortMode.value);
    settings.setExplorerSort(folder, mode);
    // Date and manual modes need timestamps the plain listing doesn't carry,
    // so switching into one re-lists; otherwise re-sorting in place is enough.
    if (sortNeedsTimes(mode) && !hadTimes) void deps.refreshPreservingExpansion();
    else resortLoaded();
  }
  function sortLabel(mode: TreeSortMode): string {
    return t(SORT_LABEL_KEYS[mode]);
  }
  function toggleSortMenu() {
    sortOpen.value = !sortOpen.value;
    filterOpen.value = false;
  }

  return { sortMode, loadManualOrder, saveManualOrder, sortChildren, setSortMode, sortLabel, toggleSortMenu };
}

export type TreeSort = ReturnType<typeof useTreeSort>;
