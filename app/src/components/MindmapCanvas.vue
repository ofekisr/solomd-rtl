<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MindElixir from 'mind-elixir';
import type { MindElixirData, MindElixirInstance, NodeObj, Topic } from 'mind-elixir';
import 'mind-elixir/style.css';
import type { MindmapCodec } from '../lib/mindmap-format';
import type { MapDisplay } from '../lib/mindmap-display';
import type { Snippet } from '../lib/mindmap-snippets';
import { sanitizeNodeObj } from '../lib/mindmap-format';
import { useSettingsStore } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { fenceNodeSource, readNodeSource, type MindmapSource } from '../lib/mindmap-source';
import { useI18n } from '../i18n';
import { resolveBindings, shortcutLabel } from '../lib/keybindings';
import { isMacOS } from '../lib/platform';
import { createMapKeyDispatch } from '../lib/mindmap-key-dispatch';
import { layoutDirectionFor, MINDMAP_LAYOUT } from '../lib/mindmap-direction';
import { themeFamily } from '../lib/themes';
import { decorateFoldedCounts } from '../lib/mindmap-folded-count';
import { clearActiveMindmap, setActiveMindmap, type MindmapHandle } from '../lib/mindmap-active';
import { createGateController, type GateMenuAction, type GateNotice } from '../lib/mindmap-gate-controller';
import { useMindmapCanvasActions } from '../composables/useMindmapCanvasActions';
import { createChordPan } from '../composables/useMindmapChordPan';
import { hasOpenBranch, planSelectionToggle, setDescendantsExpanded } from '../lib/mindmap-collapse';
import { frameDelta, insetRect, parseTranslate } from '../lib/mindmap-frame';
import { EMPTY_FRAME_STYLE, readFrameVars, type StripFrameStyle } from '../lib/mindmap-frame-style';
import MindmapDock from './MindmapDock.vue';
import MindmapDockButton from './MindmapDockButton.vue';
import MindmapShortcutHelp from './MindmapShortcutHelp.vue';
import MindmapPasteTargetDialog from './MindmapPasteTargetDialog.vue';
import MindmapDuplicates from './MindmapDuplicates.vue';
import MindmapNumberingDialog from './MindmapNumberingDialog.vue';
import { applyNumbers, numberingGroups, type NumberingScope } from '../lib/mindmap-numbering';
import { findDuplicateGroups, mergeIntoGate, type DuplicateGroup } from '../lib/mindmap-duplicates';
import { findNode, isGate } from '../lib/mindmap-gates';
import { runAsOneOperation, runAsOneOperationAsync, type OperationBus } from '../lib/mindmap-batch';
import { remapSummaries as remapChildSummaries, sortChildrenByTopic, type SortOrder } from '../lib/mindmap-sort';
import { needsPasteDialog, pasteMode, resolveInsertTargetId, type PasteMapTarget } from '../lib/mindmap-insert';
import { parsePaste, type PastePayload } from '../lib/mindmap-paste';
import { buildIdMap, remapArrows, remapGates, remapSummaries } from '../lib/mindmap-paste-remap';
import { withGateArrows, withoutGateArrows } from '../lib/mindmap-graph';
import { copyPlainText, readPlainText } from '../lib/code-copy';
import { copyMapText, subtreeData } from '../lib/mindmap-payload';
import { entryKey, TAB_SOURCE_PREFIX, type EntryDraft } from '../lib/mindmap-workbench';
import { useMindmapWorkbenchStore } from '../stores/mindmapWorkbench';
import { fileDraft, nodesDraft, openWorkbench } from '../composables/useMindmapWorkbench';
import { closingMenuItems, hideContextMenu } from '../lib/mindmap-context-menu';
import { buildFreezeStrip, canAnchor, getTabFocus, getTabStripRoot, pathTo, setTabFocus, setTabStripRoot, type FreezeStrip } from '../lib/mindmap-focus';
import MindmapFreezeStrip from './MindmapFreezeStrip.vue';

const SYNC_DEBOUNCE_MS = 300;
const TOPIC_EDITOR_ID = 'input-box';
const OPERATION_EVENT = 'operation';
const EXPAND_EVENT = 'expandNode';
const SELECT_EVENT = 'selectNodes';
const UNSELECT_EVENT = 'unselectNodes';
const BEGIN_EDIT_OPERATION = 'beginEdit';
const PASTE_NOTICE_KEYS = { empty: null, tooLarge: 'mindmap.pasteTooLarge', unrecognized: 'mindmap.pasteUnrecognized' } as const;
const MENU_GROUP_TOPIC = 'Selection';
const TOGGLE_NODE_ACTION = 'mindmap.toggleNode';
const LINK_DIV_EVENT = 'linkDiv';
const CHANGE_DIRECTION_EVENT = 'changeDirection';
const FULLSCREEN_CHANGE_EVENT = 'fullscreenchange';
const INTERACTIVE_SELECTOR = 'button, input, select, textarea, a[href], [contenteditable="true"], [role="button"], [role="menuitem"]';

