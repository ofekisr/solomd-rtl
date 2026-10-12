<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Tab, ViewMode } from '../types';
import { useSettingsStore } from '../stores/settings';
import { mmapCodec } from '../lib/mindmap-format';
import { cellHas, lensCell, resolveTabLens } from '../lib/mindmap-lens';
import { outlineMarkdownOf } from '../lib/mindmap-outline';
import type { MindmapCanvasApi } from '../lib/mindmap-active';
import { createMapDisplayApplier } from '../composables/useMindmapDisplay';
import MindmapCanvas from './MindmapCanvas.vue';
import Preview from './Preview.vue';

const READING_VIEW: ViewMode = 'reading';
const props = defineProps<{ tab: Tab }>();
const settings = useSettingsStore();
const codec = computed(() => mmapCodec(props.tab.fileName));
const isWideMap = computed(() => cellHas(lensCell(resolveTabLens(props.tab), READING_VIEW), 'wideMap'));
const outlineMarkdown = computed(() => (isWideMap.value ? '' : outlineMarkdownOf(codec.value.parse(props.tab.content))));
const canvas = ref<MindmapCanvasApi | null>(null);
const displayApplier = createMapDisplayApplier();

function applyDisplay(): void {
  const mind = canvas.value?.getMind();
  if (mind) displayApplier.apply(mind, canvas.value?.getDisplayOverride() ?? {}, settings.mindmapDefaults);
}

watch(() => settings.mindmapDefaults, applyDisplay, { deep: true });
</script>

<template>
  <MindmapCanvas
    v-if="isWideMap"
    ref="canvas"
    class="mindmap-reading__map"
    :content="tab.content"
    :codec="codec"
    :locked="true"
    :register-active="false"
    @ready="applyDisplay"
  />
  <Preview v-else :source="outlineMarkdown" skin="reading" class="mindmap-reading__outline" />
</template>

<style scoped>
.mindmap-reading__outline :deep(:is(h1, h2, h3, h4, h5, h6, li, p)) { unicode-bidi: plaintext; text-align: start; }
</style>
