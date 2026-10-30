import { watch } from 'vue';
import { fsPort } from '../../../platform/index.ts';
import { useWorkspaceStore } from '../../../stores/workspace';
import { useFiles } from '../../../composables/useFiles';
import { useSettingsStore } from '../../../stores/settings';
import { usePendingDeletes, isDeletePending } from '../../../composables/usePendingDeletes';
import { isSafPath, fromSafPath, safList } from '../../../lib/saf-fs';
import { sortNeedsTimes } from '../../../lib/tree-sort';
import { clearRevealedPath } from './useFileTreeReveal.ts';
import type { FileTreeState } from './useFileTreeState.ts';
import type { TreeSort } from './useTreeSort.ts';
import type { TreeNode } from './tree-types.ts';

/** Sentinel emitted by the Rust backend when it truncated a huge dir
 * past the 10,000-entry hard cap. We surface it as a dedicated UI
 * row instead of rendering it as a fake file. */
const TRUNCATED_SENTINEL = '__solomd_truncated__';
const DEFAULT_ASSETS_DIR = '_assets';

export function useTreeLoad(state: FileTreeState, sort: TreeSort) {
  const { root, selected, rootMissing } = state;
  const workspace = useWorkspaceStore();
  const files = useFiles();
  const settings = useSettingsStore();
  const pendingDeletes = usePendingDeletes();

  /**
   * #325 — attachment folders are the app's, not the user's: pasted images land
   * there and notes link into them by path, so renaming or moving one by
   * accident breaks every image in the folder. They are treated like dot-folders
   * — out of the tree unless "Show hidden files" is on. Both attachment modes:
   * the shared folder (`_assets`, or whatever it was renamed to) and the
   * per-file `<note>.assets/` folders.
   */
  function isAttachmentDir(name: string): boolean {
    return name === (settings.assetsDirName || DEFAULT_ASSETS_DIR) || /\.assets$/i.test(name);
  }
  function hiddenInTree(e: { name: string; is_dir: boolean }): boolean {
    if (settings.explorerShowHidden) return false;
    return e.name.startsWith('.') || (e.is_dir && isAttachmentDir(e.name));
  }

  async function loadDir(path: string): Promise<{ children: TreeNode[]; truncated: boolean }> {
    try {
      // #148 — SAF vault: list children via ContentResolver, not std::fs.
      if (isSafPath(path) && workspace.safTreeUri) {
        const safChildren = await safList(workspace.safTreeUri, fromSafPath(path));
        // A delete still inside its undo window is presented as done — the file
        // is on disk for a few more seconds but the user has been told it is gone.
        // The hidden-file filter is applied here rather than in the Kotlin
        // lister, so the setting means the same thing on a SAF vault as on a
        // plain folder.
        return {
          children: sort.sortChildren(
            path,
            (safChildren as TreeNode[]).filter((c) => !isDeletePending(c.path) && !hiddenInTree(c)),
          ),
          truncated: false,
        };
      }
      const entries = await fsPort.listDir({
        path,
        showHidden: settings.explorerShowHidden,
        withTimes: sortNeedsTimes(sort.sortMode.value),
      });
      let truncated = false;
      const filtered: TreeNode[] = [];
      for (const e of entries) {
        if (e.name === TRUNCATED_SENTINEL && !e.is_dir && e.path === '') {
          truncated = true;
          continue;
        }
        if (isDeletePending(e.path)) continue;
        if (hiddenInTree(e)) continue;
        filtered.push({ ...e });
      }
      // A successful listing clears the "folder is gone" state, so putting the
      // folder back (or reconnecting the drive) recovers on the next refresh
      // rather than needing the workspace re-picked.
      if (path === workspace.currentFolder) rootMissing.value = false;
      return { children: sort.sortChildren(path, filtered), truncated };
    } catch (e) {
      console.error('list_dir failed', e);
      // Only the root's disappearance is worth a special state; a subfolder that
      // vanished mid-expand just lists as empty.
      if (path === workspace.currentFolder) {
        try {
          rootMissing.value = !(await fsPort.fsDirExists({ path }));
        } catch {
          rootMissing.value = false;
        }
      }
      return { children: [], truncated: false };
    }
  }

  async function refreshRoot() {
    if (!workspace.currentFolder) {
      root.value = null;
      return;
    }
    const path = workspace.currentFolder;
    rootMissing.value = false;
    root.value = {
      name: isSafPath(path) ? workspace.safName ?? 'Vault' : path.split(/[\\/]/).pop() ?? path,
      path,
      is_dir: true,
      expanded: true,
      loading: true,
    };
    const { children, truncated } = await loadDir(path);
    // If a newer setFolder fired during the await, root.value now points at a
    // different node — discarding our stale result is correct. Same v2.3.1
    // pattern that fixed FileTree-stuck-on-Loading.
    if (root.value && root.value.path === path) {
      root.value.children = children;
      root.value.truncated = truncated;
      root.value.loading = false;
    }
  }

  /** Open a folder row, listing it first if it has never been opened. Used by
   *  the code paths that need a folder open (create in it, reveal, drag-hover)
   *  — unlike toggle() it neither closes an open folder, moves the selection,
   *  nor waits for a double click. */
  async function expandDir(node: TreeNode) {
    if (node.expanded) return;
    if (!node.children) {
      node.loading = true;
      const { children, truncated } = await loadDir(node.path);
      node.children = children;
      node.truncated = truncated;
      node.loading = false;
    }
    node.expanded = true;
  }

  async function toggle(node: TreeNode, how: 'click' | 'dblclick' = 'click') {
    // #338 — with "double-click opens folders" a single click on a folder only
    // selects it, and the double click toggles. Without it, a double click is
    // just two clicks (open, close) as it always was, so its own event is
    // ignored — and files open on the first click either way.
    const dblFolders = node.is_dir && settings.explorerDoubleClickFolders;
    if (how === 'dblclick' && !dblFolders) return;
    selected.value = { path: node.path, isDir: !!node.is_dir };
    if (!node.is_dir) {
      await files.openPath(node.path);
      return;
    }
    if (dblFolders && how === 'click') return;
    if (node.expanded) {
      node.expanded = false;
      return;
    }
    await expandDir(node);
  }

  watch(
    () => workspace.currentFolder,
    () => {
      // Leaving the folder ends the undo offer — the toast is about to be out of
      // sight, and a timer that fires against another workspace is a trap.
      void pendingDeletes.flushAll();
      // A reveal highlight belongs to the workspace it was asked for: the same
      // path in the next one must not inherit it.
      clearRevealedPath();
      // Same for the selection: a save dialog aimed at the previous vault's
      // folder is the trap this whole selection exists to avoid.
      selected.value = null;
      void sort.loadManualOrder().then(refreshRoot);
    },
    { immediate: true },
  );

  return { loadDir, refreshRoot, expandDir, toggle };
}

export type TreeLoad = ReturnType<typeof useTreeLoad>;
