<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
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
import MindmapCanvas from './MindmapCanvas.vue';
import Editor from './Editor.vue';
import Preview from './Preview.vue';

const SOURCE_LANGUAGE = 'json';
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

function runViewAction(actionId: string): boolean {
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
  if (!actionId || !(actionId in VIEW_ACTIONS)) return;
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
    <div class="mindmap-shell__body">
      <MindmapCanvas
        v-if="mode === 'map'"
        ref="canvas"
        :content="tab.content"
        :codec="codec"
        :export-name="exportName"
        :register-active="false"
        @update:content="onUpdate"
        @open-as-text="setMode('source')"
        @jump-to-source="onJump"
      />
      <div v-else-if="mode === 'source'" class="mindmap-shell__source">
        <div v-if="sourceError" class="mindmap-shell__error" role="alert">{{ sourceError }}</div>
        <Editor :key="`${tab.id}-source`" :tab="sourceTab" />
      </div>
      <Preview v-else :source="outlineMarkdown" class="mindmap-shell__outline" />
    </div>
  </div>
</template>

<style scoped>
.mindmap-shell { display: flex; flex-direction: column; width: 100%; height: 100%; }
.mindmap-shell__body { position: relative; flex: 1; min-height: 0; display: flex; }
.mindmap-shell__body > * { flex: 1; min-width: 0; }
.mindmap-shell__source { display: flex; flex-direction: column; }
.mindmap-shell__error { padding: 6px 12px; font-size: 12px; background: var(--bg-secondary, #fee); border-block-end: 1px solid var(--border, #ccc); }
.mindmap-shell__outline { overflow: auto; }
</style>
