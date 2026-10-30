import { ref } from 'vue';
import { fsPort } from '../../../platform/index.ts';
import { useToastsStore } from '../../../stores/toasts';
import { useI18n } from '../../../i18n';
import { usePendingDeletes, UNDO_WINDOW_MS } from '../../../composables/usePendingDeletes';
import type { TreeRefresh } from './useTreeRefresh.ts';
import type { TreeNode } from './tree-types.ts';

// ---------------------------------------------------------------------------
// Delete — confirmed in the app, then held briefly so the toast can take it
// back.
//
// The confirmation used to be `window.confirm`, i.e. the webview's own dialog:
// unstyled next to everything else, suppressed outright on some platforms, and
// English-only. A mis-aimed right-click → Delete was also one keystroke away
// from losing a folder, so the confirmation has to be something the user
// really sees. It is a real dialog now (DsModal, which handles Escape, focus
// and the backdrop), with the file/folder wording and the trash-vs-permanent
// note coming from the locale files.
// ---------------------------------------------------------------------------
export function useTreeDelete(refresh: TreeRefresh, closeCtx: () => void) {
  const toasts = useToastsStore();
  const pendingDeletes = usePendingDeletes();
  const { t } = useI18n();

  const deleteTarget = ref<TreeNode | null>(null);

  function deleteNode(node: TreeNode) {
    closeCtx();
    deleteTarget.value = node;
  }

  async function confirmDelete() {
    const node = deleteTarget.value;
    deleteTarget.value = null;
    if (!node) return;

    // The delete is held for a few seconds so the toast can offer Undo. The
    // file is untouched until then; the tree hides it in the meantime.
    const path = node.path;
    const name = node.name;
    await pendingDeletes.schedule({
      path,
      name,
      isDir: !!node.is_dir,
      delayMs: UNDO_WINDOW_MS,
      commit: async () => {
        try {
          await fsPort.fsDelete({ path });
        } catch (e) {
          toasts.error(`Delete failed: ${e}`);
        }
        refresh.scheduleRefresh();
      },
    });
    refresh.scheduleRefresh();
    toasts.push(t('explorer.deleted', { name }), 'success', UNDO_WINDOW_MS, () => {
      if (!pendingDeletes.undo(path)) return;
      refresh.scheduleRefresh();
      toasts.info(t('explorer.deleteUndone', { name }));
    }, { actionLabel: t('explorer.undo') });
  }

  return { deleteTarget, deleteNode, confirmDelete };
}
