<script setup lang="ts">
import { themeFamily } from '../lib/themes';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import FindBar from './FindBar.vue';
import { MindmapFindTarget, revealNode } from '../lib/mindmap-find';
import { MINDMAP_REVEAL_EVENT, claimMindmapReveal } from '../lib/mindmap-reveal';
import type { FindSpec } from '../lib/find-spec';
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
import MindmapRail, { type RailState } from './MindmapRail.vue';
import { MINDMAP_LAYOUT } from '../lib/mindmap-direction';
import { buildNodePatch, setIcon, type NodeField } from '../lib/mindmap-node-style';
import { runAsOneOperation, type OperationBus } from '../lib/mindmap-batch';
import { TAB_SOURCE_PREFIX } from '../lib/mindmap-workbench';
import MindmapCanvas from './MindmapCanvas.vue';
import MindmapSidePanel from './MindmapSidePanel.vue';
import MindmapNodeFields from './MindmapNodeFields.vue';
import MindmapDetailsPane from './MindmapDetailsPane.vue';
import { fieldsPatch, notePatch, type NodeFieldEntry } from '../lib/mindmap-node-fields';
import MindmapMapFields from './MindmapMapFields.vue';
import MindmapOutlineText from './MindmapOutlineText.vue';
import type { MapDisplay } from '../lib/mindmap-display';
import { createMapDisplayApplier } from '../composables/useMindmapDisplay';
import Editor from './Editor.vue';
import Preview from './Preview.vue';
import type { Snippet } from '../lib/mindmap-snippets';
import MindmapSnippets from './MindmapSnippets.vue';
import { hasAnyNote } from '../lib/mindmap-view-defaults';
import MindmapOutlineInvalid from './MindmapOutlineInvalid.vue';

const SOURCE_LANGUAGE = 'json';
const JSON_PARSE_DEBOUNCE_MS = 250;
const FLUSH_CONTENT_EVENT = 'solomd:flush-content-sync';
const TOGGLE_PANEL_ACTION = 'mindmap.togglePanel';
const TOGGLE_DETAILS_ACTION = 'mindmap.toggleDetails';
const TOGGLE_PIN_STRIP_ACTION = 'mindmap.togglePinStrip';
const TOGGLE_SNIPPETS_ACTION = 'mindmap.toggleSnippets';
const VIEW_ACTIONS: readonly string[] = [TOGGLE_PANEL_ACTION, TOGGLE_DETAILS_ACTION, TOGGLE_PIN_STRIP_ACTION, TOGGLE_SNIPPETS_ACTION];
const props = defineProps<{ tab: Tab }>();
const tabs = useTabsStore();
const toasts = useToastsStore();
const settings = useSettingsStore();
const { t } = useI18n();
const { jumpTo } = useMindmapJump();
const codec = computed(() => mmapCodec(props.tab.fileName));
const sourcePath = computed(() => props.tab.filePath ?? `${TAB_SOURCE_PREFIX}${props.tab.id}`);
const exportName = computed(() => props.tab.fileName.replace(/\.[^.]+$/u, ''));
const lens = computed<MindmapLens>(() => resolveTabLens(props.tab));
const parts = computed(() => lensCell(lens.value, settings.viewMode));
const canvas = ref<MindmapCanvasApi | null>(null);
const sourceError = ref<string | null>(null);
const selected = ref<NodeObj[]>([]);
const singleNode = computed(() => (selected.value.length === 1 ? selected.value[0] : null));
const BATCH_RESHAPE_OPERATION = 'reshapeNodes';

function has(part: CellPart): boolean {
  return cellHas(parts.value, part);
}

function partOrder(part: CellPart): number {
  return parts.value.indexOf(part);
}

const isSplit = computed(() => parts.value.length > 1);
const isPanelVisible = computed(() => has('map') && settings.mindmapPanelOpen);
const isDetailsVisible = computed(() => has('map') && hasCanvas.value && settings.mindmapDetailsOpen);
const hasCanvas = computed(() => has('map') && canvas.value?.hasMap !== false);
const parseSource = ref(props.tab.content);
let parseTimer: number | null = null;

watch(() => props.tab.content, (content) => {
  if (parseTimer !== null) window.clearTimeout(parseTimer);
  parseTimer = null;
  if (!has('json')) {
    parseSource.value = content;
    return;
  }
  parseTimer = window.setTimeout(() => { parseSource.value = content; }, JSON_PARSE_DEBOUNCE_MS);
});

