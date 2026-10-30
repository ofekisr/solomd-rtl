import { onBeforeUnmount, onMounted } from 'vue';
import type { FileTreeState } from './useFileTreeState.ts';
import type { WorkspaceSwitcher } from './useWorkspaceSwitcher.ts';

/** Close the context menu and popovers on any outside click / escape. */
export function useTreeWindowKeys(state: FileTreeState, switcher: WorkspaceSwitcher, closeCtx: () => void) {
  const { ctx, editing, filterOpen, sortOpen } = state;

  function onWindowClick() {
    filterOpen.value = false;
    sortOpen.value = false;
    if (switcher.switcherOpen.value) switcher.closeSwitcher();
    if (!ctx.value) return;
    closeCtx();
  }
  function onWindowKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeCtx();
      switcher.closeSwitcher();
      filterOpen.value = false;
      sortOpen.value = false;
      if (editing.value) editing.value = null;
    }
  }
  onMounted(() => {
    window.addEventListener('click', onWindowClick);
    window.addEventListener('keydown', onWindowKey);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('click', onWindowClick);
    window.removeEventListener('keydown', onWindowKey);
  });
}
