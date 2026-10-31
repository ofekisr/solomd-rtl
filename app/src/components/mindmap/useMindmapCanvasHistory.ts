import type { Ref } from 'vue';
import type { MindElixirInstance, NodeObj, Topic } from 'mind-elixir';
import { sanitizeNodeObj } from '../../lib/mindmap/format';
import { pathTo } from '../../lib/mindmap/focus';
import { fullRoot } from './useMindmapCanvasFocus.ts';

const BEGIN_EDIT_OPERATION = 'beginEdit';

export interface HistoryDeps {
  getMind(): MindElixirInstance | null;
  isLocked(): boolean;
  isEditBlocked(): boolean;
  onSelection(nodes: NodeObj[]): void;
  focusId: Ref<string | null>;
  focusById(id: string | null): void;
  refreshStrip(knownRoot?: NodeObj | null): void;
  reapplyFocus(): void;
  leaveFocusQuietly(): void;
  syncLabels(): void;
  scheduleSync(): void;
  scheduleDuplicateCount(): void;
}

function sanitizedTopic(tpc: Topic): Topic | null {
  const nodeObj: NodeObj | null = sanitizeNodeObj(tpc.nodeObj);
  return nodeObj ? ({ nodeObj } as Topic) : null;
}

export function useMindmapCanvasHistory(deps: HistoryDeps) {
  function emitSelection(): void {
    deps.onSelection(deps.getMind()?.currentNodes?.map((tpc) => tpc.nodeObj) ?? []);
  }

  function onOperation(info: { name: string }): void {
    if (info.name === BEGIN_EDIT_OPERATION) return;
    deps.syncLabels();
    deps.scheduleSync();
    deps.scheduleDuplicateCount();
    const mind = deps.getMind();
    const root = mind ? fullRoot(mind) : null;
    if (deps.focusId.value !== null && root && !pathTo(root, deps.focusId.value)) deps.focusById(null);
    else deps.refreshStrip(root);
    emitSelection();
  }

  function afterHistoryJump(): void {
    deps.reapplyFocus();
    deps.syncLabels();
    deps.scheduleSync();
    deps.scheduleDuplicateCount();
    emitSelection();
    deps.refreshStrip();
  }

  function syncAfterHistoryJumps(instance: MindElixirInstance): void {
    const { undo, redo } = instance;
    instance.undo = () => {
      if (deps.isLocked()) return;
      deps.leaveFocusQuietly();
      undo.call(instance);
      afterHistoryJump();
    };
    instance.redo = () => {
      if (deps.isLocked()) return;
      deps.leaveFocusQuietly();
      redo.call(instance);
      afterHistoryJump();
    };
  }

  function sanitizeCopiedNodes(instance: MindElixirInstance): void {
    const { copyNodes } = instance;
    instance.copyNodes = (tpcs, to) => {
      if (deps.isEditBlocked()) return Promise.resolve();
      const safe = tpcs.map(sanitizedTopic).filter((tpc): tpc is Topic => tpc !== null);
      return copyNodes.call(instance, safe, to);
    };
  }

  function guardRemovedNodes(instance: MindElixirInstance): void {
    const { removeNodes } = instance;
    instance.removeNodes = (tpcs) => {
      if (deps.isEditBlocked()) return Promise.resolve();
      return removeNodes.call(instance, tpcs);
    };
  }

  return { emitSelection, onOperation, syncAfterHistoryJumps, sanitizeCopiedNodes, guardRemovedNodes };
}