const parsedContent = computed(() => codec.value.parse(parseSource.value));
const outlineError = computed(() => (parsedContent.value.ok ? null : parsedContent.value.error));
const outlineText = computed(() => (has('outlineText') ? outlineMarkdownOf(parsedContent.value, 'source') : ''));
const outlinePreview = computed(() => (has('outlinePreview') ? outlineMarkdownOf(parsedContent.value, 'rendered') : ''));
const lastValidContent = ref('');
const liveJsonError = computed<string | null>(() => {
  if (!has('json') || !has('map') || parsedContent.value.ok) return null;
  return parsedContent.value.error;
});
const isMapLocked = computed(() => liveJsonError.value !== null);
const railState = computed<RailState>(() => ({
  lens: lens.value,
  hasCanvas: hasCanvas.value,
  direction: canvas.value?.direction ?? MINDMAP_LAYOUT.SIDE,
  isPanelOpen: settings.mindmapPanelOpen,
  isDetailsOpen: settings.mindmapDetailsOpen,
  isReadOnly: canvas.value?.isReadOnly ?? false,
  isPinStripOpen: settings.mindmapPinStripOpen,
  isSnippetsOpen: settings.mindmapSnippetsOpen,
  isLocked: isMapLocked.value,
  isFocused: canvas.value?.isFocused ?? false,
}));
const isPanelEditable = computed(() => !(canvas.value?.isReadOnly || isMapLocked.value) && canvas.value?.hasMap === true);
const LIVE_EDIT_VIEW: ViewMode = 'liveEdit';
const snippets = ref<Snippet[]>([]);
const canEditSnippets = computed(() => settings.viewMode === LIVE_EDIT_VIEW && isPanelEditable.value);

function setSnippets(next: Snippet[]): void {
  if (!canEditSnippets.value) return;
  snippets.value = next;
  canvas.value?.setSnippets(next);
}
const jsonError = computed(() => sourceError.value ?? liveJsonError.value);
const mapContent = computed(() => (has('json') ? lastValidContent.value : props.tab.content));

