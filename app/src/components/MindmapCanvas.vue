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
import { resolveBindings } from '../lib/keybindings';
import { createMapKeyDispatch } from '../lib/mindmap-key-dispatch';
import { layoutDirectionFor, MINDMAP_LAYOUT } from '../lib/mindmap-direction';
import { themeFamily } from '../lib/themes';
import { clearActiveMindmap, setActiveMindmap, type MindmapHandle } from '../lib/mindmap-active';
import { createGateController, type GateMenuAction, type GateNotice } from '../lib/mindmap-gate-controller';
import { useMindmapCanvasActions } from '../composables/useMindmapCanvasActions';
import { createHoverPan } from '../composables/useMindmapHoverPan';
import { frameDelta, insetRect, parseTranslate } from '../lib/mindmap-frame';
import MindmapDock from './MindmapDock.vue';
import MindmapDockButton from './MindmapDockButton.vue';
import MindmapShortcutHelp from './MindmapShortcutHelp.vue';
import MindmapDuplicates from './MindmapDuplicates.vue';
import { findDuplicateGroups, mergeIntoGate, type DuplicateGroup } from '../lib/mindmap-duplicates';
import { findNode, isGate } from '../lib/mindmap-gates';
import { parsePaste, type PastePayload } from '../lib/mindmap-paste';
import { buildIdMap, remapArrows, remapGates, remapSummaries } from '../lib/mindmap-paste-remap';
import { withGateArrows } from '../lib/mindmap-graph';
import { buildFreezeStrip, getTabFocus, pathTo, setTabFocus, type FreezeStrip } from '../lib/mindmap-focus';
import MindmapFreezeStrip from './MindmapFreezeStrip.vue';

const SYNC_DEBOUNCE_MS = 300;
const TOPIC_EDITOR_ID = 'input-box';
const OPERATION_EVENT = 'operation';
const EXPAND_EVENT = 'expandNode';
const SELECT_EVENT = 'selectNodes';
const UNSELECT_EVENT = 'unselectNodes';
const BEGIN_EDIT_OPERATION = 'beginEdit';
const COPY_NODES_OPERATION = 'copyNodes';
const PASTE_NOTICE_KEYS = { empty: null, tooLarge: 'mindmap.pasteTooLarge', unrecognized: 'mindmap.pasteUnrecognized' } as const;
const TOGGLE_NODE_ACTION = 'mindmap.toggleNode';
const CHANGE_DIRECTION_EVENT = 'changeDirection';
const FULLSCREEN_CHANGE_EVENT = 'fullscreenchange';
const INTERACTIVE_SELECTOR = 'button, input, select, textarea, a[href], [contenteditable="true"], [role="button"], [role="menuitem"]';

const props = withDefaults(
  defineProps<{ content: string; codec: MindmapCodec; exportName?: string; fenceLine?: number; registerActive?: boolean; locked?: boolean; focusKey?: string }>(),
  { exportName: 'mindmap', registerActive: true, locked: false },
);
const emit = defineEmits<{
  'update:content': [text: string];
  'open-as-text': [];
  'jump-to-source': [source: MindmapSource];
  selection: [nodes: NodeObj[]];
  ready: [];
}>();
const settings = useSettingsStore();
const toasts = useToastsStore();
const { t } = useI18n();

const host = ref<HTMLElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const direction = ref<number>(MINDMAP_LAYOUT.SIDE);
const parseError = ref<string | null>(null);
const isHelpOpen = ref(false);
const isReadOnly = ref(false);
const isGraphView = ref(false);
const focusId = ref<string | null>(props.focusKey ? getTabFocus(props.focusKey) : null);
const strip = ref<FreezeStrip | null>(null);
let isApplyingFocus = false;
let graphBaseline: MindElixirData | null = null;
let mind: MindElixirInstance | null = null;
let displayOverride: MapDisplay = {};
let snippetsOverride: Snippet[] = [];
let lastSynced = props.content;
let syncTimer: number | null = null;
let pristineSerialized: string | null = null;
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
  lastSynced = serialized;
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
    contextMenu: { extend: [...gates.menu, { name: t('mindmap.jumpToSourceMenu'), onclick: jumpToSource }] },
    before: gates.guards,
    toolBar: false,
    keypress: true,
    allowUndo: true,
    theme: themeFor(),
    pasteHandler: onPaste,
  });
  wrapToCenter(mind);
  mind.init(data);
  direction.value = mind.direction;
  hoverPan.attach(host.value);
  stage.value?.addEventListener(FULLSCREEN_CHANGE_EVENT, onFullscreenChange);
  gates.syncLabels();
  countDuplicates();
  pristineSerialized = props.content === '' ? props.codec.serialize(mind.getData(), displayOverride, snippetsOverride) : null;
  centerOnceLaidOut();
  mind.bus.addListener(OPERATION_EVENT, onOperation);
  mind.bus.addListener(EXPAND_EVENT, scheduleSync);
  mind.bus.addListener(SELECT_EVENT, emitSelection);
  mind.bus.addListener(UNSELECT_EVENT, emitSelection);
  mind.bus.addListener(CHANGE_DIRECTION_EVENT, onDirectionChange);
  syncAfterHistoryJumps(mind);
  sanitizeCopiedNodes(mind);
  guardRemovedNodes(mind);
  wrapFocus(mind);
  reapplyFocus();
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

const hoverPan = createHoverPan({ getMind: () => mind, isToggled: () => settings.mindmapHoverPan });

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

