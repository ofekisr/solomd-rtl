<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MindElixir from 'mind-elixir';
import type { MindElixirData, MindElixirInstance, NodeObj, Topic } from 'mind-elixir';
import 'mind-elixir/style.css';
import type { MindmapCodec } from '../lib/mindmap-format';
import { sanitizeNodeObj } from '../lib/mindmap-format';
import { useSettingsStore } from '../stores/settings';
import { useI18n } from '../i18n';
import { eventToCombo, resolveBindings } from '../lib/keybindings';
import { MINDMAP_BUILTIN_COMBOS } from '../lib/mindmap-keymap';
import { layoutDirectionFor } from '../lib/mindmap-direction';
import { themeFamily } from '../lib/themes';
import MindmapShortcutHelp from './MindmapShortcutHelp.vue';

const SYNC_DEBOUNCE_MS = 300;
const TOPIC_EDITOR_ID = 'input-box';
const OPERATION_EVENT = 'operation';
const EXPAND_EVENT = 'expandNode';
const BEGIN_EDIT_OPERATION = 'beginEdit';
const CHORD_PREFIX_COMBO = 'Mod+K';
const TOGGLE_NODE_ACTION = 'mindmap.toggleNode';
const INTERACTIVE_SELECTOR = 'button, input, select, textarea, a[href], [contenteditable="true"], [role="button"], [role="menuitem"]';

const props = defineProps<{ content: string; codec: MindmapCodec }>();
const emit = defineEmits<{ 'update:content': [text: string]; 'open-as-text': [] }>();
const settings = useSettingsStore();
const { t } = useI18n();

const host = ref<HTMLElement | null>(null);
const parseError = ref<string | null>(null);
const isHelpOpen = ref(false);
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
    editable: true,
    contextMenu: true,
    toolBar: true,
    keypress: true,
    allowUndo: true,
    theme: themeFor(),
  });
  mind.init(data);
  pristineSerialized = props.content === '' ? props.codec.serialize(mind.getData()) : null;
  centerOnceLaidOut();
  mind.bus.addListener(OPERATION_EVENT, onOperation);
  mind.bus.addListener(EXPAND_EVENT, scheduleSync);
  syncAfterHistoryJumps(mind);
  sanitizeCopiedNodes(mind);
}

function onOperation(info: { name: string }): void {
  if (info.name === BEGIN_EDIT_OPERATION) return;
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

const actions: Record<string, () => void> = {
  [TOGGLE_NODE_ACTION]: toggleCurrentNode,
  'mindmap.fit': () => mind?.scaleFit(),
  'mindmap.focusRoot': selectRoot,
  'mindmap.shortcutHelp': () => { isHelpOpen.value = true; },
};

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

function onKeydown(e: KeyboardEvent): void {
  const combo = eventToCombo(e);
  if (!combo || isEditingTopic(e) || isOnMapControl(e)) return;
  const isChordFollowUp = wasChordPrefixPressed;
  wasChordPrefixPressed = combo === CHORD_PREFIX_COMBO;
  if (isChordFollowUp) scheduleSync();
  const actionId = resolveBindings(settings.keybindings, 'mindmap').get(combo);
  const run = actionId && canRunOn(actionId, e) ? actions[actionId] : undefined;
  if (run) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) run();
    return;
  }
  if (MINDMAP_BUILTIN_COMBOS.has(combo)) e.stopPropagation();
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
  <div class="mindmap-view" @keydown="onKeydown">
    <div v-if="parseError" class="mindmap-view__error" role="alert">
      <p>{{ t('mindmap.parseError') }}</p>
      <pre>{{ parseError }}</pre>
      <button type="button" @click="emit('open-as-text')">{{ t('mindmap.openAsText') }}</button>
    </div>
    <div v-else ref="host" class="mindmap-view__canvas" />
    <MindmapShortcutHelp v-if="isHelpOpen" @close="isHelpOpen = false" />
  </div>
</template>

<style scoped>
.mindmap-view { position: relative; width: 100%; height: 100%; }
.mindmap-view__canvas { width: 100%; height: 100%; }
.mindmap-view__error { padding: 24px; }
.mindmap-view__error pre { white-space: pre-wrap; opacity: 0.8; }
.mindmap-view__canvas :deep(me-tpc),
.mindmap-view__canvas :deep(me-tpc .text),
.mindmap-view__canvas :deep(#input-box) {
  unicode-bidi: plaintext;
  text-align: start;
}
</style>
