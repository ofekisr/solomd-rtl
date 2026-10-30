import { nextTick, watch } from 'vue';
import { useToastsStore } from '../../../stores/toasts';
import { useTabsStore } from '../../../stores/tabs';
import { useSettingsStore } from '../../../stores/settings';
import { useI18n } from '../../../i18n';
import {
  revealRequest,
  revealedPath,
  clearRevealRequest,
  clearRevealedPath,
} from './useFileTreeReveal.ts';
import { newFileInTreeRequest, clearNewFileInTreeRequest } from './useFileTreeNewFile.ts';
import type { FileTreeState } from './useFileTreeState.ts';
import type { TreeLoad } from './useTreeLoad.ts';
import { segmentsUnderRoot } from './tree-paths.ts';
import type { TreeNode } from './tree-types.ts';

const REVEAL_HOLD_MS = 3200;
const REVEAL_TOAST_MS = 6000;

interface RevealDeps {
  newEntryParent: () => string;
  startNewFile: (parent: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// "Reveal in File Tree" — the tab's context menu asks for a file, the tree
// expands down to it and highlights the row.
//
// The old implementation re-rooted the workspace at the file's parent folder,
// which is destructive (the switcher's recents, the per-workspace tab set) and
// was a visible no-op whenever the file already lived directly in the open
// workspace root — the reported "nothing happens". Revealing is a view action:
// it must not move the user's workspace. Rooting elsewhere only happens for a
// file that is genuinely outside it, because then there is nothing to reveal.
//
// The highlight itself is deliberately loud and temporary: a fill + ring + a
// short fade, so it reads in a theme whose accent is close to the row colour
// (a colour-only tint was reported as invisible).
// ---------------------------------------------------------------------------
export function useTreeRevealRow(state: FileTreeState, load: TreeLoad, deps: RevealDeps) {
  const { root, selected, treeBody } = state;
  const toasts = useToastsStore();
  const tabs = useTabsStore();
  const settings = useSettingsStore();
  const { t } = useI18n();

  let revealTimer: ReturnType<typeof setTimeout> | null = null;

  function rowElementFor(path: string): HTMLElement | null {
    const rows = treeBody.value?.querySelectorAll<HTMLElement>('.ftree__item');
    for (const row of rows ?? []) {
      if (row.dataset.path === path) return row;
    }
    return null;
  }

  /** Highlight a row that is already on screen and scroll it into view. */
  function flashRow(path: string, row: HTMLElement) {
    revealedPath.value = path;
    row.scrollIntoView({ block: 'center' });
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = setTimeout(() => {
      revealTimer = null;
      clearRevealedPath();
    }, REVEAL_HOLD_MS);
  }

  /** Expand every folder on the way down, then flash the row. False when the
   *  file is not reachable in the tree (filtered out, hidden, or truncated).
   *
   *  `quiet` is the automatic follow (#333): no flash, and the row is only
   *  scrolled as far as needed to be visible, so switching between two files
   *  that are both on screen does not move the tree at all. */
  async function revealRow(path: string, quiet = false): Promise<boolean> {
    const show = (row: HTMLElement) =>
      quiet ? row.scrollIntoView({ block: 'nearest' }) : flashRow(path, row);
    // Already rendered — its ancestors are expanded. Checked first because it
    // also covers SAF vaults, whose node paths are opaque `saf:<docId>` values
    // that cannot be walked by prefix.
    const shown = rowElementFor(path);
    if (shown) {
      show(shown);
      return true;
    }
    const parts = segmentsUnderRoot(root.value?.path, path);
    if (!parts || parts.length === 0 || !root.value) return false;
    let node: TreeNode = root.value;
    for (const seg of parts.slice(0, -1)) {
      const dir = node.children?.find((c) => c.is_dir && c.name === seg);
      if (!dir) return false;
      if (!dir.expanded) await load.expandDir(dir);
      node = dir;
    }
    if (!node.children?.some((c) => c.path === path)) return false;
    await nextTick();
    const row = rowElementFor(path);
    if (!row) return false;
    show(row);
    return true;
  }

  /** Serve a parked request, once the tree is in a position to answer it. */
  async function serveRevealRequest() {
    const path = revealRequest.value;
    // A directory read is in flight — the request is served when it lands, so a
    // reveal that raced a workspace switch is not dropped.
    if (!path || !root.value || root.value.loading) return;
    clearRevealRequest();
    if (!(await revealRow(path))) toasts.warning(t('explorer.revealHidden'), REVEAL_TOAST_MS);
  }

  watch(
    [revealRequest, () => root.value?.path, () => root.value?.loading],
    () => {
      void serveRevealRequest();
    },
    // `immediate` matters: the tree is `v-if`'d on the sidebar toggle, so a
    // reveal can arrive (and park) while this component does not exist yet —
    // a request that is already set when the tree mounts would otherwise never
    // be seen, because a non-immediate watcher only reacts to later changes.
    { immediate: true },
  );

  // #333 — follow the active document. Switching tabs (or opening a file)
  // expands the folders above it and brings its row into view, the way an IDE's
  // "always select opened file" does; the row is already highlighted because
  // the active file is the selection (see `selected` in useTreeSelection).
  // Quiet on purpose: no flash, no toast when the file is filtered out, and
  // never a workspace re-root — a document outside the open folder is simply
  // not followed. Only the tab changing triggers it, so the tree is not yanked
  // back while the user scrolls it.
  watch(
    [() => tabs.activeTab?.filePath, () => root.value?.path, () => root.value?.loading],
    ([path, , loading]) => {
      if (!settings.explorerFollowActive || !path || loading || !root.value) return;
      if (segmentsUnderRoot(root.value?.path, path) === null && !rowElementFor(path)) return;
      void revealRow(path, true).then((ok) => {
        // A workspace load clears the selection (see the root watcher in
        // useTreeLoad), which also dropped the highlight when the tab was
        // opened before the tree had listed. The followed file is inside this
        // tree, so it is the selection again.
        if (ok && tabs.activeTab?.filePath === path) selected.value = { path, isDir: false };
      });
    },
    { immediate: true },
  );

  // #338 — the "new file in selected folder" shortcut. Same parked-request
  // shape as the reveal above: served once the root has listed.
  watch(
    [newFileInTreeRequest, () => root.value?.path, () => root.value?.loading],
    () => {
      if (!newFileInTreeRequest.value || !root.value || root.value.loading) return;
      clearNewFileInTreeRequest();
      void deps.startNewFile(deps.newEntryParent());
    },
    { immediate: true },
  );
}