const props = withDefaults(
  defineProps<{ content: string; codec: MindmapCodec; exportName?: string; fenceLine?: number; registerActive?: boolean; locked?: boolean; focusKey?: string; sourcePath?: string; sourceLabel?: string }>(),
  { exportName: 'mindmap', registerActive: true, locked: false },
);
const emit = defineEmits<{
  'update:content': [text: string];
  'open-as-text': [];
  'jump-to-source': [source: MindmapSource];
  selection: [nodes: NodeObj[]];
  ready: [];
  'show-details': [];
}>();
const settings = useSettingsStore();
const toasts = useToastsStore();
const workbench = useMindmapWorkbenchStore();
const { t } = useI18n();

const host = ref<HTMLElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const direction = ref<number>(MINDMAP_LAYOUT.SIDE);
const parseError = ref<string | null>(null);
const isHelpOpen = ref(false);
const isReadOnly = ref(false);
const isGraphView = ref(false);
const focusId = ref<string | null>(props.focusKey ? getTabFocus(props.focusKey) : null);
const stripRootId = ref<string | null>(props.focusKey ? getTabStripRoot(props.focusKey) : null);
const strip = ref<FreezeStrip | null>(null);
const frameStyle = ref<StripFrameStyle>(EMPTY_FRAME_STYLE);
let isApplyingFocus = false;
let graphBaseline: MindElixirData | null = null;
let mind: MindElixirInstance | null = null;
let displayOverride: MapDisplay = {};
let snippetsOverride: Snippet[] = [];
let lastSynced = props.content;
let syncTimer: number | null = null;
let pristineSerialized: string | null = null;
let loaded: { content: string; serialized: string } | null = null;
let centerObserver: ResizeObserver | null = null;

function themeFor(): typeof MindElixir.THEME {
  return themeFamily(settings.theme) === 'dark' ? MindElixir.DARK_THEME : MindElixir.THEME;
}

function loadData(): MindElixirData | null {
  const parsed = props.codec.parse(props.content);
  if (!parsed.ok) {
    parseError.value = parsed.error;
    return null;
  }
  parseError.value = null;
  displayOverride = parsed.display;
  snippetsOverride = parsed.snippets;
  return parsed.data;
}

function canEdit(): boolean {
  return !isEditBlocked();
}

function isEditBlocked(): boolean {
  return isReadOnly.value || props.locked;
}

function clearPendingSync(): void {
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = null;
}

function syncNow(): void {
  clearPendingSync();
  if (!mind || props.locked || isGraphView.value || parseError.value !== null) return;
  const serialized = props.codec.serialize(mind.getData(), displayOverride, snippetsOverride);
  if (serialized === pristineSerialized && props.content === '') return;
  const next = serialized === loaded?.serialized ? loaded.content : serialized;
  if (next === props.content) return;
  lastSynced = next;
  emit('update:content', lastSynced);
}

function stopCentering(): void {
  centerObserver?.disconnect();
  centerObserver = null;
}

function centerOnceLaidOut(): void {
  stopCentering();
  if (!host.value) return;
  centerObserver = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;
    if (!box || box.width === 0 || box.height === 0) return;
    stopCentering();
    mind?.toCenter();
  });
  centerObserver.observe(host.value);
}

const DUPLICATE_COUNT_DEBOUNCE_MS = 500;
const duplicateCount = ref(0);
let duplicateTimer: number | null = null;

function countDuplicates(): void {
  duplicateTimer = null;
  duplicateCount.value = mind ? findDuplicateGroups(fullRoot(mind)).length : 0;
}

function scheduleDuplicateCount(): void {
  if (duplicateTimer !== null) window.clearTimeout(duplicateTimer);
  duplicateTimer = window.setTimeout(countDuplicates, DUPLICATE_COUNT_DEBOUNCE_MS);
}

/** Load-time fixes (refreshed gate labels) are not edits: until the map really changes, keep the file's own text. */
function rememberLoaded(): void {
  loaded = mind ? { content: props.content, serialized: props.codec.serialize(mind.getData(), displayOverride, snippetsOverride) } : null;
}

function scheduleSync(): void {
  if (isReadOnly.value) return;
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(syncNow, SYNC_DEBOUNCE_MS);
}

