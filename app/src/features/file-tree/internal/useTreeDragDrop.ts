import { useWorkspaceStore } from '../../../stores/workspace';
import { reorderedNames } from '../../../lib/tree-sort';
import {
  dragPath,
  dragIsDir,
  dropTarget,
  endDrag,
  suppressClick,
  canDropInto,
  baseName,
  reorderTarget,
  parentDir,
} from './useTreeDrag.ts';
import type { FileTreeState } from './useFileTreeState.ts';
import type { TreeSort } from './useTreeSort.ts';
import type { TreeLoad } from './useTreeLoad.ts';
import type { TreeMove } from './useTreeMove.ts';
import { orderKey } from './tree-paths.ts';
import { destinationFor, reorderFor, type DestinationProbe, type ReorderTarget, type RowProbe } from './tree-reorder.ts';
import type { TreeNode } from './tree-types.ts';

// --- the drag itself -------------------------------------------------------
//
// Pointer events, NOT the HTML5 Drag and Drop API — see the note in
// useTreeDrag.ts. The short version: `dragDropEnabled: true` (which the app
// needs for "drop a file from Finder to open it") makes the native handler
// swallow in-page drags, and `dragstart` still fires, so the breakage is
// invisible until you actually try to drop something. #86 and #131 both
// learned this the hard way.

const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag
const AUTO_EXPAND_MS = 600;
const SCROLL_EDGE = 28; // px from the tree's edge that starts auto-scrolling
const SCROLL_STEP = 12;
const ROW_SELECTOR = '.ftree__item';

function probeRowAt(x: number, y: number): RowProbe | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const row = el?.closest(ROW_SELECTOR) as HTMLElement | null;
  const path = row?.dataset.path;
  if (!row || !path) return null;
  const r = row.getBoundingClientRect();
  return { path, isDir: row.dataset.dir === '1', frac: (y - r.top) / Math.max(1, r.height) };
}

function probeDestinationAt(x: number, y: number): DestinationProbe {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;
  const row = el.closest(ROW_SELECTOR) as HTMLElement | null;
  if (row) {
    const path = row.dataset.path;
    if (row.dataset.dir === '1') return path ? { kind: 'row', path, isDir: true } : null;
    return { kind: 'row', path: path ?? '', isDir: false };
  }
  // The workspace row and the empty space under the tree both mean "the
  // vault root" — otherwise there is no way to drag something back to the top.
  if (el.closest('.ftree__root') || el.closest('.ftree__list')) return { kind: 'root-area' };
  return null;
}

