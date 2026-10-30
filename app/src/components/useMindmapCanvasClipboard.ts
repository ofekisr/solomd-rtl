import { ref } from 'vue';
import type { MindElixirData, MindElixirInstance, NodeObj, Topic } from 'mind-elixir';
import { useSettingsStore } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import { isGate } from '../lib/mindmap-gates';
import { runAsOneOperationAsync, type OperationBus } from '../lib/mindmap-batch';
import { needsPasteDialog, pasteMode, resolveInsertTargetId, type PasteMapTarget } from '../lib/mindmap-insert';
import { parsePaste, type PastePayload } from '../lib/mindmap-paste';
import { buildIdMap, remapArrows, remapGates, remapSummaries } from '../lib/mindmap-paste-remap';
import { withoutGateArrows } from '../lib/mindmap-graph';
import { copyPlainText, readPlainText } from '../lib/code-copy';
import { copyMapText, subtreeData } from '../lib/mindmap-payload';
import { nodePathsText } from '../lib/mindmap-node-copy';

const COPY_NODES_OPERATION = 'copyNodes';
const MENU_GROUP_TOPIC = 'Selection';
const TOPIC_EDITOR_ID = 'input-box';
const PASTE_NOTICE_KEYS = { empty: null, tooLarge: 'mindmap.pasteTooLarge', unrecognized: 'mindmap.pasteUnrecognized' } as const;

export interface ClipboardDeps {
  getMind(): MindElixirInstance | null;
  isEditBlocked(): boolean;
  syncLabels(): void;
  selectedNodes(): NodeObj[];
}

export function liveData(instance: MindElixirInstance): MindElixirData {
  return withoutGateArrows(instance.getData());
}

async function graftInto(instance: MindElixirInstance, target: Topic, payload: PastePayload): Promise<NodeObj[]> {
  const countBefore = target.nodeObj.children?.length ?? 0;
  await instance.copyNodes(payload.nodes.map((nodeObj) => ({ nodeObj }) as Topic), target);
  const children = target.nodeObj.children ?? [];
  if (children.length !== countBefore + payload.nodes.length) return [];
  const inserted = children.slice(countBefore);
  const idMap = buildIdMap(payload.nodes, inserted);
  remapGates(inserted, idMap);
  for (const arrow of remapArrows(payload.arrows, idMap)) instance.createArrowFrom(arrow);
  for (const summary of remapSummaries(payload.summaries, idMap)) instance.createSummaryFrom(summary);
  return inserted;
}

export function useMindmapCanvasClipboard(deps: ClipboardDeps) {
  const settings = useSettingsStore();
  const toasts = useToastsStore();
  const { t } = useI18n();
  const pendingPaste = ref<PastePayload | null>(null);

  function selectedNonRootIds(): string[] {
    const mind = deps.getMind();
    if (!mind) return [];
    return (mind.currentNodes ?? []).map((tpc) => tpc.nodeObj.id).filter((id) => id !== mind.nodeData.id);
  }

  function insertTarget(mode: PasteMapTarget): Topic | null {
    const mind = deps.getMind();
    if (!mind || deps.isEditBlocked()) return null;
    const id = resolveInsertTargetId(mind.currentNode?.nodeObj.id ?? null, mind.nodeData.id, mode);
    const target = mind.findEle(id);
    if (isGate(target.nodeObj)) {
      toasts.info(t('mindmap.gateCannotHoldChildren'));
      return null;
    }
    return target;
  }

  async function insertPayloadAt(payload: PastePayload, mode: PasteMapTarget): Promise<boolean> {
    const target = insertTarget(mode);
    const instance = deps.getMind();
    if (!instance || !target) return false;
    const event: Record<string, unknown> = { name: COPY_NODES_OPERATION };
    let inserted: NodeObj[] = [];
    await runAsOneOperationAsync(instance.bus as unknown as OperationBus, async () => {
      inserted = await graftInto(instance, target, payload);
      event.obj = inserted[0];
      event.objs = inserted;
      return inserted.length > 0;
    }, event);
    if (inserted.length > 0) deps.syncLabels();
    return inserted.length > 0;
  }

  function insertReportingErrors(payload: PastePayload, mode: PasteMapTarget): void {
    void insertPayloadAt(payload, mode).catch((e: unknown) => toasts.error(String(e)));
  }

  function routePaste(payload: PastePayload): void {
    const setting = settings.mindmapPasteMapTarget;
    const hasSelection = selectedNonRootIds().length > 0;
    if (needsPasteDialog(payload.format, hasSelection, setting)) {
      pendingPaste.value = payload;
      return;
    }
    insertReportingErrors(payload, pasteMode(payload.format, setting));
  }

  function onPasteTargetChosen(target: PasteMapTarget, remember: boolean): void {
    const payload = pendingPaste.value;
    pendingPaste.value = null;
    if (remember) settings.setMindmapPasteMapTarget(target);
    if (payload) insertReportingErrors(payload, target);
  }

  function routeParsed(result: ReturnType<typeof parsePaste>): void {
    if (!result.ok) {
      const key = PASTE_NOTICE_KEYS[result.reason];
      if (key) toasts.info(t(key));
      return;
    }
    routePaste(result.payload);
  }

  function onPaste(e: ClipboardEvent): void {
    if (e.target instanceof HTMLElement && e.target.id === TOPIC_EDITOR_ID) return;
    if (!deps.getMind() || deps.isEditBlocked()) return;
    const result = parsePaste(e.clipboardData?.getData('text/plain') ?? '');
    e.preventDefault();
    routeParsed(result);
  }

  async function copyMap(): Promise<void> {
    const mind = deps.getMind();
    if (!mind) return;
    const ids = selectedNonRootIds();
    const data = ids.length === 0 ? liveData(mind) : subtreeData(liveData(mind), ids, MENU_GROUP_TOPIC);
    if (!data) return;
    await copyPlainText(copyMapText(data));
    toasts.success(t('mindmap.mapCopied'));
  }

  async function pasteMapFromClipboard(): Promise<void> {
    if (!deps.getMind() || deps.isEditBlocked()) {
      toasts.info(t('mindmap.pasteBlocked'));
      return;
    }
    routeParsed(parsePaste(await readPlainText()));
  }

  async function copyNodePath(): Promise<void> {
    const nodes = deps.selectedNodes();
    if (nodes.length === 0) {
      toasts.info(t('mindmap.selectNodeFirst'));
      return;
    }
    await copyPlainText(nodePathsText(nodes));
    toasts.success(t('mindmap.pathCopied'));
  }

  return { pendingPaste, selectedNonRootIds, onPaste, onPasteTargetChosen, copyMap, pasteMapFromClipboard, copyNodePath };
}