function mount(): void {
  const data = loadData();
  if (!host.value || !data) return;
  mind = new MindElixir({
    el: host.value,
    direction: layoutDirectionFor(data),
    editable: canEdit(),
    contextMenu: { extend: closingMenuItems([...gates.menu, { name: t('mindmap.jumpToSourceMenu'), onclick: jumpToSource }, { name: t('mindmap.pinStripRoot'), onclick: pinCurrentAsStripRoot }, { name: t('mindmap.detailsShow'), onclick: () => emit('show-details') }, { name: t('mindmap.sortChildrenMenu'), onclick: sortSelectedChildren }, { name: t('mindmap.numberMenu'), onclick: () => requestNumbering(true) }, { name: t('mindmap.removeNumbersMenu'), onclick: () => requestNumbering(false) }, ...workbenchMenuItems()], () => hideContextMenu(host.value)) },
    before: gates.guards,
    toolBar: false,
    keypress: true,
    allowUndo: true,
    theme: themeFor(),
    pasteHandler: onPaste,
  });
  wrapToCenter(mind);
  if (props.fenceLine === undefined) setDescendantsExpanded(data.nodeData, false);
  mind.init(data);
  direction.value = mind.direction;
  chordPan.attach(host.value);
  stage.value?.addEventListener(FULLSCREEN_CHANGE_EVENT, onFullscreenChange);
  gates.syncLabels();
  rememberLoaded();
  countDuplicates();
  pristineSerialized = props.content === '' ? props.codec.serialize(mind.getData(), displayOverride, snippetsOverride) : null;
  centerOnceLaidOut();
  mind.bus.addListener(OPERATION_EVENT, onOperation);
  mind.bus.addListener(EXPAND_EVENT, scheduleSync);
  mind.bus.addListener(SELECT_EVENT, emitSelection);
  mind.bus.addListener(UNSELECT_EVENT, emitSelection);
  mind.bus.addListener(CHANGE_DIRECTION_EVENT, onDirectionChange);
  mind.bus.addListener(LINK_DIV_EVENT, () => { if (mind) decorateFoldedCounts(mind.nodes); });
  syncAfterHistoryJumps(mind);
  sanitizeCopiedNodes(mind);
  guardRemovedNodes(mind);
  wrapFocus(mind);
  reapplyFocus();
  refreshFrameStyle();
  activate();
  emit('ready');
}

function frameMap(instance: MindElixirInstance): void {
  const container = instance.container.getBoundingClientRect();
  if (container.width === 0 || container.height === 0) return;
  const padding = getComputedStyle(instance.nodes);
  const content = insetRect(instance.nodes.getBoundingClientRect(), parseFloat(padding.paddingLeft) || 0, parseFloat(padding.paddingTop) || 0);
  const root = instance.map.querySelector('me-root')?.getBoundingClientRect() ?? content;
  const { dx, dy } = frameDelta({ container, content, root, layout: instance.direction });
  const { x, y } = parseTranslate(instance.map.style.transform);
  instance.map.style.transform = `translate3d(${x + dx}px, ${y + dy}px, 0) scale(${instance.scaleVal})`;
}

function wrapToCenter(instance: MindElixirInstance): void {
  const { toCenter } = instance;
  instance.toCenter = () => {
    toCenter.call(instance);
    frameMap(instance);
  };
}

function onDirectionChange(next: number): void {
  direction.value = next;
  if (!mind?.isFocusMode) scheduleSync();
}

function zoomBy(step: number): void {
  if (mind) mind.scale(mind.scaleVal + step * mind.scaleSensitivity);
}

function toggleFullscreen(): void {
  if (document.fullscreenElement === stage.value) void document.exitFullscreen();
  else void stage.value?.requestFullscreen();
}

function recenter(): void {
  mind?.toCenter();
}

function onFullscreenChange(): void {
  requestAnimationFrame(() => mind?.toCenter());
}

const chordPan = createChordPan({ getMind: () => mind });

function emitSelection(): void {
  emit('selection', mind?.currentNodes?.map((tpc) => tpc.nodeObj) ?? []);
}

function onOperation(info: { name: string }): void {
  if (info.name === BEGIN_EDIT_OPERATION) return;
  gates.syncLabels();
  scheduleSync();
  scheduleDuplicateCount();
  const root = mind ? fullRoot(mind) : null;
  if (focusId.value !== null && root && !pathTo(root, focusId.value)) focusById(null);
  else refreshStrip(root);
  emitSelection();
}

function syncAfterHistoryJumps(instance: MindElixirInstance): void {
  const { undo, redo } = instance;
  instance.undo = () => {
    if (props.locked) return;
    leaveFocusQuietly();
    undo.call(instance);
    reapplyFocus();
    gates.syncLabels();
    scheduleSync();
    scheduleDuplicateCount();
    emitSelection();
    refreshStrip();
  };
  instance.redo = () => {
    if (props.locked) return;
    leaveFocusQuietly();
    redo.call(instance);
    reapplyFocus();
    gates.syncLabels();
    scheduleSync();
    scheduleDuplicateCount();
    emitSelection();
    refreshStrip();
  };
}

function fullRoot(instance: MindElixirInstance): NodeObj {
  return instance.getData().nodeData;
}

function rememberFocus(id: string | null): void {
  focusId.value = id;
  if (props.focusKey) setTabFocus(props.focusKey, id);
}

function refreshFrameStyle(): void {
  if (!mind) return;
  const computed = getComputedStyle(mind.container);
  frameStyle.value = { vars: readFrameVars((name) => computed.getPropertyValue(name)), palette: [...mind.theme.palette] };
}

function rememberStripRoot(id: string | null): void {
  stripRootId.value = id;
  if (props.focusKey) setTabStripRoot(props.focusKey, id);
}

