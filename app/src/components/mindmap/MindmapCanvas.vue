<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MindElixir from 'mind-elixir';
import type { MindElixirData, MindElixirInstance, NodeObj } from 'mind-elixir';
import 'mind-elixir/style.css';
import type { MindmapCodec } from '../../lib/mindmap/format';
import type { MapDisplay } from '../../lib/mindmap/display';
import type { Snippet } from '../../lib/mindmap/snippets';
import { useSettingsStore } from '../../stores/settings';
import { useThemeStore } from '../../stores/theme';
import { useToastsStore } from '../../stores/toasts';
import { fenceNodeSource, readNodeSource, type MindmapSource } from '../../lib/mindmap/source';
import { useI18n } from '../../i18n';
import { resolveBindings } from '../../lib/keybindings';
import { createMapKeyDispatch } from '../../lib/mindmap/key-dispatch';
import { layoutDirectionFor, MINDMAP_LAYOUT } from '../../lib/mindmap/direction';
import { decorateFoldedCounts } from '../../lib/mindmap/folded-count';
import { clearActiveMindmap, setActiveMindmap, type MindmapHandle } from '../../lib/mindmap/active';
import { useMindmapCanvasActions } from '../../composables/mindmap/useMindmapCanvasActions';
import { createChordPan } from '../../composables/mindmap/useMindmapChordPan';
import { setDescendantsExpanded } from '../../lib/mindmap/collapse';
import { withoutGateArrows } from '../../lib/mindmap/graph';
import { TAB_SOURCE_PREFIX } from '../../lib/mindmap/workbench';
import MindmapDock from './MindmapDock.vue';
import MindmapDockButton from './MindmapDockButton.vue';
import MindmapShortcutHelp from './MindmapShortcutHelp.vue';
import MindmapPasteTargetDialog from './MindmapPasteTargetDialog.vue';
import MindmapDuplicates from './MindmapDuplicates.vue';
import MindmapNumberingDialog from './MindmapNumberingDialog.vue';
import MindmapFreezeStrip from './MindmapFreezeStrip.vue';
import { useMindmapCanvasViewport, wrapMove, wrapToCenter } from './useMindmapCanvasViewport.ts';
import { useMindmapCanvasFocus } from './useMindmapCanvasFocus.ts';
import { useMindmapCanvasGates } from './useMindmapCanvasGates.ts';
import { useMindmapCanvasDuplicates } from './useMindmapCanvasDuplicates.ts';
import { useMindmapCanvasTreeEdit } from './useMindmapCanvasTreeEdit.ts';
import { useMindmapCanvasHistory } from './useMindmapCanvasHistory.ts';
import { useMindmapCanvasClipboard } from './useMindmapCanvasClipboard.ts';
import { useMindmapCanvasStyle } from './useMindmapCanvasStyle.ts';
import { useMindmapCanvasMenu } from './useMindmapCanvasMenu.ts';

const SYNC_DEBOUNCE_MS = 300;
const OPERATION_EVENT = 'operation';
const EXPAND_EVENT = 'expandNode';
const SELECT_EVENT = 'selectNodes';
const UNSELECT_EVENT = 'unselectNodes';
const TOPIC_EDITOR_ID = 'input-box';
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
const themeStore = useThemeStore();
const toasts = useToastsStore();
const { t } = useI18n();

const host = ref<HTMLElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const direction = ref<number>(MINDMAP_LAYOUT.SIDE);
const parseError = ref<string | null>(null);
const isHelpOpen = ref(false);
const isReadOnly = ref(false);
let mind: MindElixirInstance | null = null;
let displayOverride: MapDisplay = {};
let snippetsOverride: Snippet[] = [];
let lastSynced = props.content;
let syncTimer: number | null = null;
let pristineSerialized: string | null = null;
let loaded: { content: string; serialized: string } | null = null;

const getMind = (): MindElixirInstance | null => mind;
const isEditBlocked = (): boolean => isReadOnly.value || props.locked;
const canEdit = (): boolean => !isEditBlocked();

