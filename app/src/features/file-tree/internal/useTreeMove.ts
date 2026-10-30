import { computed, ref } from 'vue';
import { fsPort } from '../../../platform/index.ts';
import { useWorkspaceStore } from '../../../stores/workspace';
import { useSettingsStore } from '../../../stores/settings';
import { useToastsStore } from '../../../stores/toasts';
import { useTabsStore } from '../../../stores/tabs';
import { useI18n } from '../../../i18n';
import { usePendingDeletes, UNDO_WINDOW_MS } from '../../../composables/usePendingDeletes';
import { isSafPath } from '../../../lib/saf-fs';
import { canDropInto, baseName } from './useTreeDrag.ts';
import type { TreeRefresh } from './useTreeRefresh.ts';
import { joinPath, pathFromRelative, rootRelative } from './tree-paths.ts';
import { repointTabs } from './tree-repoint.ts';
import type { TreeNode } from './tree-types.ts';

// ---------------------------------------------------------------------------
// #290 / #267 — moving files and folders between folders.
//
// Two entry points, one implementation: drag a node onto a folder, or pick
// "Move to…" from the context menu. The picker is not a nicety — the drag is
// mouse-only (on a touchscreen a press-and-drag over a scrollable list is a
// scroll) and isn't reachable from the keyboard at all, so without the picker
// the feature wouldn't exist on mobile.
// ---------------------------------------------------------------------------
export function useTreeMove(refresh: TreeRefresh, closeCtx: () => void) {
  const workspace = useWorkspaceStore();
  const settings = useSettingsStore();
  const toasts = useToastsStore();
  const tabs = useTabsStore();
  const pendingDeletes = usePendingDeletes();
  const { t } = useI18n();

  /** A plain filesystem vault, i.e. not a SAF one (#148, Android), where files
   *  are addressed by content-URI and the std::fs-backed commands don't apply.
   *  Two features are gated on it: moving (there is no ContentResolver move, so
   *  a drag would fail at the IPC boundary) and the file-type filter (both of
   *  its backend walks need real paths). Gating beats offering a dead control. */
  const localVault = computed(
    () => !!workspace.currentFolder && !isSafPath(workspace.currentFolder),
  );
  const canMove = localVault;

  const moveDialog = ref<{ node: TreeNode; dirs: string[] } | null>(null);

  function relativeToRoot(p: string): string {
    return rootRelative(workspace.currentFolder ?? '', p);
  }

  function rootLabel(): string {
    return t('explorer.vaultRoot') || 'Vault root';
  }

  async function moveNode(from: string, destDir: string, isDir: boolean) {
    if (!canDropInto(from, destDir)) return;
    const name = baseName(from);
    const target = joinPath(destDir, name);
    try {
      // A pending delete on the destination path would fire later and take the
      // moved file with it. Same race the new-file path guards against.
      await pendingDeletes.flushUnder(target);
      await fsPort.fsMove({ from, to: target });
    } catch (err) {
      // By far the likeliest failure, and the raw Rust string is half English
      // and half absolute path — say it in the user's language instead.
      const exists = String(err).includes('target already exists');
      toasts.error(
        exists
          ? t('explorer.moveExists', { name, dest: relativeToRoot(destDir) || rootLabel() })
          : t('explorer.moveFailed', { name, error: String(err) }),
      );
      return;
    }
    repointTabs(tabs, from, target, isDir);
    refresh.scheduleRefresh();
    toasts.push(
      t('explorer.moved', { name, dest: relativeToRoot(destDir) || rootLabel() }),
      'success',
      UNDO_WINDOW_MS,
      () => {
        void undoMove(target, from, isDir, name);
      },
      { actionLabel: t('explorer.undo') },
    );
  }

  /** Undo is the same move run backwards, which also puts the rewritten
   *  relative links back the way they were. */
  async function undoMove(current: string, original: string, isDir: boolean, name: string) {
    try {
      await fsPort.fsMove({ from: current, to: original });
    } catch (err) {
      toasts.error(
        t('explorer.moveFailed', { name, error: String(err) }) ||
          `Could not move ${name}: ${err}`,
      );
      return;
    }
    repointTabs(tabs, current, original, isDir);
    refresh.scheduleRefresh();
    toasts.info(t('explorer.moveUndone', { name }));
  }

  async function startMoveTo(node: TreeNode) {
    closeCtx();
    const rootPath = workspace.currentFolder;
    if (!rootPath || !canMove.value) return;
    try {
      const dirs = await fsPort.fsListDirs({
        root: rootPath,
        showHidden: settings.explorerShowHidden,
      });
      moveDialog.value = { node, dirs };
    } catch (err) {
      toasts.error(String(err));
    }
  }

  async function onMovePicked(relDir: string) {
    const pending = moveDialog.value;
    moveDialog.value = null;
    const rootPath = workspace.currentFolder;
    if (!pending || !rootPath) return;
    await moveNode(pending.node.path, pathFromRelative(rootPath, relDir), !!pending.node.is_dir);
  }

  return { localVault, canMove, moveDialog, relativeToRoot, moveNode, startMoveTo, onMovePicked };
}

export type TreeMove = ReturnType<typeof useTreeMove>;
