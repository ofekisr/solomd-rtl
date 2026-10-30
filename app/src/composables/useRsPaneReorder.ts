/**
 * #131 — right-sidebar pane reordering via the ⋮⋮ grip.
 *
 * HTML5 drag-and-drop does not work here: the Tauri webview ships with
 * `dragDropEnabled: true` (native OS file drop), and that handler swallows
 * in-webview DnD. Pointer events are not intercepted, so the reorder tracks
 * the pane under the cursor and commits on pointerup. Mouse, trackpad and
 * touch alike.
 */
import { ref } from 'vue';
import { useSettingsStore } from '../stores/settings';

const PRIMARY_BUTTON = 0;

function paneUnder(x: number, y: number): string | null {
  const host = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-rs-pane]');
  return host?.getAttribute('data-rs-pane') || null;
}

export function useRsPaneReorder() {
  const settings = useSettingsStore();
  const draggingPaneId = ref<string | null>(null);
  const dragOverPaneId = ref<string | null>(null);

  function commitMove(): void {
    const src = draggingPaneId.value;
    const tgt = dragOverPaneId.value;
    draggingPaneId.value = null;
    dragOverPaneId.value = null;
    if (!src || !tgt || src === tgt) return;
    // Index into the full order (not the visible subset) so it survives toggling panes.
    const targetIdx = (settings.rsPaneOrder || []).indexOf(tgt);
    if (targetIdx < 0) return;
    settings.moveRsPane(src, targetIdx);
  }

  function startPaneReorder(e: PointerEvent, id: string): void {
    if (e.button !== PRIMARY_BUTTON && e.pointerType === 'mouse') return;
    e.preventDefault();
    draggingPaneId.value = id;
    dragOverPaneId.value = null;
    const onMove = (m: PointerEvent) => {
      const over = paneUnder(m.clientX, m.clientY);
      dragOverPaneId.value = over && over !== id ? over : null;
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      commitMove();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  return { draggingPaneId, dragOverPaneId, startPaneReorder };
}