const viewport = useMindmapCanvasViewport({ getMind, host, stage });
const focus = useMindmapCanvasFocus({ getMind, focusKey: () => props.focusKey });
const { focusId, strip, frameStyle, refreshFrameStyle, setStripRoot, focusById, refreshStrip, reapplyFocus, leaveFocusQuietly } = focus;
const chordPan = createChordPan({ getMind });
const gates = useMindmapCanvasGates({ getMind, isEditBlocked, scheduleSync });
const dupes = useMindmapCanvasDuplicates({ getMind, isEditBlocked, leaveFocusQuietly, reapplyFocus, syncLabels: () => gates.syncLabels(), scheduleSync });
const { duplicateCount, duplicateGroups, countDuplicates, findDuplicates, topicOf, mergeDuplicate } = dupes;
const tree = useMindmapCanvasTreeEdit({ getMind, isEditBlocked, scheduleSync });
const { pendingNumbering, toggleCollapse, selectRoot, sortSelectedChildren, requestNumbering, onNumberingChoice } = tree;
const history = useMindmapCanvasHistory({
  getMind, isLocked: () => props.locked, isEditBlocked, onSelection: (nodes) => emit('selection', nodes), focusId, focusById, refreshStrip, reapplyFocus, leaveFocusQuietly,
  syncLabels: () => gates.syncLabels(), scheduleSync, scheduleDuplicateCount: dupes.scheduleDuplicateCount,
});
const clipboard = useMindmapCanvasClipboard({ getMind, isEditBlocked, syncLabels: () => gates.syncLabels(), selectedNodes: tree.selectedNodes });
const { pendingPaste, onPasteTargetChosen } = clipboard;
const styles = useMindmapCanvasStyle({ getMind, selectedNodes: tree.selectedNodes, canEditTree: tree.canEditTree, commitTreeEdit: tree.commitTreeEdit, reselect: tree.reselect });
const menu = useMindmapCanvasMenu({
  getMind, getHost: () => host.value, sourcePath: () => props.sourcePath, sourceLabel: () => props.sourceLabel ?? props.exportName, selectedNonRootIds: clipboard.selectedNonRootIds,
  gateItems: () => gates.menu, jumpToSource, pinCurrentAsStripRoot: focus.pinCurrentAsStripRoot, showDetails: () => emit('show-details'), sortSelectedChildren, requestNumbering,
  copyNodePath: clipboard.copyNodePath, copyMap: clipboard.copyMap, pasteMapFromClipboard: clipboard.pasteMapFromClipboard, copyNodeStyle: styles.copyNodeStyle, pasteNodeStyle: styles.pasteNodeStyle,
  styleTemplateMenuItems: styles.styleTemplateMenuItems, reportingErrors: styles.reportingErrors, reportingSyncErrors: styles.reportingSyncErrors,
});

function themeFor(): typeof MindElixir.THEME {
  return themeStore.mode === 'dark' ? MindElixir.DARK_THEME : MindElixir.THEME;
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

function clearPendingSync(): void {
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = null;
}

function syncNow(): void {
  clearPendingSync();
  if (!mind || props.locked || parseError.value !== null) return;
  const serialized = props.codec.serialize(withoutGateArrows(mind.getData()), displayOverride, snippetsOverride);
  if (serialized === pristineSerialized && props.content === '') return;
  const next = serialized === loaded?.serialized ? loaded.content : serialized;
  if (next === props.content) return;
  lastSynced = next;
  emit('update:content', lastSynced);
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
    contextMenu: { extend: menu.extendedItems() },
    before: gates.guards,
    toolBar: false,
    keypress: true,
    allowUndo: true,
    theme: themeFor(),
    pasteHandler: clipboard.onPaste,
  });
  wrapToCenter(mind);
  wrapMove(mind);
  if (props.fenceLine === undefined) setDescendantsExpanded(data.nodeData, false);
  mind.init(data);
  menu.installGroups(mind, host.value);
  direction.value = mind.direction;
  chordPan.attach(host.value);
  stage.value?.addEventListener(FULLSCREEN_CHANGE_EVENT, viewport.onFullscreenChange);
  gates.syncLabels();
  rememberLoaded();
  countDuplicates();
  pristineSerialized = props.content === '' ? props.codec.serialize(mind.getData(), displayOverride, snippetsOverride) : null;
  viewport.centerOnceLaidOut();
  mind.bus.addListener(OPERATION_EVENT, history.onOperation);
  mind.bus.addListener(EXPAND_EVENT, scheduleSync);
  mind.bus.addListener(SELECT_EVENT, history.emitSelection);
  mind.bus.addListener(UNSELECT_EVENT, history.emitSelection);
  mind.bus.addListener(CHANGE_DIRECTION_EVENT, onDirectionChange);
  mind.bus.addListener(LINK_DIV_EVENT, () => { if (mind) decorateFoldedCounts(mind.nodes); });
  history.syncAfterHistoryJumps(mind);
  history.sanitizeCopiedNodes(mind);
  history.guardRemovedNodes(mind);
  focus.wrapFocus(mind);
  reapplyFocus();
  refreshFrameStyle();
  activate();
  emit('ready');
}