export function useTreeDragDrop(state: FileTreeState, load: TreeLoad, sort: TreeSort, move: TreeMove) {
  const { root, treeBody, manualOrder, findNode } = state;
  const workspace = useWorkspaceStore();

  let pointerStart: { x: number; y: number; node: TreeNode } | null = null;
  let dragActive = false;
  let expandTimer: ReturnType<typeof setTimeout> | null = null;
  let expandArmedFor = '';

  /** #342 — in manual mode, the top or bottom edge of a sibling row of the
   *  same kind (folder among folders, file among files) means "put it here".
   *  A folder's middle band still means "move into it", so both gestures stay
   *  available; a file row is split in half, since dropping into a file isn't
   *  a thing. Anything else returns null and falls through to the move logic. */
  function reorderAt(x: number, y: number, from: string, fromIsDir: boolean): ReorderTarget | null {
    if (sort.sortMode.value !== 'manual') return null;
    return reorderFor(probeRowAt(x, y), from, fromIsDir);
  }

  async function applyReorder(from: string, target: ReorderTarget) {
    const parent = parentDir(from);
    const parentNode = parent === root.value?.path ? root.value : findNode(parent);
    if (!parentNode?.children) return;
    const next = reorderedNames(parentNode.children, baseName(from), baseName(target.path), target.pos);
    if (!next) return;
    manualOrder.value = { ...manualOrder.value, [orderKey(workspace.currentFolder, parent)]: next };
    parentNode.children = sort.sortChildren(parent, parentNode.children);
    await sort.saveManualOrder();
  }

  /** Which folder the pointer is currently over, or null. Files are not drop
   *  targets: filing into a file's parent reads as "dropped into the file" and
   *  there is no honest way to highlight that. */
  function destinationAt(x: number, y: number): string | null {
    return destinationFor(probeDestinationAt(x, y), root.value?.path);
  }

  /** Spring-loaded folders: resting on a collapsed folder opens it, so a drag
   *  can reach a nested target without being abandoned halfway. */
  function armAutoExpand(dest: string | null) {
    if (dest === expandArmedFor) return;
    expandArmedFor = dest ?? '';
    if (expandTimer) clearTimeout(expandTimer);
    expandTimer = null;
    if (!dest) return;
    const node = findNode(dest);
    if (!node || !node.is_dir || node.expanded) return;
    expandTimer = setTimeout(() => {
      expandTimer = null;
      if (dragActive && !node.expanded) void load.expandDir(node);
    }, AUTO_EXPAND_MS);
  }

  function autoScroll(y: number) {
    const body = treeBody.value;
    if (!body) return;
    const r = body.getBoundingClientRect();
    if (y < r.top + SCROLL_EDGE) body.scrollTop -= SCROLL_STEP;
    else if (y > r.bottom - SCROLL_EDGE) body.scrollTop += SCROLL_STEP;
  }

  /** Mouse only. On a touchscreen a press-and-drag over a scrollable list is
   *  a scroll, so touch users get "Move to…" instead of a drag they'd trigger
   *  by accident. */
  function onNodePress(e: PointerEvent, node: TreeNode) {
    // Clear any suppression left over from a previous drag BEFORE deciding
    // whether this press starts one. When a drag ends on a different row than
    // it started on, the browser dispatches the trailing `click` on the two
    // rows' common ancestor — the <ul> — so no row handler ever consumes the
    // flag, and without this it would swallow the user's *next* click instead.
    suppressClick.value = false;
    if (e.button !== 0 || e.pointerType !== 'mouse' || !move.canMove.value) return;
    pointerStart = { x: e.clientX, y: e.clientY, node };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
    window.addEventListener('pointercancel', onDragCancel);
  }

  function onDragMove(e: PointerEvent) {
    if (!pointerStart) return;
    if (!dragActive) {
      const moved = Math.abs(e.clientX - pointerStart.x) + Math.abs(e.clientY - pointerStart.y);
      if (moved < DRAG_THRESHOLD) return;
      dragActive = true;
      dragPath.value = pointerStart.node.path;
      dragIsDir.value = !!pointerStart.node.is_dir;
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }
    const reorder = reorderAt(e.clientX, e.clientY, dragPath.value ?? '', dragIsDir.value);
    reorderTarget.value = reorder;
    const dest = reorder ? null : destinationAt(e.clientX, e.clientY);
    const legal = dest && canDropInto(dragPath.value ?? '', dest) ? dest : null;
    dropTarget.value = legal;
    armAutoExpand(legal);
    autoScroll(e.clientY);
  }

  function teardownDrag() {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    window.removeEventListener('pointercancel', onDragCancel);
    if (expandTimer) clearTimeout(expandTimer);
    expandTimer = null;
    expandArmedFor = '';
    pointerStart = null;
    dragActive = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    endDrag();
  }

  function onDragCancel() {
    teardownDrag();
  }

  function onDragUp() {
    const from = dragPath.value;
    const dest = dropTarget.value;
    const reorder = reorderTarget.value;
    const isDir = dragIsDir.value;
    const wasDrag = dragActive;
    teardownDrag();
    if (!wasDrag) return;
    // The click that follows this pointerup belongs to the drag, not to the row.
    suppressClick.value = true;
    if (from && reorder) void applyReorder(from, reorder);
    else if (from && dest) void move.moveNode(from, dest, isDir);
  }

  return { onNodePress };
}
