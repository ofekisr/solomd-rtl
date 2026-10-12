<script setup lang="ts">
import { themeFamily } from '../lib/themes';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MindElixirInstance, NodeObj } from 'mind-elixir';
import type { Topic } from 'mind-elixir';
import type { Tab, ViewMode } from '../types';
import { useI18n } from '../i18n';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useSettingsStore } from '../stores/settings';
import { mmapCodec } from '../lib/mindmap-format';
import { outlineMarkdownOf } from '../lib/mindmap-outline';
import { cellHas, checkJsonExit, isLensAction, lensCell, resolveTabLens, targetLensFor, type CellPart, type MindmapLens } from '../lib/mindmap-lens';
import { addViewModeGuard } from '../lib/view-mode-guard';
import { clearActiveMindmap, setActiveMindmap, type MindmapCanvasApi, type MindmapHandle } from '../lib/mindmap-active';
import { eventToCombo, resolveBindings } from '../lib/keybindings';
import { useMindmapJump } from '../composables/useMindmapJump';
import type { MindmapSource } from '../lib/mindmap-source';
import MindmapToolbar from './MindmapToolbar.vue';
import { buildNodePatch, type NodeField } from '../lib/mindmap-node-style';
import MindmapCanvas from './MindmapCanvas.vue';
import MindmapSidePanel from './MindmapSidePanel.vue';
import MindmapNodeFields from './MindmapNodeFields.vue';
import MindmapMapFields from './MindmapMapFields.vue';
import MindmapOutlineText from './MindmapOutlineText.vue';
import type { MapDisplay } from '../lib/mindmap-display';
import { createMapDisplayApplier } from '../composables/useMindmapDisplay';
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
const lens = computed<MindmapLens>(() => resolveTabLens(props.tab));
const parts = computed(() => lensCell(lens.value, settings.viewMode));
const canvas = ref<MindmapCanvasApi | null>(null);
const sourceError = ref<string | null>(null);
const selected = ref<NodeObj[]>([]);
const singleNode = computed(() => (selected.value.length === 1 ? selected.value[0] : null));

function has(part: CellPart): boolean {
  return cellHas(parts.value, part);
}

function partOrder(part: CellPart): number {
  return parts.value.indexOf(part);
}

const isSplit = computed(() => parts.value.length > 1);
const isPanelVisible = computed(() => has('map') && settings.mindmapPanelOpen);
const parsedContent = computed(() => codec.value.parse(props.tab.content));
const outlineMarkdown = computed(() => (has('outlineText') || has('outlinePreview') ? outlineMarkdownOf(parsedContent.value) : ''));
const lastValidContent = ref('');
const liveJsonError = computed<string | null>(() => {
  if (!has('json') || !has('map') || parsedContent.value.ok) return null;
  return parsedContent.value.error;
});
const isMapLocked = computed(() => liveJsonError.value !== null);
const isPanelEditable = computed(() => !(canvas.value?.isReadOnly || canvas.value?.isGraphView || isMapLocked.value));
const jsonError = computed(() => sourceError.value ?? liveJsonError.value);
const mapContent = computed(() => (has('json') ? lastValidContent.value : props.tab.content));

watch(parsedContent, (parsed) => {
  if (!parsed.ok) return;
  lastValidContent.value = props.tab.content;
  sourceError.value = null;
}, { immediate: true });
watch(() => has('map'), (hasMap) => { if (!hasMap) selected.value = []; });

const sourceTab = computed<Tab>(() => new Proxy(props.tab, {
  get: (target, key) => (key === 'language' ? SOURCE_LANGUAGE : Reflect.get(target, key)),
}));

function leaveJsonAllowed(): boolean {
  const exit = checkJsonExit(props.tab.content, (text) => codec.value.parse(text));
  if (exit.ok) return true;
  sourceError.value = exit.error;
  toasts.error(t('mindmap.sourceInvalid'));
  return false;
}

function leaveCellAllowed(nextParts: readonly CellPart[]): boolean {
  canvas.value?.flush();
  if (!has('json') || cellHas(nextParts, 'json')) return true;
  window.dispatchEvent(new Event(FLUSH_CONTENT_EVENT));
  return leaveJsonAllowed();
}

function guardViewChange(next: ViewMode): boolean {
  if (tabs.activeId !== props.tab.id) return true;
  return leaveCellAllowed(lensCell(lens.value, next));
}

function storeLens(next: MindmapLens): void {
  props.tab.mindmapLens = next;
  delete props.tab.mindmapMode;
  tabs.persist();
}

function setLens(next: MindmapLens): void {
  if (next === lens.value) return;
  if (!leaveCellAllowed(lensCell(next, settings.viewMode))) return;
  sourceError.value = null;
  selected.value = [];
  storeLens(next);
}

function migrateLegacyMode(): void {
  if (props.tab.mindmapLens === undefined && props.tab.mindmapMode !== undefined) storeLens(lens.value);
}

function openAsText(): void {
  setLens('data');
  if (!has('json')) settings.setViewMode('edit');
}

function applyNodePatch(field: NodeField, value: string | number | boolean | readonly string[] | null): void {
  const mind = canvas.value?.getMind();
  const node = singleNode.value;
  if (!mind || !node || !isPanelEditable.value) return;
  const result = buildNodePatch(node, field, value);
  if (!result.ok) {
    toasts.error(t('mindmap.fieldUrlInvalid'));
    return;
  }
  const element = findLiveElement(mind, node.id);
  if (!element) {
    selected.value = [];
    return;
  }
  mind.reshapeNode(element, result.patch);
  selected.value = [{ ...element.nodeObj }];
}