function refreshStrip(knownRoot?: NodeObj | null): void {
  strip.value = mind && props.focusKey ? buildFreezeStrip(knownRoot ?? fullRoot(mind), focusId.value) : null;
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
  hoverPan.detach();
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

function toggleCurrentNode(): void {
  const node = mind?.currentNode;
  if (!mind || !node?.nodeObj.children?.length) return;
  mind.expandNode(node, node.nodeObj.expanded === false);
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

const canvasActions = useMindmapCanvasActions({ getMind: () => mind, exportName: () => props.exportName, isReadOnly, isGraphView, isLocked: () => props.locked, getSnippets: () => snippetsOverride });

const GATE_MENU_LABEL_KEYS: Record<GateMenuAction, string> = {
  'mindmap.markGateTarget': 'mindmap.gateMarkTarget',
  'mindmap.insertGate': 'mindmap.gateInsert',
  'mindmap.followGate': 'mindmap.gateFollow',
  'mindmap.repairGate': 'mindmap.gateRepair',
  'mindmap.removeGate': 'mindmap.gateRemove',
};

function gateMenuLabels(): Record<GateMenuAction, string> {
  const labels: Record<GateMenuAction, string> = { ...GATE_MENU_LABEL_KEYS };
  for (const id of Object.keys(GATE_MENU_LABEL_KEYS) as GateMenuAction[]) labels[id] = t(GATE_MENU_LABEL_KEYS[id]);
  return labels;
}

const gates = createGateController({
  getMind: () => mind,
  isReadOnly: () => isEditBlocked() || isGraphView.value,
  brokenLabel: () => t('mindmap.gateBroken'),
  notify: (key: GateNotice) => toasts.info(t(`mindmap.${key}`)),
  onChange: scheduleSync,
}, gateMenuLabels());

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

const actions: Record<string, () => void> = {
  [TOGGLE_NODE_ACTION]: toggleCurrentNode,
  'mindmap.fit': () => mind?.scaleFit(),
  'mindmap.focusRoot': selectRoot,
  'mindmap.shortcutHelp': () => { isHelpOpen.value = true; },
  'mindmap.jumpToSource': jumpToSource,
  'mindmap.findDuplicates': findDuplicates,
  'mindmap.toggleGraphView': toggleGraphView,
  'mindmap.focusNode': () => { if (mind?.currentNode) mind.focusNode(mind.currentNode); },
  'mindmap.cancelFocus': () => focusById(null),
  'mindmap.undo': () => mind?.undo(),
  'mindmap.layoutLeft': () => mind?.initLeft(),
  'mindmap.layoutRight': () => mind?.initRight(),
  'mindmap.layoutSide': () => mind?.initSide(),
  'mindmap.toggleHoverPan': () => settings.toggleMindmapHoverPan(),
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

function pasteTarget(): Topic | null {
  if (!mind || isEditBlocked() || isGraphView.value) return null;
  const target = mind.currentNode;
  if (!target) toasts.info(t('mindmap.pasteSelectNode'));
  else if (isGate(target.nodeObj)) toasts.info(t('mindmap.gateCannotHoldChildren'));
  else return target;
  return null;
}

async function insertPayload(instance: MindElixirInstance, target: Topic, payload: PastePayload): Promise<void> {
  const countBefore = target.nodeObj.children?.length ?? 0;
  await instance.copyNodes(payload.nodes.map((nodeObj) => ({ nodeObj }) as Topic), target);
  const children = target.nodeObj.children ?? [];
  if (children.length !== countBefore + payload.nodes.length) return;
  const inserted = children.slice(countBefore);
  const idMap = buildIdMap(payload.nodes, inserted);
  const remapped = remapGates(inserted, idMap);
  for (const arrow of remapArrows(payload.arrows, idMap)) instance.createArrowFrom(arrow);
  for (const summary of remapSummaries(payload.summaries, idMap)) instance.createSummaryFrom(summary);
  if (remapped > 0) instance.bus.fire(OPERATION_EVENT, { name: COPY_NODES_OPERATION, objs: inserted });
  gates.syncLabels();
}

function onPaste(e: ClipboardEvent): void {
  if (e.target instanceof HTMLElement && e.target.id === TOPIC_EDITOR_ID) return;
  const target = pasteTarget();
  if (!mind || !target) return;
  const result = parsePaste(e.clipboardData?.getData('text/plain') ?? '');
  e.preventDefault();
  if (!result.ok) {
    const key = PASTE_NOTICE_KEYS[result.reason];
    if (key) toasts.info(t(key));
    return;
  }
  void insertPayload(mind, target, result.payload);
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
  run: (actionId: string) => handle.run(actionId),
  getMind: () => mind,
  getDisplayOverride: () => displayOverride,
  setDisplayOverride,
  getSnippets: () => snippetsOverride,
  setSnippets,
  isReadOnly,
  isGraphView,
  direction,
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
      <MindmapFreezeStrip v-if="strip && !isGraphView" :strip="strip" :focus-id="focusId" @focus="focusById" />
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
          <span class="mm-dock-sep" aria-hidden="true" />
          <MindmapDockButton icon="pan" :label="t('mindmap.canvasHoverPan')" :pressed="settings.mindmapHoverPan" @click="settings.toggleMindmapHoverPan()" />
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
    <MindmapShortcutHelp v-if="isHelpOpen" @close="isHelpOpen = false" />
  </div>
</template>

<style scoped>
.mindmap-view { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; }
.mindmap-view__stage { position: relative; flex: 1; min-height: 0; display: flex; background: var(--bg); }
.mindmap-view__canvas { flex: 1; min-height: 0; width: 100%; }
.mindmap-view__canvas.mm-hover-panning, .mindmap-view__canvas.mm-hover-panning :deep(*) { cursor: grab !important; }
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
