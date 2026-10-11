<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
  if (!mind) return;
  lastSynced = serializeMindmap(mind.getData());
  tabs.setContent(props.tab.id, lastSynced);
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
  mind.bus.addListener('operation', scheduleSync);
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
  if (content === lastSynced || !mind) return;
  lastSynced = content;
  const data = loadData();
  if (data) mind.refresh(data);
});

watch(() => settings.theme, () => mind?.changeTheme(themeFor()));

onMounted(() => {
  mount();
  window.addEventListener('solomd:flush-content-sync', syncNow);
});

onBeforeUnmount(() => {
  window.removeEventListener('solomd:flush-content-sync', syncNow);
  if (syncTimer !== null) syncNow();
  mind?.destroy();
  mind = null;
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