watch(parsedContent, (parsed) => {
  if (!parsed.ok) return;
  lastValidContent.value = parseSource.value;
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
  parseSource.value = props.tab.content;
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

type PatchValue = string | number | boolean | readonly string[] | null;

function applyNodePatch(field: NodeField, value: PatchValue): void {
  patchSelected((node) => buildNodePatch(node, field, value));
}

function applyNodeIcon(icon: string, isOn: boolean): void {
  patchSelected((node) => buildNodePatch(node, 'icons', setIcon(node.icons, icon, isOn)));
}

function patchSelected(build: (node: NodeObj) => ReturnType<typeof buildNodePatch>): void {
  const mind = canvas.value?.getMind();
  if (!mind || selected.value.length === 0 || !isPanelEditable.value) return;
  const elements = selected.value.map((node) => findLiveElement(mind, node.id)).filter((el): el is Topic => el !== null);
  const results = elements.map((el) => build(el.nodeObj));
  if (results.some((r) => !r.ok)) {
    toasts.error(t('mindmap.fieldInvalid'));
    return;
  }
  runAsOneOperation(mind.bus as unknown as OperationBus, () => reshapeAll(mind, elements, results), { name: BATCH_RESHAPE_OPERATION, obj: elements[0]?.nodeObj, objs: elements.map((el) => el.nodeObj) });
  selected.value = elements.map((el) => ({ ...el.nodeObj }));
}

function reshapeAll(mind: MindElixirInstance, elements: readonly Topic[], results: ReturnType<typeof buildNodePatch>[]): boolean {
  elements.forEach((el, i) => { const r = results[i]; if (r.ok) mind.reshapeNode(el, r.patch); });
  return elements.length > 0;
}

function patchNodeById(id: string, patch: Partial<NodeObj>): void {
  const mind = canvas.value?.getMind();
  if (!mind || !isPanelEditable.value) return;
  const element = findLiveElement(mind, id);
  if (!element) {
    if (singleNode.value?.id === id) selected.value = [];
    return;
  }
  mind.reshapeNode(element, patch);
  if (singleNode.value?.id === id) selected.value = [{ ...element.nodeObj }];
}

function onDetailsNote(id: string, text: string): void {
  const node = findLiveElement(canvas.value?.getMind() ?? null, id)?.nodeObj;
  if (node && (node.note ?? '') !== text) patchNodeById(id, notePatch(text));
}

function onDetailsFields(id: string, entries: NodeFieldEntry[]): void {
  const node = findLiveElement(canvas.value?.getMind() ?? null, id)?.nodeObj;
  if (node) patchNodeById(id, fieldsPatch(node, entries));
}

function showDetails(): void {
  if (!settings.mindmapDetailsOpen) settings.toggleMindmapDetails();
}

function findLiveElement(mind: MindElixirInstance | null, id: string): Topic | null {
  if (!mind) return null;
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
  canvas.value?.refreshFrameStyle();
}

let viewDefaultsAppliedFor: string | null = null;

function applyViewDefaultsOnce(): void {
  const mind = canvas.value?.getMind();
  if (!mind || viewDefaultsAppliedFor === props.tab.id) return;
  viewDefaultsAppliedFor = props.tab.id;
  settings.setMindmapPanelOpen(false);
  settings.setMindmapDetailsOpen(hasAnyNote(mind.nodeData));
  settings.setMindmapSnippetsOpen((canvas.value?.getSnippets() ?? []).length > 0);
}

function onCanvasReady(): void {
  snippets.value = [...(canvas.value?.getSnippets() ?? [])];
  applyViewDefaultsOnce();
  displayOverride.value = canvas.value?.getDisplayOverride() ?? {};
  applyDisplay();
  revealPending();
}

function revealPending(): void {
  const mind = canvas.value?.getMind();
  if (!mind) return;
  const id = claimMindmapReveal(props.tab.filePath);
  if (id) revealNode(mind, id);
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
  if (actionId === TOGGLE_DETAILS_ACTION) {
    settings.toggleMindmapDetails();
    return true;
  }
  if (actionId === TOGGLE_PIN_STRIP_ACTION) {
    settings.toggleMindmapPinStrip();
    return true;
  }
  if (actionId === TOGGLE_SNIPPETS_ACTION) {
    settings.toggleMindmapSnippets();
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
  if ((e.target as HTMLElement | null)?.closest?.('.fb')) return;
  const combo = eventToCombo(e);
  const actionId = combo ? resolveBindings(settings.keybindings, 'mindmap').get(combo) : undefined;
  if (!actionId || !(isLensAction(actionId) || VIEW_ACTIONS.includes(actionId))) return;
  e.preventDefault();
  e.stopPropagation();
  runViewAction(actionId);
}

function onUpdate(text: string): void {
  tabs.setContent(props.tab.id, text);
  refreshFind();
}

const EMPTY_FIND: FindSpec = { search: '', replace: '', caseSensitive: false, regexp: false };
const findOpen = ref(false);
const findExternal = shallowRef<FindSpec>(EMPTY_FIND);
const findTick = shallowRef(0);
const findBar = ref<InstanceType<typeof FindBar> | null>(null);
const findTarget = new MindmapFindTarget({
  getMind: () => canvas.value?.getMind() ?? null,
  canEdit: () => isPanelEditable.value,
  markChanged: () => canvas.value?.markChanged(),
  close: () => {
    findOpen.value = false;
  },
});

function refreshFind(): void {
  if (!findOpen.value) return;
  findTick.value++;
  nextTick(() => findTarget.refresh());
}

/** ⌘F in a map tab searches node text. Inside the JSON source split, the
 *  source editor's own find bar handles it instead. */
function openFind(): void {
  if (document.activeElement?.closest('.mindmap-shell__source') || !has('map')) return;
  if (findOpen.value) {
    findBar.value?.focus();
    return;
  }
  const topic = singleNode.value?.topic;
  if (topic && !topic.includes('\n')) findExternal.value = { ...EMPTY_FIND, search: topic };
  findOpen.value = true;
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
  window.addEventListener(MINDMAP_REVEAL_EVENT, revealPending);
  migrateLegacyMode();
  removeViewGuard = addViewModeGuard(guardViewChange);
  activate();
});
onBeforeUnmount(() => {
  window.removeEventListener(MINDMAP_REVEAL_EVENT, revealPending);
  if (parseTimer !== null) window.clearTimeout(parseTimer);
  removeViewGuard?.();
  clearActiveMindmap(handle);
});
defineExpose({ setLens, canvas, lens, openFind });
</script>

<template>
  <div class="mindmap-shell" @keydown.capture="onViewKey" @focusin="activate" @pointerdown="activate">
    <div class="mindmap-shell__body">
      <MindmapRail v-if="!hasCanvas" :state="railState" @set-lens="setLens" @run="(id) => handle.run(id)" @toggle-panel="settings.toggleMindmapPanel()" />
      <div class="mindmap-shell__cell" :class="{ 'mindmap-shell__cell--split': isSplit }">
        <div v-if="has('json')" class="mindmap-shell__source" :style="{ order: partOrder('json') }">
          <div v-if="jsonError" class="mindmap-shell__error" role="alert">{{ jsonError }}</div>
          <Editor :key="`${tab.id}-source`" :tab="sourceTab" />
        </div>
        <div v-if="has('map')" class="mindmap-shell__map" :style="{ order: partOrder('map') }">
          <FindBar
            v-if="findOpen"
            ref="findBar"
            class="mindmap-shell__find"
            :target="findTarget"
            :external="findExternal"
            :tick="findTick"
            :get-file-path="() => tab.filePath"
          />
          <MindmapCanvas
            ref="canvas"
            class="mindmap-shell__canvas"
            :content="mapContent"
            :codec="codec"
            :export-name="exportName"
            :source-path="sourcePath"
            :source-label="exportName"
            :register-active="false"
            :locked="isMapLocked"
            :focus-key="tab.id"
            @update:content="onUpdate"
            @selection="(nodes) => { selected = nodes.map((n) => ({ ...n })); refreshFind(); }"
            @open-as-text="openAsText"
            @jump-to-source="onJump"
            @ready="onCanvasReady"
            @show-details="showDetails"
          >
            <template #rail>
              <MindmapRail :state="railState" @set-lens="setLens" @run="(id) => handle.run(id)" @toggle-panel="settings.toggleMindmapPanel()" />
            </template>
          </MindmapCanvas>
          <MindmapSnippets v-if="canvas?.hasMap !== false && settings.mindmapSnippetsOpen" :snippets="snippets" :editable="canEditSnippets" @change="setSnippets" />
          <MindmapDetailsPane
            v-if="isDetailsVisible"
            :node="singleNode"
            :disabled="!isPanelEditable"
            :height="settings.mindmapDetailsHeight"
            @note="onDetailsNote"
            @fields="onDetailsFields"
            @resize="settings.setMindmapDetailsHeight"
            @close="settings.toggleMindmapDetails()"
          />
        </div>
        <template v-if="has('outlineText')">
          <MindmapOutlineInvalid v-if="outlineError !== null" :error="outlineError" :style="{ order: partOrder('outlineText') }" @switch-to-data="openAsText" />
          <MindmapOutlineText v-else :markdown="outlineText" :style="{ order: partOrder('outlineText') }" />
        </template>
        <template v-if="has('outlinePreview')">
          <MindmapOutlineInvalid v-if="outlineError !== null" :error="outlineError" :style="{ order: partOrder('outlinePreview') }" @switch-to-data="openAsText" />
          <Preview v-else :source="outlinePreview" class="mindmap-shell__outline" :style="{ order: partOrder('outlinePreview') }" />
        </template>
      </div>
      <MindmapSidePanel v-if="isPanelVisible" :has-single-node="selected.length > 0">
        <template #node>
          <p v-if="!isPanelEditable" class="mindmap-shell__hint">{{ t('mindmap.panelReadOnly') }}</p>
          <MindmapNodeFields v-if="selected.length > 0" :nodes="selected" :disabled="!isPanelEditable" @patch="applyNodePatch" @icon="applyNodeIcon" />
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
.mindmap-shell__map { display: flex; flex-direction: column; min-height: 0; }
.mindmap-shell__find { flex: none; }
:global(.me-find-hit) { outline: 2px solid var(--accent, #ff9f40); outline-offset: 2px; }
.mindmap-shell__canvas { flex: 1; min-height: 0; }
.mindmap-shell__source { display: flex; flex-direction: column; }
.mindmap-shell__error { padding: 6px 12px; font-size: 12px; background: var(--bg-elev); color: var(--text); border-block-end: 1px solid var(--border); }
.mindmap-shell__hint { font-size: 12px; color: var(--text-faint); }
.mindmap-shell__outline { overflow: auto; }
.mindmap-shell__outline :deep(:is(h1, h2, h3, h4, h5, h6, li, p)) { unicode-bidi: plaintext; text-align: start; }
</style>
