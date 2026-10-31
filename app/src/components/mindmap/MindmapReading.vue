<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Tab, ViewMode } from '../../types';
import { useSettingsStore } from '../../stores/settings';
import { useThemeStore } from '../../stores/theme';
import { useTabsStore } from '../../stores/tabs';
import { mmapCodec } from '../../lib/mindmap/format';
import { cellHas, lensCell, resolveTabLens } from '../../lib/mindmap/lens';
import { outlineMarkdownOf } from '../../lib/mindmap/outline';
import type { MindmapCanvasApi } from '../../lib/mindmap/active';
import { createMapDisplayApplier } from '../../composables/mindmap/useMindmapDisplay';
import MindmapCanvas from './MindmapCanvas.vue';
import Preview from '../preview/Preview.vue';
import MindmapSnippets from './MindmapSnippets.vue';
import MindmapOutlineInvalid from './MindmapOutlineInvalid.vue';

const READING_VIEW: ViewMode = 'reading';
const props = defineProps<{ tab: Tab }>();
const settings = useSettingsStore();
const themeStore = useThemeStore();
const tabs = useTabsStore();
const codec = computed(() => mmapCodec(props.tab.fileName));
const isWideMap = computed(() => cellHas(lensCell(resolveTabLens(props.tab), READING_VIEW), 'wideMap'));
const parsedContent = computed(() => codec.value.parse(props.tab.content));
const outlineError = computed(() => (parsedContent.value.ok ? null : parsedContent.value.error));
const outlineMarkdown = computed(() => (isWideMap.value ? '' : outlineMarkdownOf(parsedContent.value, 'rendered')));
const readingSnippets = computed(() => (parsedContent.value.ok ? parsedContent.value.snippets : []));
const canvas = ref<MindmapCanvasApi | null>(null);
const displayApplier = createMapDisplayApplier();

function applyDisplay(): void {
  const mind = canvas.value?.getMind();
  if (mind) displayApplier.apply(mind, canvas.value?.getDisplayOverride() ?? {}, settings.mindmapDefaults, themeStore.mode);
}

watch(() => settings.mindmapDefaults, applyDisplay, { deep: true });

function switchToData(): void {
  props.tab.mindmapLens = 'data';
  tabs.persist();
  settings.setViewMode('edit');
}
</script>

<template>
  <div v-if="isWideMap" class="mindmap-reading__wide">
    <MindmapCanvas
      ref="canvas"
      class="mindmap-reading__map"
      :content="tab.content"
      :codec="codec"
      :locked="true"
      :register-active="false"
      @open-as-text="switchToData"
      @ready="applyDisplay"
    />
    <MindmapSnippets :snippets="readingSnippets" :editable="false" />
  </div>
  <MindmapOutlineInvalid v-else-if="outlineError !== null" :error="outlineError" @switch-to-data="switchToData" />
  <Preview v-else :source="outlineMarkdown" skin="reading" class="mindmap-reading__outline" />
</template>

<style scoped>
.mindmap-reading__wide { flex: 1; min-width: 0; display: flex; flex-direction: column; height: 100%; }
.mindmap-reading__map { flex: 1; min-height: 0; }
.mindmap-reading__outline :deep(:is(h1, h2, h3, h4, h5, h6, li, p)) { unicode-bidi: plaintext; text-align: start; }
</style>
