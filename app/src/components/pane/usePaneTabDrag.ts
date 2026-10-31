import { onBeforeUnmount, type Ref } from 'vue';
import type { useTabsStore } from '../../stores/tabs';
import type { useTilesStore } from '../../stores/tiles';
import type { useFiles } from '../../composables/useFiles';
import type { SplitDirection } from '../../types';

export interface PaneTabDragDeps {
  paneId: () => string;
  tabsEl: Ref<HTMLElement | null>;
  tabs: ReturnType<typeof useTabsStore>;
  tiles: ReturnType<typeof useTilesStore>;
  files: ReturnType<typeof useFiles>;
}

export function usePaneTabDrag({ paneId, tabsEl, tabs, tiles, files }: PaneTabDragDeps) {
  // ---- Pointer-based drag: reorder within the bar + drag-to-split across panes
  // ----
  // #86 — we deliberately do NOT use the HTML5 Drag and Drop API. On Windows,
  // Tauri's native drag-drop (`dragDropEnabled`, which the app relies on for
  // dropping files from Explorer into the editor — see App.vue onDragDropEvent)
  // makes WebView2 swallow every in-page `draggable` drag at the OS level: the
  // cursor shows 🚫 and tabs won't move. Pointer events bypass that interception
  // and behave identically on macOS, Windows, and Linux.
  const SPLIT_EDGE = 50; // px from a pane edge that arms drag-to-split
  const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag

  let pointerStart: { x: number; y: number; tabId: string } | null = null;
  let dragging = false;
  // Set briefly after a real drag so the trailing synthetic `click` doesn't
  // re-activate the tab the user just dropped.
  let suppressClick = false;

  function onTabPointerDown(e: PointerEvent, tabId: string) {
    // Left button only — middle closes the tab, right opens the context menu.
    if (e.button !== 0) return;
    pointerStart = { x: e.clientX, y: e.clientY, tabId };
    dragging = false;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }

  // Hit-test the element under the pointer for a drag-to-split target: a pane
  // edge that is NOT over the tab bar (positions over a tab bar are reorders).
  function paneSplitAt(x: number, y: number): { paneId: string; direction: SplitDirection } | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el || el.closest('.pane-tabbar')) return null;
    const pane = el.closest('[data-pane-id]') as HTMLElement | null;
    const paneId = pane?.getAttribute('data-pane-id');
    if (!pane || !paneId) return null;
    const r = pane.getBoundingClientRect();
    const lx = x - r.left;
    const ly = y - r.top;
    if (lx < SPLIT_EDGE || lx > r.width - SPLIT_EDGE) return { paneId, direction: 'horizontal' };
    if (ly < SPLIT_EDGE || ly > r.height - SPLIT_EDGE) return { paneId, direction: 'vertical' };
    return null;
  }

  function tabIdAt(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return (el?.closest('[data-tab-id]') as HTMLElement | null)?.getAttribute('data-tab-id') ?? null;
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointerStart) return;
    if (!dragging) {
      const moved = Math.abs(e.clientX - pointerStart.x) + Math.abs(e.clientY - pointerStart.y);
      if (moved < DRAG_THRESHOLD) return;
      dragging = true;
      tiles.beginTabDrag(pointerStart.tabId);
    }
    tiles.setDragSplit(paneSplitAt(e.clientX, e.clientY));
  }

  function teardownPointer() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
  }

  function onPointerCancel() {
    teardownPointer();
    pointerStart = null;
    dragging = false;
    tiles.endTabDrag();
  }

  function onPointerUp(e: PointerEvent) {
    teardownPointer();
    const start = pointerStart;
    pointerStart = null;
    if (!dragging || !start) {
      dragging = false;
      return;
    }
    dragging = false;
    suppressClick = true;

    const split = paneSplitAt(e.clientX, e.clientY);
    if (split) {
      tiles.splitPane(split.paneId, split.direction, start.tabId);
    } else {
      // Reorder: insert relative to the tab under the pointer. Right half of the
      // target inserts AFTER it, left half BEFORE — same rule as before.
      const overId = tabIdAt(e.clientX, e.clientY);
      if (overId && overId !== start.tabId) {
        const targetIdx = tabs.tabs.findIndex((t) => t.id === overId);
        if (targetIdx >= 0) {
          const overEl = tabsEl.value?.querySelector<HTMLElement>(`[data-tab-id="${overId}"]`);
          const rect = overEl?.getBoundingClientRect();
          const after = rect ? e.clientX > rect.left + rect.width / 2 : false;
          tabs.reorder(start.tabId, after ? targetIdx + 1 : targetIdx);
        }
      }
    }
    tiles.endTabDrag();
  }

  function onTabClick(tabId: string) {
    // Swallow the click that immediately follows a drag-drop.
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    tiles.setActiveTab(paneId(), tabId);
  }

  // ---- Horizontal scroll: mouse wheel over the tab strip (#106) ----
  // The bar hides its scrollbar, so without this hidden/overflowing tabs are
  // unreachable on a trackpad/mouse. Translate vertical wheel deltas into
  // horizontal scroll; honor native horizontal deltas (deltaX) as-is.
  function onTabsWheel(e: WheelEvent) {
    const el = tabsEl.value;
    if (!el) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    el.scrollLeft += delta;
  }

  // ---- Middle-button: drag-to-pan, or close on a clean click (#106) ----
  // #89 added middle-click-to-close. To also restore middle-drag panning we
  // distinguish the two: motion past DRAG_THRESHOLD pans the strip and cancels
  // the close; a middle press with no real movement closes the tab on release.
  let middleStart: { x: number; scrollLeft: number; tabId: string } | null = null;
  let middleDragging = false;

  function onMiddlePointerDown(e: MouseEvent, tabId: string) {
    // Prevent the OS auto-scroll affordance some platforms attach to middle-press.
    e.preventDefault();
    middleStart = { x: e.clientX, scrollLeft: tabsEl.value?.scrollLeft ?? 0, tabId };
    middleDragging = false;
    window.addEventListener('mousemove', onMiddleMove);
    window.addEventListener('mouseup', onMiddleUp);
  }

  function onMiddleMove(e: MouseEvent) {
    if (!middleStart) return;
    const dx = e.clientX - middleStart.x;
    if (!middleDragging && Math.abs(dx) < DRAG_THRESHOLD) return;
    middleDragging = true;
    // Drag right reveals tabs to the right: pulling the strip with the cursor.
    if (tabsEl.value) tabsEl.value.scrollLeft = middleStart.scrollLeft - dx;
  }

  function onMiddleUp() {
    window.removeEventListener('mousemove', onMiddleMove);
    window.removeEventListener('mouseup', onMiddleUp);
    const start = middleStart;
    middleStart = null;
    // No real motion → treat as a click and close the tab (#89 behavior).
    const isPinned = !!start && !!tabs.tabs.find((x) => x.id === start.tabId)?.pinned;
    if (!middleDragging && start && !isPinned) files.closeTabSafe(start.tabId);
    middleDragging = false;
  }

  onBeforeUnmount(() => {
    teardownPointer();
    window.removeEventListener('mousemove', onMiddleMove);
    window.removeEventListener('mouseup', onMiddleUp);
  });

  return { onTabPointerDown, onTabClick, onTabsWheel, onMiddlePointerDown };
}