function findLiveElement(mind: MindElixirInstance, id: string): Topic | null {
  try {
    return mind.findEle(id) ?? null;
  } catch {
    return null;
  }
}

const displayOverride = ref<MapDisplay>({});
const displayApplier = createMapDisplayApplier();

function applyDisplay(): void {
  const mind = canvas.value?.getMind();
  if (mind) displayApplier.apply(mind, displayOverride.value, settings.mindmapDefaults, themeFamily(settings.theme));
}

function onCanvasReady(): void {
  displayOverride.value = canvas.value?.getDisplayOverride() ?? {};
  applyDisplay();
}

function setOverride(patch: MapDisplay): void {
  if (isMapLocked.value) return;
  displayOverride.value = { ...displayOverride.value, ...patch };
  canvas.value?.setDisplayOverride(displayOverride.value);
  applyDisplay();
}

function clearOverride(key: keyof MapDisplay): void {
  if (isMapLocked.value) return;
  const next = { ...displayOverride.value };
  delete next[key];
  displayOverride.value = next;
  canvas.value?.setDisplayOverride(next);
  applyDisplay();
}

watch(() => settings.mindmapDefaults, applyDisplay, { deep: true });

function runViewAction(actionId: string): boolean {
  if (actionId === TOGGLE_PANEL_ACTION) {
    settings.toggleMindmapPanel();
    return true;
  }
  const target = targetLensFor(actionId, lens.value);
  if (target === null) return false;
  setLens(target);
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
  if (!actionId || !(isLensAction(actionId) || actionId === TOGGLE_PANEL_ACTION)) return;
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

let removeViewGuard: (() => void) | null = null;

onMounted(() => {
  migrateLegacyMode();
  removeViewGuard = addViewModeGuard(guardViewChange);
  activate();
});
onBeforeUnmount(() => {
  removeViewGuard?.();
  clearActiveMindmap(handle);
});
defineExpose({ setLens, canvas, lens });
</script>

<template>
  <div class="mindmap-shell" @keydown.capture="onViewKey" @focusin="activate" @pointerdown="activate">
    <MindmapToolbar
      :lens="lens"
      :has-map="has('map')"
      :is-panel-open="settings.mindmapPanelOpen"
      :is-read-only="canvas?.isReadOnly ?? false"
      :is-locked="isMapLocked"
      :is-graph-view="canvas?.isGraphView ?? false"
      @set-lens="setLens"
      @run="(id) => handle.run(id)"
      @toggle-panel="settings.toggleMindmapPanel()"
    />
    <div class="mindmap-shell__body">
      <div class="mindmap-shell__cell" :class="{ 'mindmap-shell__cell--split': isSplit }">
        <div v-if="has('json')" class="mindmap-shell__source" :style="{ order: partOrder('json') }">
          <div v-if="jsonError" class="mindmap-shell__error" role="alert">{{ jsonError }}</div>
          <Editor :key="`${tab.id}-source`" :tab="sourceTab" />
        </div>
        <MindmapCanvas
          v-if="has('map')"
          ref="canvas"
          :style="{ order: partOrder('map') }"
          :content="mapContent"
          :codec="codec"
          :export-name="exportName"
          :register-active="false"
          :locked="isMapLocked"
          @update:content="onUpdate"
          @selection="(nodes) => (selected = nodes.map((n) => ({ ...n })))"
          @open-as-text="openAsText"
          @jump-to-source="onJump"
          @ready="onCanvasReady"
        />
        <MindmapOutlineText v-if="has('outlineText')" :markdown="outlineMarkdown" :style="{ order: partOrder('outlineText') }" />
        <Preview v-if="has('outlinePreview')" :source="outlineMarkdown" class="mindmap-shell__outline" :style="{ order: partOrder('outlinePreview') }" />
      </div>
      <MindmapSidePanel v-if="isPanelVisible" :has-single-node="singleNode !== null">
        <template #node>
          <p v-if="!isPanelEditable" class="mindmap-shell__hint">{{ t('mindmap.panelReadOnly') }}</p>
          <MindmapNodeFields v-if="singleNode" :node="singleNode" :disabled="!isPanelEditable" @patch="applyNodePatch" />
        </template>
        <template #map>
          <MindmapMapFields :value="displayOverride" :inherited="settings.mindmapDefaults" :disabled="!isPanelEditable" @set="setOverride" @clear="clearOverride" />
        </template>
      </MindmapSidePanel>
    </div>
  </div>
</template>

<style scoped>
.mindmap-shell { display: flex; flex-direction: column; width: 100%; height: 100%; }
.mindmap-shell__body { position: relative; flex: 1; min-height: 0; display: flex; }
.mindmap-shell__body > * { flex: 1; min-width: 0; }
.mindmap-shell__cell { display: flex; min-height: 0; }
.mindmap-shell__cell > * { flex: 1; min-width: 0; min-height: 0; }
.mindmap-shell__cell--split { gap: 1px; background: var(--border); }
.mindmap-shell__cell--split > * { background: var(--bg); }
.mindmap-shell__source { display: flex; flex-direction: column; }
.mindmap-shell__error { padding: 6px 12px; font-size: 12px; background: var(--bg-elev); color: var(--text); border-block-end: 1px solid var(--border); }
.mindmap-shell__hint { font-size: 12px; color: var(--text-faint); }
.mindmap-shell__outline { overflow: auto; }
.mindmap-shell__outline :deep(:is(h1, h2, h3, h4, h5, h6, li, p)) { unicode-bidi: plaintext; text-align: start; }
</style>
