<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MindElixir from 'mind-elixir';
import type { MindElixirData, MindElixirInstance, NodeObj, Topic } from 'mind-elixir';
import 'mind-elixir/style.css';
import type { MindmapCodec } from '../lib/mindmap-format';
import { sanitizeNodeObj } from '../lib/mindmap-format';
import { useSettingsStore } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { fenceNodeSource, readNodeSource, type MindmapSource } from '../lib/mindmap-source';
import { useI18n } from '../i18n';
import { eventToCombo, resolveBindings } from '../lib/keybindings';
import { MINDMAP_BUILTIN_COMBOS } from '../lib/mindmap-keymap';
import { layoutDirectionFor } from '../lib/mindmap-direction';
import { themeFamily } from '../lib/themes';
import { clearActiveMindmap, setActiveMindmap, type MindmapHandle } from '../lib/mindmap-active';
import { createGateController, type GateMenuAction, type GateNotice } from '../lib/mindmap-gate-controller';
import { useMindmapCanvasActions } from '../composables/useMindmapCanvasActions';
import MindmapShortcutHelp from './MindmapShortcutHelp.vue';
import MindmapDuplicates from './MindmapDuplicates.vue';
import { findDuplicateGroups, mergeIntoGate, type DuplicateGroup } from '../lib/mindmap-duplicates';
import { findNode } from '../lib/mindmap-gates';

const SYNC_DEBOUNCE_MS = 300;
const TOPIC_EDITOR_ID = 'input-box';
const OPERATION_EVENT = 'operation';
const EXPAND_EVENT = 'expandNode';
const BEGIN_EDIT_OPERATION = 'beginEdit';
const CHORD_PREFIX_COMBO = 'Mod+K';
const TOGGLE_NODE_ACTION = 'mindmap.toggleNode';
const INTERACTIVE_SELECTOR = 'button, input, select, textarea, a[href], [contenteditable="true"], [role="button"], [role="menuitem"]';

const props = withDefaults(defineProps<{ content: string; codec: MindmapCodec; exportName?: string; fenceLine?: number }>(), { exportName: 'mindmap' });
const emit = defineEmits<{ 'update:content': [text: string]; 'open-as-text': []; 'jump-to-source': [source: MindmapSource] }>();
const settings = useSettingsStore();
const toasts = useToastsStore();
const { t } = useI18n();

const host = ref<HTMLElement | null>(null);
const parseError = ref<string | null>(null);
const isHelpOpen = ref(false);
const isReadOnly = ref(false);
let mind: MindElixirInstance | null = null;
let lastSynced = props.content;
let syncTimer: number | null = null;
let pristineSerialized: string | null = null;
let centerObserver: ResizeObserver | null = null;
let wasChordPrefixPressed = false;

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
  return parsed.data;
}

function syncNow(): void {
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = null;
  if (!mind || parseError.value !== null) return;
  const serialized = props.codec.serialize(mind.getData());
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

function scheduleSync(): void {
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(syncNow, SYNC_DEBOUNCE_MS);
}

function mount(): void {
  const data = loadData();
  if (!host.value || !data) return;
  mind = new MindElixir({
    el: host.value,
    direction: layoutDirectionFor(data),
    editable: !isReadOnly.value,
    contextMenu: { extend: gates.menu },
    before: gates.guards,
    toolBar: true,
    keypress: true,
    allowUndo: true,
    theme: themeFor(),
  });
  mind.init(data);
  gates.syncLabels();
  pristineSerialized = props.content === '' ? props.codec.serialize(mind.getData()) : null;
  centerOnceLaidOut();
  mind.bus.addListener(OPERATION_EVENT, onOperation);
  mind.bus.addListener(EXPAND_EVENT, scheduleSync);
  syncAfterHistoryJumps(mind);
  sanitizeCopiedNodes(mind);
  activate();
}

function onOperation(info: { name: string }): void {
  if (info.name === BEGIN_EDIT_OPERATION) return;
  gates.syncLabels();
  scheduleSync();
}

function syncAfterHistoryJumps(instance: MindElixirInstance): void {
  const { undo, redo } = instance;
  instance.undo = () => { undo.call(instance); scheduleSync(); };
  instance.redo = () => { redo.call(instance); scheduleSync(); };
}

function sanitizedTopic(tpc: Topic): Topic | null {
  const nodeObj: NodeObj | null = sanitizeNodeObj(tpc.nodeObj);
  return nodeObj ? ({ nodeObj } as Topic) : null;
}

function sanitizeCopiedNodes(instance: MindElixirInstance): void {
  const { copyNodes } = instance;
  instance.copyNodes = (tpcs, to) => {
    const safe = tpcs.map(sanitizedTopic).filter((tpc): tpc is Topic => tpc !== null);
    return copyNodes.call(instance, safe, to);
  };
}

function flushPendingSync(): void {
  if (syncTimer !== null) syncNow();
}

function teardown(): void {
  clearActiveMindmap(handle);
  stopCentering();
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = null;
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
    mind.refresh(data);
    gates.syncLabels();
    mind.clearHistory?.();
    return;
  }
  await nextTick();
  if (mind) return;
  mount();
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

const canvasActions = useMindmapCanvasActions({ getMind: () => mind, exportName: () => props.exportName, isReadOnly });

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
  isReadOnly: () => isReadOnly.value,
  brokenLabel: () => t('mindmap.gateBroken'),
  notify: (key: GateNotice) => toasts.info(t(`mindmap.${key}`)),
  onChange: scheduleSync,
}, gateMenuLabels());

