import { ref } from 'vue';
import type { MindElixirInstance, NodeObj } from 'mind-elixir';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';
import { isGate } from '../../lib/mindmap/gates';
import { runAsOneOperation, type OperationBus } from '../../lib/mindmap/batch';
import { remapSummaries as remapChildSummaries, sortChildrenByTopic, type SortOrder } from '../../lib/mindmap/sort';
import { applyNumbers, numberingGroups, type NumberingScope } from '../../lib/mindmap/numbering';
import { hasOpenBranch, planSelectionToggle, setDescendantsExpanded } from '../../lib/mindmap/collapse';

const SORT_TOAST_KEYS: Readonly<Record<SortOrder, string>> = { asc: 'mindmap.sortedAsc', desc: 'mindmap.sortedDesc' };
const TREE_EDIT_OPERATION = 'moveNodeBefore';

export interface TreeEditDeps {
  getMind(): MindElixirInstance | null;
  isEditBlocked(): boolean;
  scheduleSync(): void;
}

function toggleSelectedNodes(instance: MindElixirInstance): boolean {
  const selected = instance.currentNodes ?? [];
  const steps = planSelectionToggle(selected.map((tpc) => tpc.nodeObj), instance.nodeData.id);
  if (steps.length === 0) return false;
  for (const step of steps) instance.expandNode(instance.findEle(step.id), step.expanded);
  const detached = selected.filter((tpc) => !tpc.isConnected);
  if (detached.length === 0) return true;
  instance.unselectNodes(detached);
  const restored = detached.map((tpc) => instance.findEle(tpc.nodeObj.id)).filter((tpc) => tpc?.isConnected);
  if (restored.length > 0) instance.selectNodes(restored);
  return true;
}

function commitTreeEdit(instance: MindElixirInstance, anchor: NodeObj, mutate: () => NodeObj[]): boolean {
  const event: Record<string, unknown> = { name: TREE_EDIT_OPERATION, obj: anchor, objs: [anchor] };
  let isChanged = false;
  runAsOneOperation(instance.bus as unknown as OperationBus, () => {
    isChanged = mutate().length > 0;
    if (isChanged) instance.refresh();
    return isChanged;
  }, event);
  if (isChanged) instance.selectNode(instance.findEle(anchor.id));
  return isChanged;
}

function remapSortedSummaries(instance: MindElixirInstance, target: NodeObj, before: readonly NodeObj[]): number {
  const { kept, droppedCount } = remapChildSummaries(instance.summaries, target.id, before, target.children ?? []);
  instance.summaries = kept;
  return droppedCount;
}

function reselect(instance: MindElixirInstance, nodes: readonly NodeObj[]): void {
  if (nodes.length > 1) instance.selectNodes(nodes.map((n) => instance.findEle(n.id)));
}

export function useMindmapCanvasTreeEdit(deps: TreeEditDeps) {
  const toasts = useToastsStore();
  const { t } = useI18n();
  const pendingNumbering = ref<{ isNumbered: boolean; count: number } | null>(null);

  function canEditTree(): boolean {
    return !!deps.getMind() && !deps.isEditBlocked();
  }

  function selectedNodes(): NodeObj[] {
    return (deps.getMind()?.currentNodes ?? []).map((tpc) => tpc.nodeObj);
  }

  function toggleWholeMap(instance: MindElixirInstance): void {
    setDescendantsExpanded(instance.nodeData, !hasOpenBranch(instance.nodeData));
    instance.refresh();
    instance.toCenter();
    deps.scheduleSync();
  }

  function toggleCollapse(): void {
    const mind = deps.getMind();
    if (mind && !toggleSelectedNodes(mind)) toggleWholeMap(mind);
  }

  function selectRoot(): void {
    const mind = deps.getMind();
    if (!mind) return;
    mind.selectNode(mind.findEle(mind.nodeData.id));
    mind.toCenter();
  }

  function sortSelectedChildren(): void {
    const instance = deps.getMind();
    const target = instance?.currentNode?.nodeObj;
    if (!instance || !target || !canEditTree()) return;
    const result: { order: SortOrder | null; droppedCount: number } = { order: null, droppedCount: 0 };
    commitTreeEdit(instance, target, () => {
      const before = [...(target.children ?? [])];
      result.order = sortChildrenByTopic(target);
      if (result.order) result.droppedCount = remapSortedSummaries(instance, target, before);
      return result.order ? target.children ?? [] : [];
    });
    toasts.info(t(result.order ? SORT_TOAST_KEYS[result.order] : 'mindmap.sortNothing'));
    if (result.droppedCount > 0) toasts.info(t('mindmap.sortDroppedSummaries', { count: result.droppedCount }));
  }

  function runNumbering(scope: NumberingScope, isNumbered: boolean): void {
    const mind = deps.getMind();
    const selected = selectedNodes();
    if (!mind || selected.length === 0 || !canEditTree()) return;
    const isChanged = commitTreeEdit(mind, selected[0], () => applyNumbers(numberingGroups(selected, scope), isNumbered, isGate));
    if (!isChanged) toasts.info(t('mindmap.numberingNothing'));
    reselect(mind, selected);
  }

  function requestNumbering(isNumbered: boolean): void {
    const count = selectedNodes().length;
    if (count === 0 || !canEditTree()) return;
    if (count === 1) {
      runNumbering('children', isNumbered);
      return;
    }
    pendingNumbering.value = { isNumbered, count };
  }

  function onNumberingChoice(scope: NumberingScope): void {
    const pending = pendingNumbering.value;
    pendingNumbering.value = null;
    if (pending) runNumbering(scope, pending.isNumbered);
  }

  return { pendingNumbering, canEditTree, selectedNodes, toggleCollapse, selectRoot, sortSelectedChildren, requestNumbering, onNumberingChoice, commitTreeEdit, reselect };
}