function onDirectionChange(next: number): void {
  direction.value = next;
  if (!mind?.isFocusMode) scheduleSync();
}

function flushPendingSync(): void {
  if (syncTimer !== null) syncNow();
}

function teardown(): void {
  clearActiveMindmap(handle);
  chordPan.detach();
  stage.value?.removeEventListener(FULLSCREEN_CHANGE_EVENT, viewport.onFullscreenChange);
  viewport.stopCentering();
  clearPendingSync();
  dupes.resetDuplicateCount();
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
    leaveFocusQuietly();
    mind.refresh(data);
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

const canvasActions = useMindmapCanvasActions({ getMind: () => mind, exportName: () => props.exportName, isReadOnly, isLocked: () => props.locked, getSnippets: () => snippetsOverride, sourceFilePath: () => (props.sourcePath && !props.sourcePath.startsWith(TAB_SOURCE_PREFIX) ? props.sourcePath : null) });

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

const keyDispatch = createMapKeyDispatch({
  isIgnored: (e) => isEditingTopic(e) || isOnMapControl(e),
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
  if (!mind) return;
  if (isLocked) {
    clearPendingSync();
    mind.disableEdit();
    return;
  }
  if (canEdit()) mind.enableEdit();
});

watch(() => themeStore.mode, () => {
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
  if (!mind || isEditBlocked()) return;
  snippetsOverride = [...next];
  scheduleSync();
}

defineExpose({
  flush: flushPendingSync,
  applyStyleTemplate: styles.applyStyleTemplate,
  saveStyleTemplate: styles.reportingErrors(styles.saveStyleTemplate),
  markChanged: scheduleSync,
  run: (actionId: string) => handle.run(actionId),
  getMind: () => mind,
  getDisplayOverride: () => displayOverride,
  setDisplayOverride,
  getSnippets: () => snippetsOverride,
  setSnippets,
  isReadOnly,
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
      <MindmapFreezeStrip v-if="strip && settings.mindmapPinStripOpen" :strip="strip" :focus-id="focusId" :frame-style="frameStyle" @focus="focusById" @anchor="setStripRoot" />
      <div ref="stage" class="mindmap-view__stage">
        <div ref="host" class="mindmap-view__canvas" />
        <slot name="rail" />
        <MindmapDock corner="bottom-end" orientation="row" :label="t('mindmap.dockNavigate')">
          <MindmapDockButton icon="fullscreen" :label="t('mindmap.canvasFullscreen')" @click="viewport.toggleFullscreen" />
          <MindmapDockButton icon="center" :label="t('mindmap.canvasCenter')" @click="viewport.recenter" />
          <MindmapDockButton icon="zoom-out" :label="t('mindmap.canvasZoomOut')" @click="viewport.zoomBy(-1)" />
          <MindmapDockButton icon="zoom-in" :label="t('mindmap.canvasZoomIn')" @click="viewport.zoomBy(1)" />
          <MindmapDockButton icon="fit" :label="t('mindmap.canvasFit')" @click="actions['mindmap.fit']" />
          <MindmapDockButton icon="root" :label="t('mindmap.canvasRoot')" @click="selectRoot" />
          <MindmapDockButton icon="collapse" :label="t('mindmap.canvasCollapse')" @click="toggleCollapse" />
        </MindmapDock>
      </div>
    </template>
    <div class="mindmap-view__status">
      <button v-if="duplicateCount > 0 && !locked && !isReadOnly" type="button" class="mindmap-view__chip" @click="findDuplicates">
        {{ duplicateCount === 1 ? t('mindmap.duplicatesChipOne') : t('mindmap.duplicatesChip', { count: duplicateCount }) }}
      </button>
      <span v-if="isReadOnly" class="mindmap-view__badge">{{ t('mindmap.readOnlyBadge') }}</span>
    </div>
    <MindmapDuplicates v-if="duplicateGroups" :groups="duplicateGroups" :topic-of="topicOf" @merge="mergeDuplicate" @close="duplicateGroups = null" />
    <MindmapPasteTargetDialog v-if="pendingPaste" @choose="onPasteTargetChosen" @cancel="pendingPaste = null" />
    <MindmapShortcutHelp v-if="isHelpOpen" @close="isHelpOpen = false" />
    <MindmapNumberingDialog :open="pendingNumbering !== null" :count="pendingNumbering?.count ?? 0" @choose="onNumberingChoice" @cancel="pendingNumbering = null" />
  </div>
</template>

<style scoped src="./MindmapCanvas.css"></style>
