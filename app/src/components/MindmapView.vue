<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MindElixir from 'mind-elixir';
import type { MindElixirData, MindElixirInstance } from 'mind-elixir';
import 'mind-elixir/style.css';
import type { Tab } from '../types';
import { useTabsStore } from '../stores/tabs';
import { useSettingsStore } from '../stores/settings';
import { useI18n } from '../i18n';
import { parseMindmap, rootTopicFromFileName, serializeMindmap } from '../lib/mindmap-format';
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

const props = defineProps<{ tab: Tab }>();
const tabs = useTabsStore();
const settings = useSettingsStore();
const { t } = useI18n();

const host = ref<HTMLElement | null>(null);
const parseError = ref<string | null>(null);
const isHelpOpen = ref(false);
let mind: MindElixirInstance | null = null;
let lastSynced = props.tab.content;
let syncTimer: number | null = null;
let pristineSerialized: string | null = null;
let centerObserver: ResizeObserver | null = null;
let wasChordPrefixPressed = false;

function themeFor(): typeof MindElixir.THEME {
  return themeFamily(settings.theme) === 'dark' ? MindElixir.DARK_THEME : MindElixir.THEME;
}

function loadData(): MindElixirData | null {
  const parsed = parseMindmap(props.tab.content, rootTopicFromFileName(props.tab.fileName));
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
  const serialized = serializeMindmap(mind.getData());
  if (serialized === pristineSerialized && props.tab.content === '') return;
  lastSynced = serialized;
  tabs.setContent(props.tab.id, lastSynced);
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
  pristineSerialized = props.tab.content === '' ? serializeMindmap(mind.getData()) : null;
  centerOnceLaidOut();
  mind.bus.addListener(OPERATION_EVENT, onOperation);
  mind.bus.addListener(EXPAND_EVENT, scheduleSync);
  syncAfterHistoryJumps(mind);
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
  'mindmap.toggleNode': toggleCurrentNode,
  'mindmap.fit': () => mind?.scaleFit(),
  'mindmap.focusRoot': selectRoot,
  'mindmap.shortcutHelp': () => { isHelpOpen.value = true; },
};

function isEditingTopic(e: KeyboardEvent): boolean {
  return e.target instanceof HTMLElement && e.target.id === TOPIC_EDITOR_ID;
}

function onKeydown(e: KeyboardEvent): void {
  const combo = eventToCombo(e);
  if (!combo || isEditingTopic(e)) return;
  const isChordFollowUp = wasChordPrefixPressed;
  wasChordPrefixPressed = combo === CHORD_PREFIX_COMBO;
  if (isChordFollowUp) scheduleSync();
  const actionId = resolveBindings(settings.keybindings, 'mindmap').get(combo);
  const run = actionId ? actions[actionId] : undefined;
  if (run) {
    e.preventDefault();
    e.stopPropagation();
    run();
    return;
  }
  if (MINDMAP_BUILTIN_COMBOS.has(combo)) e.stopPropagation();
}

function openAsText(): void {
  props.tab.language = 'plaintext';
}

watch(() => props.tab.content, (content) => {
  if (content === lastSynced) return;
  lastSynced = content;
  void applyExternalContent();
});

watch(() => settings.theme, () => mind?.changeTheme(themeFor()));

onMounted(() => {
  mount();
  window.addEventListener('solomd:flush-content-sync', syncNow);
});

onBeforeUnmount(() => {
  window.removeEventListener('solomd:flush-content-sync', syncNow);
  if (syncTimer !== null) syncNow();
  teardown();
});
</script>

<template>
  <div class="mindmap-view" @keydown="onKeydown">
    <div v-if="parseError" class="mindmap-view__error" role="alert">
      <p>{{ t('mindmap.parseError') }}</p>
      <pre>{{ parseError }}</pre>
      <button type="button" @click="openAsText">{{ t('mindmap.openAsText') }}</button>
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