function setStripRoot(id: string | null): void {
  if (!mind) return;
  const root = fullRoot(mind);
  if (id !== null && !canAnchor(root, id)) return;
  rememberStripRoot(id === root.id ? null : id);
  refreshStrip(root);
}

function pinCurrentAsStripRoot(): void {
  const id = mind?.currentNode?.nodeObj.id;
  if (id) setStripRoot(id);
}

function refreshStrip(knownRoot?: NodeObj | null): void {
  if (!mind || !props.focusKey) {
    strip.value = null;
    return;
  }
  const root = knownRoot ?? fullRoot(mind);
  if (stripRootId.value !== null && !canAnchor(root, stripRootId.value)) rememberStripRoot(null);
  strip.value = buildFreezeStrip(root, focusId.value, stripRootId.value);
}

function wrapFocus(instance: MindElixirInstance): void {
  const { focusNode, cancelFocus } = instance;
  instance.focusNode = (tpc) => {
    if (isGraphView.value) return;
    const isRoot = !tpc.nodeObj.parent;
    focusNode.call(instance, tpc);
    if (!isApplyingFocus && !isRoot) rememberFocus(tpc.nodeObj.id);
    refreshStrip();
  };
  instance.cancelFocus = () => {
    cancelFocus.call(instance);
    if (!isApplyingFocus) rememberFocus(null);
    refreshStrip();
  };
}

function findLiveTopic(instance: MindElixirInstance, id: string): Topic | null {
  try {
    return instance.findEle(id) ?? null;
  } catch {
    return null;
  }
}

function focusById(id: string | null): void {
  if (!mind) return;
  if (mind.isFocusMode) mind.cancelFocus();
  if (id === null || id === mind.nodeData.id) {
    rememberFocus(null);
    refreshStrip();
    return;
  }
  const el = findLiveTopic(mind, id);
  if (el) mind.focusNode(el);
}

function reapplyFocus(): void {
  if (!mind || isGraphView.value) return;
  const id = focusId.value;
  if (id === null || !pathTo(fullRoot(mind), id)) {
    rememberFocus(null);
    refreshStrip();
    return;
  }
  isApplyingFocus = true;
  const el = findLiveTopic(mind, id);
  if (el) mind.focusNode(el);
  else rememberFocus(null);
  isApplyingFocus = false;
  refreshStrip();
}

function leaveFocusQuietly(): void {
  if (!mind?.isFocusMode) return;
  isApplyingFocus = true;
  mind.cancelFocus();
  isApplyingFocus = false;
}

function sanitizedTopic(tpc: Topic): Topic | null {
  const nodeObj: NodeObj | null = sanitizeNodeObj(tpc.nodeObj);
  return nodeObj ? ({ nodeObj } as Topic) : null;
}

function sanitizeCopiedNodes(instance: MindElixirInstance): void {
  const { copyNodes } = instance;
  instance.copyNodes = (tpcs, to) => {
    if (isEditBlocked() || isGraphView.value) return Promise.resolve();
    const safe = tpcs.map(sanitizedTopic).filter((tpc): tpc is Topic => tpc !== null);
    return copyNodes.call(instance, safe, to);
  };
}

function guardRemovedNodes(instance: MindElixirInstance): void {
  const { removeNodes } = instance;
  instance.removeNodes = (tpcs) => {
    if (isEditBlocked() || isGraphView.value) return Promise.resolve();
    return removeNodes.call(instance, tpcs);
  };
}

function flushPendingSync(): void {
  if (syncTimer !== null) syncNow();
}

function teardown(): void {
  clearActiveMindmap(handle);
  chordPan.detach();
  stage.value?.removeEventListener(FULLSCREEN_CHANGE_EVENT, onFullscreenChange);
  stopCentering();
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = null;
  if (duplicateTimer !== null) window.clearTimeout(duplicateTimer);
  duplicateTimer = null;
  resetGraphView();
  duplicateCount.value = 0;
  strip.value = null;
  mind?.destroy();
  mind = null;
}

async function applyExternalContent(): Promise<void> {
  const data = loadData();
  if (!data) {
    teardown();
    return;
  }
  if (mind) {
    const wasGraphView = isGraphView.value;
    resetGraphView();
    leaveFocusQuietly();
    mind.refresh(data);
    if (wasGraphView && canEdit()) mind.enableEdit();
    gates.syncLabels();
    rememberLoaded();
    reapplyFocus();
    countDuplicates();
    mind.clearHistory?.();
    emit('ready');
    return;
  }
  await nextTick();
  if (mind) return;
  mount();
}

function resetGraphView(): void {
  isGraphView.value = false;
  graphBaseline = null;
}

function enterGraphView(instance: MindElixirInstance): void {
  leaveFocusQuietly();
  flushPendingSync();
  graphBaseline = instance.getData();
  instance.disableEdit();
  instance.refresh(withGateArrows(graphBaseline));
  isGraphView.value = true;
}

