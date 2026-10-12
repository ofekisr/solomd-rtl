<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { NodeObj } from 'mind-elixir';
import type { Tab } from '../types';
import { useI18n } from '../i18n';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useSettingsStore } from '../stores/settings';
import { mmapCodec } from '../lib/mindmap-format';
import { mapToHeadingsMarkdown } from '../lib/mindmap-headings';
import { withoutGateArrows } from '../lib/mindmap-graph';
import { checkSourceExit, normalizeMindmapMode, targetModeFor, VIEW_ACTIONS, type MindmapMode } from '../lib/mindmap-view-mode';
import { clearActiveMindmap, setActiveMindmap, type MindmapCanvasApi, type MindmapHandle } from '../lib/mindmap-active';
import { eventToCombo, resolveBindings } from '../lib/keybindings';
import { useMindmapJump } from '../composables/useMindmapJump';
import type { MindmapSource } from '../lib/mindmap-source';
import MindmapToolbar from './MindmapToolbar.vue';
import { buildNodePatch, type NodeField } from '../lib/mindmap-node-style';
import MindmapCanvas from './MindmapCanvas.vue';
import MindmapSidePanel from './MindmapSidePanel.vue';
import MindmapNodeFields from './MindmapNodeFields.vue';
import Editor from './Editor.vue';
import Preview from './Preview.vue';

const SOURCE_LANGUAGE = 'json';
const FLUSH_CONTENT_EVENT = 'solomd:flush-content-sync';
const TOGGLE_PANEL_ACTION = 'mindmap.togglePanel';
const props = defineProps<{ tab: Tab }>();
const tabs = useTabsStore();
const toasts = useToastsStore();
const settings = useSettingsStore();
const { t } = useI18n();
const { jumpTo } = useMindmapJump();
const codec = computed(() => mmapCodec(props.tab.fileName));
const exportName = computed(() => props.tab.fileName.replace(/\.[^.]+$/u, ''));
const mode = computed<MindmapMode>(() => normalizeMindmapMode(props.tab.mindmapMode));
const canvas = ref<MindmapCanvasApi | null>(null);
const sourceError = ref<string | null>(null);
const selected = ref<NodeObj[]>([]);
const singleNode = computed(() => (selected.value.length === 1 ? selected.value[0] : null));
const isPanelEditable = computed(() => !(canvas.value?.isReadOnly || canvas.value?.isGraphView));
const isPanelVisible = computed(() => mode.value === 'map' && settings.mindmapPanelOpen);

const sourceTab = computed<Tab>(() => new Proxy(props.tab, {
  get: (target, key) => (key === 'language' ? SOURCE_LANGUAGE : Reflect.get(target, key)),
}));

const outlineMarkdown = computed(() => {
  if (mode.value !== 'outline') return '';
  const parsed = codec.value.parse(props.tab.content);
  return parsed.ok ? mapToHeadingsMarkdown(withoutGateArrows(parsed.data)) : '';
});

function setMode(next: MindmapMode): void {
  if (next === mode.value) return;
  if (mode.value === 'map') canvas.value?.flush();
  if (mode.value === 'source') window.dispatchEvent(new Event(FLUSH_CONTENT_EVENT));
  if (mode.value === 'source' && !leaveSourceAllowed()) return;
  sourceError.value = null;
  props.tab.mindmapMode = next;
  tabs.persist();
}

function leaveSourceAllowed(): boolean {
  const exit = checkSourceExit(props.tab.content, (text) => codec.value.parse(text));
  if (exit.ok) return true;
  sourceError.value = exit.error;
  toasts.error(t('mindmap.sourceInvalid'));
  return false;
}

function applyNodePatch(field: NodeField, value: string | number | boolean | null): void {
  const mind = canvas.value?.getMind();
  const node = singleNode.value;
  if (!mind || !node || !isPanelEditable.value) return;
  const result = buildNodePatch(node, field, value);
  if (!result.ok) {
    toasts.error(t('mindmap.fieldUrlInvalid'));
    return;
  }
  const element = mind.findEle(node.id);
  mind.reshapeNode(element, result.patch);
  selected.value = [{ ...element.nodeObj }];
}