const duplicateGroups = ref<DuplicateGroup[] | null>(null);

function findDuplicates(): void {
  if (mind) duplicateGroups.value = findDuplicateGroups(mind.nodeData);
}

function topicOf(id: string): string {
  return (mind && findNode(mind.nodeData, id)?.topic) ?? '';
}

function mergeDuplicate(keepId: string, dupId: string): void {
  if (!mind || isReadOnly.value) return;
  const merged = mergeIntoGate(mind.getData(), keepId, dupId);
  if (!merged) return;
  mind.refresh(merged);
  gates.syncLabels();
  scheduleSync();
  findDuplicates();
}

const actions: Record<string, () => void> = {
  [TOGGLE_NODE_ACTION]: toggleCurrentNode,
  'mindmap.fit': () => mind?.scaleFit(),
  'mindmap.focusRoot': selectRoot,
  'mindmap.shortcutHelp': () => { isHelpOpen.value = true; },
  'mindmap.jumpToSource': jumpToSource,
  'mindmap.findDuplicates': findDuplicates,
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
  setActiveMindmap(handle);
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

function comboForMap(e: KeyboardEvent): string | null {
  const combo = eventToCombo(e);
  if (!combo || isEditingTopic(e) || isOnMapControl(e)) return null;
  return combo;
}

function onKeydownCapture(e: KeyboardEvent): void {
  const combo = comboForMap(e);
  if (!combo) return;
  const isChordFollowUp = wasChordPrefixPressed;
  wasChordPrefixPressed = combo === CHORD_PREFIX_COMBO;
  if (isChordFollowUp) scheduleSync();
  const actionId = resolveBindings(settings.keybindings, 'mindmap').get(combo);
  const run = actionId && canRunOn(actionId, e) ? actions[actionId] : undefined;
  if (!run) return;
  e.preventDefault();
  e.stopPropagation();
  if (!e.repeat) run();
}

function onKeydown(e: KeyboardEvent): void {
  const combo = comboForMap(e);
  if (combo && MINDMAP_BUILTIN_COMBOS.has(combo)) e.stopPropagation();
}

watch(() => props.content, (content) => {
  if (content === lastSynced) return;
  lastSynced = content;
  void applyExternalContent();
});

watch(() => settings.theme, () => mind?.changeTheme(themeFor()));

onMounted(() => {
  mount();
  window.addEventListener('solomd:flush-content-sync', flushPendingSync);
});

onBeforeUnmount(() => {
  window.removeEventListener('solomd:flush-content-sync', flushPendingSync);
  flushPendingSync();
  teardown();
});

defineExpose({ flush: flushPendingSync });
</script>

<template>
  <div class="mindmap-view" @keydown.capture="onKeydownCapture" @keydown="onKeydown" @focusin="activate" @pointerdown="activate">
    <div v-if="parseError" class="mindmap-view__error" role="alert">
      <p>{{ t('mindmap.parseError') }}</p>
      <pre>{{ parseError }}</pre>
      <button type="button" @click="emit('open-as-text')">{{ t('mindmap.openAsText') }}</button>
    </div>
    <div v-else ref="host" class="mindmap-view__canvas" />
    <span v-if="isReadOnly" class="mindmap-view__badge">{{ t('mindmap.readOnlyBadge') }}</span>
    <MindmapDuplicates v-if="duplicateGroups" :groups="duplicateGroups" :topic-of="topicOf" @merge="mergeDuplicate" @close="duplicateGroups = null" />
    <MindmapShortcutHelp v-if="isHelpOpen" @close="isHelpOpen = false" />
  </div>
</template>

<style scoped>
.mindmap-view { position: relative; width: 100%; height: 100%; }
.mindmap-view__canvas { width: 100%; height: 100%; }
.mindmap-view__badge { position: absolute; inset-block-start: 8px; inset-inline-end: 8px; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: var(--bg-secondary, #eee); opacity: 0.85; pointer-events: none; }
.mindmap-view__error { padding: 24px; }
.mindmap-view__error pre { white-space: pre-wrap; opacity: 0.8; }
.mindmap-view__canvas :deep(me-tpc),
.mindmap-view__canvas :deep(me-tpc .text),
.mindmap-view__canvas :deep(#input-box) {
  unicode-bidi: plaintext;
  text-align: start;
}
</style>
