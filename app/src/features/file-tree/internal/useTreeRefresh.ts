import { onBeforeUnmount, onMounted } from 'vue';
import { eventsPort, type UnlistenFn } from '../../../platform/index.ts';
import { useWorkspaceStore } from '../../../stores/workspace';
import { usePendingDeletes } from '../../../composables/usePendingDeletes';
import { setTreeSelection } from '../../../lib/new-file-target';
import type { FileTreeState } from './useFileTreeState.ts';
import type { TreeFilter } from './useTreeFilter.ts';
import type { TreeLoad } from './useTreeLoad.ts';
import type { TreeNode } from './tree-types.ts';

const REFRESH_DEBOUNCE_MS = 250;

// ---------------------------------------------------------------------------
// v3.0: auto-refresh on save / pull / external-change
// ---------------------------------------------------------------------------
export function useTreeRefresh(state: FileTreeState, load: TreeLoad, filter: TreeFilter) {
  const { root } = state;
  const workspace = useWorkspaceStore();
  const pendingDeletes = usePendingDeletes();

  let refreshDebounce: ReturnType<typeof setTimeout> | null = null;
  function scheduleRefresh() {
    if (refreshDebounce) clearTimeout(refreshDebounce);
    refreshDebounce = setTimeout(() => {
      refreshDebounce = null;
      void refreshTreePreservingExpansion();
    }, REFRESH_DEBOUNCE_MS);
  }

  async function refreshTreePreservingExpansion() {
    if (!workspace.currentFolder) return;
    const expanded = new Set<string>();
    function walk(n: TreeNode | null | undefined) {
      if (!n) return;
      if (n.is_dir && n.expanded) expanded.add(n.path);
      n.children?.forEach(walk);
    }
    walk(root.value);
    const path = workspace.currentFolder;
    const { children, truncated } = await load.loadDir(path);
    async function rehydrate(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.is_dir && expanded.has(n.path)) {
          const sub = await load.loadDir(n.path);
          n.children = sub.children;
          n.truncated = sub.truncated;
          n.expanded = true;
          await rehydrate(sub.children);
        }
      }
    }
    await rehydrate(children);
    if (root.value) {
      root.value.children = children;
      root.value.truncated = truncated;
      root.value.loading = false;
    }
    // Creating / deleting / moving a file can change which folders hold a match
    // for the extension filter (#282). This runs after every tree refresh
    // rather than on a `watch(root)`, because the refresh mutates the root node
    // in place — the ref identity never changes and a watcher would never fire.
    if (filter.extFilter.value.length) void filter.refreshFilterDirs();
  }

  function onSaved() { scheduleRefresh(); }
  function onRemotePulled() { scheduleRefresh(); }

  let unlistenIndex: UnlistenFn | null = null;
  let unlistenCapture: UnlistenFn | null = null;
  /** Closing the window while a delete is pending: run it. The user asked for
   *  the delete and saw it happen; having the file reappear on next launch would
   *  be the surprise, not the safety. Best-effort — the IPC may not land. */
  function onBeforeUnload() {
    void pendingDeletes.flushAll();
  }

  onMounted(async () => {
    window.addEventListener('solomd:saved', onSaved as EventListener);
    window.addEventListener('solomd:remote-pulled', onRemotePulled as EventListener);
    window.addEventListener('beforeunload', onBeforeUnload);
    try {
      unlistenIndex = await eventsPort.listen('solomd://index-updated', () => scheduleRefresh());
    } catch {}
    try {
      // A quick capture writes straight to disk from Rust; without this the new
      // Inbox note is invisible until something else happens to refresh.
      unlistenCapture = await eventsPort.listen('solomd://capture-written', () => scheduleRefresh());
    } catch {}
  });
  onBeforeUnmount(() => {
    window.removeEventListener('solomd:saved', onSaved as EventListener);
    window.removeEventListener('solomd:remote-pulled', onRemotePulled as EventListener);
    window.removeEventListener('beforeunload', onBeforeUnload);
    // Hiding the tree unmounts it; a selection left behind would keep aiming
    // "new file" at a folder the user can no longer see.
    setTreeSelection(null);
    if (unlistenIndex) unlistenIndex();
    if (unlistenCapture) unlistenCapture();
    if (refreshDebounce) clearTimeout(refreshDebounce);
  });

  return { scheduleRefresh, refreshTreePreservingExpansion };
}

export type TreeRefresh = ReturnType<typeof useTreeRefresh>;
