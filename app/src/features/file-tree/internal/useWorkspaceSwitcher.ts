import { computed, ref } from 'vue';
import { useWorkspaceStore } from '../../../stores/workspace';
import { useFiles } from '../../../composables/useFiles';

interface SwitcherRow {
  path: string;
  name: string;
  parent: string;
}

// v4.3.5 — workspace switcher dropdown state.
export function useWorkspaceSwitcher() {
  const workspace = useWorkspaceStore();
  const files = useFiles();
  const switcherOpen = ref(false);

  /** Recent folders rendered into the dropdown. Splits each path into the
   *  basename (display) and the parent dir (subtitle), so two folders named
   *  `notes/` from different drives are distinguishable. The current folder
   *  always appears at the top, even if it isn't yet in `recentFolders` —
   *  defends against the (rare) case where session restore set
   *  `currentFolder` without going through `setFolder`. */
  const switcherList = computed(() => {
    const seen = new Set<string>();
    const out: SwitcherRow[] = [];
    const push = (p: string) => {
      if (!p || seen.has(p)) return;
      seen.add(p);
      const parts = p.split(/[\\/]/).filter(Boolean);
      const name = parts.length > 0 ? parts[parts.length - 1] : p;
      const parent = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      out.push({ path: p, name, parent });
    };
    if (workspace.currentFolder) push(workspace.currentFolder);
    for (const p of workspace.recentFolders) push(p);
    return out;
  });

  function toggleSwitcher() {
    switcherOpen.value = !switcherOpen.value;
  }
  function closeSwitcher() {
    switcherOpen.value = false;
  }
  async function pickRecentFolder(path: string) {
    closeSwitcher();
    if (path === workspace.currentFolder) return;
    workspace.setFolder(path);
  }
  async function openFolderAndClose() {
    closeSwitcher();
    await files.openFolder();
  }
  /** #118 — close the current workspace folder (return to the no-folder state).
   *  `setFolder(null)` is already a supported "closed workspace" state; this just
   *  exposes it, since previously a folder once opened could never be closed. */
  function closeFolder() {
    closeSwitcher();
    workspace.setFolder(null);
  }

  return {
    switcherOpen, switcherList, toggleSwitcher, closeSwitcher,
    pickRecentFolder, openFolderAndClose, closeFolder,
  };
}

export type WorkspaceSwitcher = ReturnType<typeof useWorkspaceSwitcher>;