function leaveGraphView(instance: MindElixirInstance): void {
  leaveFocusQuietly();
  if (graphBaseline) instance.refresh(graphBaseline);
  resetGraphView();
  gates.syncLabels();
  if (canEdit()) instance.enableEdit();
  reapplyFocus();
}

function toggleGraphView(): void {
  if (!mind) return;
  if (isGraphView.value) leaveGraphView(mind);
  else enterGraphView(mind);
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

function toggleWholeMap(instance: MindElixirInstance): void {
  setDescendantsExpanded(instance.nodeData, !hasOpenBranch(instance.nodeData));
  instance.refresh();
  instance.toCenter();
  scheduleSync();
}

function toggleCollapse(): void {
  if (mind && !toggleSelectedNodes(mind)) toggleWholeMap(mind);
}

function selectRoot(): void {
  if (!mind) return;
  mind.selectNode(mind.findEle(mind.nodeData.id));
  mind.toCenter();
}

function currentSource(): MindmapSource | null {
  const node = mind?.currentNode?.nodeObj;
  if (!mind || !node) return null;
  const stored = readNodeSource(node);
  if (stored) return stored;
  return props.fenceLine === undefined ? null : fenceNodeSource(mind.getData(), node.id, props.fenceLine);
}

function jumpToSource(): void {
  const source = currentSource();
  if (!source) {
    toasts.info(t('mindmap.noSource'));
    return;
  }
  flushPendingSync();
  emit('jump-to-source', source);
}

const canvasActions = useMindmapCanvasActions({ getMind: () => mind, exportName: () => props.exportName, isReadOnly, isGraphView, isLocked: () => props.locked, getSnippets: () => snippetsOverride, sourceFilePath: () => (props.sourcePath && !props.sourcePath.startsWith(TAB_SOURCE_PREFIX) ? props.sourcePath : null) });

const GATE_MENU_LABEL_KEYS: Record<GateMenuAction, string> = {
  'mindmap.markGateTarget': 'mindmap.gateMarkTarget',
  'mindmap.insertGate': 'mindmap.gateInsert',
  'mindmap.followGate': 'mindmap.gateFollow',
  'mindmap.gateBack': 'mindmap.gateBackMenu',
  'mindmap.repairGate': 'mindmap.gateRepair',
  'mindmap.removeGate': 'mindmap.gateRemove',
};

function gateMenuLabels(): Record<GateMenuAction, string> {
  const labels: Record<GateMenuAction, string> = { ...GATE_MENU_LABEL_KEYS };
  for (const id of Object.keys(GATE_MENU_LABEL_KEYS) as GateMenuAction[]) labels[id] = t(GATE_MENU_LABEL_KEYS[id]);
  return labels;
}

function gateMenuKeys(): Partial<Record<GateMenuAction, string>> {
  const ids = Object.keys(GATE_MENU_LABEL_KEYS) as GateMenuAction[];
  return Object.fromEntries(ids.map((id) => [id, shortcutLabel(id, settings.keybindings, isMacOS())]));
}

const gates = createGateController({
  getMind: () => mind,
  isReadOnly: () => isEditBlocked() || isGraphView.value,
  brokenLabel: () => t('mindmap.gateBroken'),
  notify: (key: GateNotice) => toasts.info(t(`mindmap.${key}`)),
  onChange: scheduleSync,
}, gateMenuLabels(), gateMenuKeys());

const duplicateGroups = ref<DuplicateGroup[] | null>(null);

function findDuplicates(): void {
  if (mind) duplicateGroups.value = findDuplicateGroups(fullRoot(mind));
}

function topicOf(id: string): string {
  return (mind && findNode(fullRoot(mind), id)?.topic) ?? '';
}

function mergeDuplicate(keepId: string, dupId: string): void {
  if (!mind || isEditBlocked() || isGraphView.value) return;
  const merged = mergeIntoGate(mind.getData(), keepId, dupId);
  if (!merged) return;
  leaveFocusQuietly();
  mind.refresh(merged);
  mind.clearHistory?.();
  gates.syncLabels();
  reapplyFocus();
  scheduleSync();
  findDuplicates();
  countDuplicates();
}

const SORT_TOAST_KEYS: Readonly<Record<SortOrder, string>> = { asc: 'mindmap.sortedAsc', desc: 'mindmap.sortedDesc' };

const TREE_EDIT_OPERATION = 'moveNodeBefore';

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

function canEditTree(): boolean {
  return !!mind && !isEditBlocked() && !isGraphView.value;
}

function remapSortedSummaries(instance: MindElixirInstance, target: NodeObj, before: readonly NodeObj[]): number {
  const { kept, droppedCount } = remapChildSummaries(instance.summaries, target.id, before, target.children ?? []);
  instance.summaries = kept;
  return droppedCount;
}

function sortSelectedChildren(): void {
  const target = mind?.currentNode?.nodeObj;
  const instance = mind;
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

const pendingNumbering = ref<{ isNumbered: boolean; count: number } | null>(null);

function selectedNodes(): NodeObj[] {
  return (mind?.currentNodes ?? []).map((tpc) => tpc.nodeObj);
}

function reselect(instance: MindElixirInstance, nodes: readonly NodeObj[]): void {
  if (nodes.length > 1) instance.selectNodes(nodes.map((n) => instance.findEle(n.id)));
}

function runNumbering(scope: NumberingScope, isNumbered: boolean): void {
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

const actions: Record<string, () => void> = {
  'mindmap.sortChildren': sortSelectedChildren,
  'mindmap.numberChildren': () => requestNumbering(true),
  'mindmap.removeNumbers': () => requestNumbering(false),
  [TOGGLE_NODE_ACTION]: toggleCollapse,
  'mindmap.fit': () => mind?.scaleFit(),
  'mindmap.focusRoot': selectRoot,
  'mindmap.shortcutHelp': () => { isHelpOpen.value = !isHelpOpen.value; },
  'mindmap.jumpToSource': jumpToSource,
  'mindmap.findDuplicates': findDuplicates,
  'mindmap.toggleGraphView': toggleGraphView,
  'mindmap.focusNode': () => { if (mind?.currentNode) mind.focusNode(mind.currentNode); },
  'mindmap.cancelFocus': () => focusById(null),
  'mindmap.undo': () => mind?.undo(),
  'mindmap.layoutLeft': () => mind?.initLeft(),
  'mindmap.layoutRight': () => mind?.initRight(),
  'mindmap.layoutSide': () => mind?.initSide(),
  'mindmap.layoutDown': () => mind?.initDown(),
  'mindmap.redo': () => mind?.redo(),
  ...canvasActions,
  ...gates.actions,
};

const handle: MindmapHandle = {
  run: (actionId) => {
    const run = actions[actionId];
    if (!run) return false;
    run();
    return true;
  },
};

function activate(): void {
  if (props.registerActive) setActiveMindmap(handle);
}

const COPY_NODES_OPERATION = 'copyNodes';

function insertTarget(mode: PasteMapTarget): Topic | null {
  if (!mind || isEditBlocked() || isGraphView.value) return null;
  const id = resolveInsertTargetId(mind.currentNode?.nodeObj.id ?? null, mind.nodeData.id, mode);
  const target = mind.findEle(id);
  if (isGate(target.nodeObj)) {
    toasts.info(t('mindmap.gateCannotHoldChildren'));
    return null;
  }
  return target;
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

function selectedNonRootIds(): string[] {
  if (!mind) return [];
  return (mind.currentNodes ?? []).map((tpc) => tpc.nodeObj.id).filter((id) => id !== mind!.nodeData.id);
}

function liveData(instance: MindElixirInstance): MindElixirData {
  return withoutGateArrows(instance.getData());
}

function menuDraft(): EntryDraft | null {
  if (!mind || !props.sourcePath) return null;
  const ids = selectedNonRootIds();
  if (ids.length === 0) return props.sourcePath.startsWith(TAB_SOURCE_PREFIX) ? null : fileDraft(props.sourcePath);
  return nodesDraft(props.sourcePath, liveData(mind), ids, props.sourceLabel ?? props.exportName);
}

function toggleWorkbench(): void {
  const draft = menuDraft();
  if (!draft) {
    toasts.info(t('mindmap.workbenchSaveFirst'));
    return;
  }
  const key = entryKey(draft);
  if (workbench.has(key)) {
    workbench.removeKey(key);
    toasts.success(t('mindmap.workbenchRemoved'));
    return;
  }
  const outcome = workbench.add(draft);
  toasts.success(t(outcome === 'updated' ? 'mindmap.workbenchUpdated' : 'mindmap.workbenchAdded'));
}

function openWorkbenchFromMenu(): void {
  const draft = menuDraft();
  openWorkbench(draft && !workbench.has(entryKey(draft)) ? draft : undefined);
}

async function copyMap(): Promise<void> {
  if (!mind) return;
  const ids = selectedNonRootIds();
  const data = ids.length === 0 ? liveData(mind) : subtreeData(liveData(mind), ids, MENU_GROUP_TOPIC);
  if (!data) return;
  await copyPlainText(copyMapText(data));
  toasts.success(t('mindmap.mapCopied'));
}

async function pasteMapFromClipboard(): Promise<void> {
  if (!mind || isEditBlocked() || isGraphView.value) {
    toasts.info(t('mindmap.pasteBlocked'));
    return;
  }
  const result = parsePaste(await readPlainText());
  if (!result.ok) {
    const key = PASTE_NOTICE_KEYS[result.reason];
    if (key) toasts.info(t(key));
    return;
  }
  routePaste(result.payload);
}

function workbenchMenuItems(): { name: string; onclick: () => void }[] {
  return [
    { name: t('mindmap.menuAddToWorkbench'), onclick: toggleWorkbench },
    { name: t('mindmap.menuOpenWorkbench'), onclick: openWorkbenchFromMenu },
    { name: t('mindmap.menuCopyMap'), onclick: () => { void copyMap().catch((e: unknown) => toasts.error(String(e))); } },
    { name: t('mindmap.menuPasteMap'), onclick: () => { void pasteMapFromClipboard().catch((e: unknown) => toasts.error(String(e))); } },
  ];
}

async function insertPayloadAt(payload: PastePayload, mode: PasteMapTarget): Promise<boolean> {
  const target = insertTarget(mode);
  if (!mind || !target) return false;
  const instance = mind;
  const event: Record<string, unknown> = { name: COPY_NODES_OPERATION };
  let inserted: NodeObj[] = [];
  await runAsOneOperationAsync(instance.bus as unknown as OperationBus, async () => {
    inserted = await graftInto(instance, target, payload);
    event.obj = inserted[0];
    event.objs = inserted;
    return inserted.length > 0;
  }, event);
  if (inserted.length > 0) gates.syncLabels();
  return inserted.length > 0;
}

const pendingPaste = ref<PastePayload | null>(null);

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

function onPaste(e: ClipboardEvent): void {
  if (e.target instanceof HTMLElement && e.target.id === TOPIC_EDITOR_ID) return;
  if (!mind || isEditBlocked() || isGraphView.value) return;
  const result = parsePaste(e.clipboardData?.getData('text/plain') ?? '');
  e.preventDefault();
  if (!result.ok) {
    const key = PASTE_NOTICE_KEYS[result.reason];
    if (key) toasts.info(t(key));
    return;
  }
  routePaste(result.payload);
}

function isEditingTopic(e: KeyboardEvent): boolean {
  return e.target instanceof HTMLElement && e.target.id === TOPIC_EDITOR_ID;
}

function isOnMapControl(e: KeyboardEvent): boolean {
  const target = e.target;
  if (!(target instanceof HTMLElement) || target === mind?.container) return false;
  return target.closest(INTERACTIVE_SELECTOR) !== null;
}

function canRunOn(actionId: string, e: KeyboardEvent): boolean {
  return actionId !== TOGGLE_NODE_ACTION || e.target === mind?.container;
}

function isIgnoredKey(e: KeyboardEvent): boolean {
  return isEditingTopic(e) || isOnMapControl(e);
}

const keyDispatch = createMapKeyDispatch({
  isIgnored: isIgnoredKey,
  getBindings: () => resolveBindings(settings.keybindings, 'mindmap'),
  canRunOn,
  getAction: (actionId) => actions[actionId],
  onChordFollowUp: scheduleSync,
});

watch(() => props.content, (content) => {
  if (content === lastSynced) return;
  lastSynced = content;
  void applyExternalContent();
});

watch(() => props.locked, (isLocked) => {
  if (!mind || isGraphView.value) return;
  if (isLocked) {
    clearPendingSync();
    mind.disableEdit();
    return;
  }
  if (canEdit()) mind.enableEdit();
});

watch(() => settings.theme, () => {
  if (!mind) return;
  mind.changeTheme(themeFor());
  refreshFrameStyle();
  emit('ready');
});

onMounted(() => {
  mount();
  window.addEventListener('solomd:flush-content-sync', flushPendingSync);
});

onBeforeUnmount(() => {
  window.removeEventListener('solomd:flush-content-sync', flushPendingSync);
  flushPendingSync();
  teardown();
});

function setDisplayOverride(next: MapDisplay): void {
  displayOverride = next;
  scheduleSync();
}

function setSnippets(next: readonly Snippet[]): void {
  if (!mind || isEditBlocked() || isGraphView.value) return;
  snippetsOverride = [...next];
  scheduleSync();
}

defineExpose({
  flush: flushPendingSync,
  markChanged: scheduleSync,
  run: (actionId: string) => handle.run(actionId),
  getMind: () => mind,
  getDisplayOverride: () => displayOverride,
  setDisplayOverride,
  getSnippets: () => snippetsOverride,
  setSnippets,
  isReadOnly,
  isGraphView,
  direction,
  refreshFrameStyle,
  isFocused: computed(() => focusId.value !== null),
  hasMap: computed(() => parseError.value === null),
});
</script>

<template>
  <div class="mindmap-view" @keydown.capture="keyDispatch.onCapture" @keydown="keyDispatch.onBubble" @focusin="activate" @pointerdown="activate">
    <div v-if="parseError" class="mindmap-view__error" role="alert">
      <p>{{ t('mindmap.parseError') }}</p>
      <pre>{{ parseError }}</pre>
      <button type="button" @click="emit('open-as-text')">{{ t('mindmap.openAsText') }}</button>
    </div>
    <template v-else>
      <MindmapFreezeStrip v-if="strip && !isGraphView" :strip="strip" :focus-id="focusId" :frame-style="frameStyle" @focus="focusById" @anchor="setStripRoot" />
      <div ref="stage" class="mindmap-view__stage">
        <div ref="host" class="mindmap-view__canvas" />
        <slot name="rail" />
        <MindmapDock corner="bottom-end" orientation="row" :label="t('mindmap.dockNavigate')">
          <MindmapDockButton icon="fullscreen" :label="t('mindmap.canvasFullscreen')" @click="toggleFullscreen" />
          <MindmapDockButton icon="center" :label="t('mindmap.canvasCenter')" @click="recenter" />
          <MindmapDockButton icon="zoom-out" :label="t('mindmap.canvasZoomOut')" @click="zoomBy(-1)" />
          <MindmapDockButton icon="zoom-in" :label="t('mindmap.canvasZoomIn')" @click="zoomBy(1)" />
          <MindmapDockButton icon="fit" :label="t('mindmap.canvasFit')" @click="actions['mindmap.fit']" />
          <MindmapDockButton icon="root" :label="t('mindmap.canvasRoot')" @click="selectRoot" />
          <MindmapDockButton icon="collapse" :label="t('mindmap.canvasCollapse')" @click="toggleCollapse" />
        </MindmapDock>
      </div>
    </template>
    <div class="mindmap-view__status">
      <button v-if="duplicateCount > 0 && !locked && !isReadOnly && !isGraphView" type="button" class="mindmap-view__chip" @click="findDuplicates">
        {{ duplicateCount === 1 ? t('mindmap.duplicatesChipOne') : t('mindmap.duplicatesChip', { count: duplicateCount }) }}
      </button>
      <span v-if="isGraphView" class="mindmap-view__badge">{{ t('mindmap.graphViewBadge') }}</span>
      <span v-if="isReadOnly" class="mindmap-view__badge">{{ t('mindmap.readOnlyBadge') }}</span>
    </div>
    <MindmapDuplicates v-if="duplicateGroups" :groups="duplicateGroups" :topic-of="topicOf" @merge="mergeDuplicate" @close="duplicateGroups = null" />
    <MindmapPasteTargetDialog v-if="pendingPaste" @choose="onPasteTargetChosen" @cancel="pendingPaste = null" />
    <MindmapShortcutHelp v-if="isHelpOpen" @close="isHelpOpen = false" />
    <MindmapNumberingDialog :open="pendingNumbering !== null" :count="pendingNumbering?.count ?? 0" @choose="onNumberingChoice" @cancel="pendingNumbering = null" />
  </div>
</template>

<style scoped>
.mindmap-view { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; }
.mindmap-view__stage { position: relative; flex: 1; min-height: 0; display: flex; background: var(--bg); }
.mindmap-view__canvas { flex: 1; min-height: 0; width: 100%; }
.mindmap-view__canvas :deep(:is(.mm-folded-count--direct, .mm-folded-count--all, .mm-folded-count--both) me-epd[data-count-all]:not(.minus)) {
  background-image: none;
  background-color: var(--main-color);
  color: var(--main-bgcolor);
  width: auto;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  white-space: nowrap;
  opacity: 1;
  direction: ltr;
  unicode-bidi: isolate;
}
.mindmap-view__canvas :deep(:is(.mm-folded-count--direct, .mm-folded-count--all, .mm-folded-count--both) .rhs me-epd[data-count-all]:not(.minus)) { left: calc(100% - 8px); right: auto; }
.mindmap-view__canvas :deep(:is(.mm-folded-count--direct, .mm-folded-count--all, .mm-folded-count--both) .lhs me-epd[data-count-all]:not(.minus)) { right: calc(100% - 8px); left: auto; }
.mindmap-view__canvas :deep(:is(.mm-folded-count--direct, .mm-folded-count--all, .mm-folded-count--both) me-nodes.down me-epd[data-count-all]:not(.minus)) { left: calc(50% - 9px); right: auto; transform: translateX(calc(-50% + 9px)); }
.mindmap-view__canvas :deep(.mm-folded-count--direct me-epd[data-count-direct]:not(.minus)::after) { content: attr(data-count-direct); }
.mindmap-view__canvas :deep(.mm-folded-count--all me-epd[data-count-all]:not(.minus)::after) { content: attr(data-count-all); }
.mindmap-view__canvas :deep(.mm-folded-count--both me-epd[data-count-both]:not(.minus)::after) { content: attr(data-count-both); }
.mindmap-view__canvas.mm-grabbing, .mindmap-view__canvas.mm-grabbing :deep(*) { cursor: grabbing !important; }
.mindmap-view__status { position: absolute; inset-block-start: 8px; inset-inline-end: 8px; z-index: 5; display: flex; gap: 6px; pointer-events: none; }
.mindmap-view__badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); opacity: 0.9; }
.mindmap-view__chip { pointer-events: auto; padding: 2px 10px; border-radius: 999px; font-size: 12px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--accent); cursor: pointer; }
.mindmap-view__error { padding: 24px; }
.mindmap-view__error pre { white-space: pre-wrap; opacity: 0.8; }
.mindmap-view__canvas :deep(me-tpc),
.mindmap-view__canvas :deep(me-tpc .text),
.mindmap-view__canvas :deep(#input-box) {
  unicode-bidi: plaintext;
  text-align: start;
}
</style>
