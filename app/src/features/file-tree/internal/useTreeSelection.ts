import { watch } from 'vue';
import { useTabsStore } from '../../../stores/tabs';
import { parentDirOf, setTreeSelection } from '../../../lib/new-file-target';
import type { FileTreeState } from './useFileTreeState.ts';

// ---------------------------------------------------------------------------
// Selection — the row the user last touched, and the folder a new entry goes
// into. Clicking a file opens it and clicking a folder toggles it; either way
// that row becomes the selection. "New file" then means "here": a selected
// folder is the destination, a selected file sends the note to its own folder
// (see lib/new-file-target.ts, which the save dialog reads too).
//
// The open document drives it as well, so the file being read is the
// selection without needing a click on its row — which is also what gets the
// row highlighted in the tree.
// ---------------------------------------------------------------------------
export function useTreeSelection(state: FileTreeState) {
  const { selected, root, findNode } = state;
  const tabs = useTabsStore();

  watch(selected, (sel) => setTreeSelection(sel), { immediate: true });
  watch(
    () => tabs.activeTab?.filePath,
    (path) => {
      if (path) selected.value = { path, isDir: false };
    },
    { immediate: true },
  );

  /** Folder the header ＋ / context menu creates in: the selected folder, the
   *  selected file's folder, else the vault root. Only rows that are actually in
   *  the tree count — a selected document can live outside the open workspace,
   *  and an entry created there would have no row to appear in (#321). */
  function newEntryParent(): string {
    const sel = selected.value;
    const node = sel ? findNode(sel.path) : null;
    if (node) {
      const dir = node.is_dir ? node.path : parentDirOf(node.path);
      if (dir) return dir;
    }
    return root.value?.path ?? '';
  }

  return { newEntryParent };
}