function runViewAction(actionId: string): boolean {
  if (actionId === TOGGLE_PANEL_ACTION) {
    settings.toggleMindmapPanel();
    return true;
  }
  const target = targetModeFor(actionId, mode.value);
  if (target === null) return false;
  setMode(target);
  return true;
}

const handle: MindmapHandle = {
  run: (actionId) => runViewAction(actionId) || (canvas.value?.run(actionId) ?? false),
};

function activate(): void {
  setActiveMindmap(handle);
}

function onViewKey(e: KeyboardEvent): void {
  const combo = eventToCombo(e);
  const actionId = combo ? resolveBindings(settings.keybindings, 'mindmap').get(combo) : undefined;
  if (!actionId || !(actionId in VIEW_ACTIONS || actionId === TOGGLE_PANEL_ACTION)) return;
  e.preventDefault();
  e.stopPropagation();
  runViewAction(actionId);
}

function onUpdate(text: string): void {
  tabs.setContent(props.tab.id, text);
}

function onJump(source: MindmapSource): void {
  if (!source.path) {
    toasts.info(t('mindmap.sourceUnavailable'));
    return;
  }
  void jumpTo(source, props.tab.id);
}

onMounted(activate);
onBeforeUnmount(() => clearActiveMindmap(handle));
defineExpose({ setMode, canvas, mode });
</script>

<template>
  <div class="mindmap-shell" @keydown.capture="onViewKey" @focusin="activate" @pointerdown="activate">
    <MindmapToolbar
      :mode="mode"
      :is-panel-open="settings.mindmapPanelOpen"
      :is-read-only="canvas?.isReadOnly ?? false"
      :is-graph-view="canvas?.isGraphView ?? false"
      @set-mode="setMode"
      @run="(id) => handle.run(id)"
      @toggle-panel="settings.toggleMindmapPanel()"
    />
    <div class="mindmap-shell__body">
      <MindmapCanvas
        v-if="mode === 'map'"
        ref="canvas"
        :content="tab.content"
        :codec="codec"
        :export-name="exportName"
        :register-active="false"
        @update:content="onUpdate"
        @selection="(nodes) => (selected = nodes)"
        @open-as-text="setMode('source')"
        @jump-to-source="onJump"
      />
      <div v-else-if="mode === 'source'" class="mindmap-shell__source">
        <div v-if="sourceError" class="mindmap-shell__error" role="alert">{{ sourceError }}</div>
        <Editor :key="`${tab.id}-source`" :tab="sourceTab" />
      </div>
      <Preview v-else :source="outlineMarkdown" class="mindmap-shell__outline" />
      <MindmapSidePanel v-if="isPanelVisible" :has-single-node="singleNode !== null" :has-multiple-nodes="selected.length > 1">
        <template #node>
          <p v-if="!isPanelEditable" class="mindmap-shell__hint">{{ t('mindmap.panelReadOnly') }}</p>
          <MindmapNodeFields v-if="singleNode" :node="singleNode" :disabled="!isPanelEditable" @patch="applyNodePatch" />
        </template>
      </MindmapSidePanel>
    </div>
  </div>
</template>

<style scoped>
.mindmap-shell { display: flex; flex-direction: column; width: 100%; height: 100%; }
.mindmap-shell__body { position: relative; flex: 1; min-height: 0; display: flex; }
.mindmap-shell__body > * { flex: 1; min-width: 0; }
.mindmap-shell__source { display: flex; flex-direction: column; }
.mindmap-shell__error { padding: 6px 12px; font-size: 12px; background: var(--bg-secondary, #fee); border-block-end: 1px solid var(--border, #ccc); }
.mindmap-shell__hint { font-size: 12px; opacity: 0.7; }
.mindmap-shell__outline { overflow: auto; }
.mindmap-shell__outline :deep(:is(h1, h2, h3, h4, h5, h6, li, p)) { unicode-bidi: plaintext; text-align: start; }
</style>
