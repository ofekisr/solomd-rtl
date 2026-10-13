<script setup lang="ts">
import { computed } from 'vue';
import { useSettingsStore } from '../stores/settings';
import type { MindmapIconName } from '../lib/mindmap-icon-names';
import { CLASSIC_GLYPHS, CLASSIC_PATHS, CLASSIC_VIEWBOX } from '../lib/mindmap-classic-icons';

export type { MindmapIconName };

const COMPACT_SIZE_PX = 16;
const CLASSIC_SIZE_PX = 18;
const props = defineProps<{ name: MindmapIconName }>();
const settings = useSettingsStore();
const isClassic = computed(() => settings.mindmapControlStyle === 'classic');
const classicPaths = computed(() => (isClassic.value ? CLASSIC_PATHS[props.name] ?? null : null));
const classicGlyph = computed(() => (isClassic.value && !classicPaths.value ? CLASSIC_GLYPHS[props.name] ?? null : null));

const PATHS: Readonly<Record<MindmapIconName, readonly string[]>> = {
  'lens-data': ['M8 4c-2 0-3 1-3 3v2c0 1.5-1 2.5-2 3 1 .5 2 1.5 2 3v2c0 2 1 3 3 3', 'M16 4c2 0 3 1 3 3v2c0 1.5 1 2.5 2 3-1 .5-2 1.5-2 3v2c0 2-1 3-3 3'],
  'lens-map': ['M4 12h5', 'M9 12c3 0 3-6 7-6h4', 'M9 12h11', 'M9 12c3 0 3 6 7 6h4'],
  'lens-doc': ['M5 6h14', 'M5 10h10', 'M5 14h14', 'M5 18h8'],
  'dir-left': ['M20 12h-6', 'M14 12c-3 0-3-6-7-6H4', 'M14 12H4', 'M14 12c-3 0-3 6-7 6H4'],
  'dir-right': ['M4 12h6', 'M10 12c3 0 3-6 7-6h3', 'M10 12h10', 'M10 12c3 0 3 6 7 6h3'],
  'dir-side': ['M10 12h4', 'M14 12c2 0 2-5 4-5h3', 'M14 12c2 0 2 5 4 5h3', 'M10 12c-2 0-2-5-4-5H3', 'M10 12c-2 0-2 5-4 5H3'],
  graph: ['M5 7h13l-3-3', 'M19 17H6l3 3'],
  lock: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  panel: ['M4 4h16v16H4z', 'M15 4v16'],
  undo: ['M9 7 4 12l5 5', 'M4 12h11a5 5 0 0 1 0 10h-2'],
  redo: ['M15 7l5 5-5 5', 'M20 12H9a5 5 0 0 0 0 10h2'],
  export: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  fullscreen: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  center: ['M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4', 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6'],
  'zoom-out': ['M5 12h14'],
  'zoom-in': ['M5 12h14', 'M12 5v14'],
  fit: ['M9 4H4v5', 'M15 20h5v-5', 'M4 4l6 6', 'M20 20l-6-6'],
  root: ['M4 11l8-7 8 7', 'M6 10v10h12V10'],
  pan: ['M8 12V6.5a1.5 1.5 0 0 1 3 0V11', 'M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5', 'M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L3.6 15a1.5 1.5 0 0 1 2.3-1.9L8 15V12'],
};

const paths = computed(() => PATHS[props.name]);
</script>

<template>
  <svg v-if="classicPaths" :width="CLASSIC_SIZE_PX" :height="CLASSIC_SIZE_PX" :viewBox="CLASSIC_VIEWBOX" fill="currentColor" aria-hidden="true">
    <path v-for="d in classicPaths" :key="d" :d="d" />
  </svg>
  <span v-else-if="classicGlyph" class="mm-icon-glyph" aria-hidden="true">{{ classicGlyph }}</span>
  <svg v-else :width="COMPACT_SIZE_PX" :height="COMPACT_SIZE_PX" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="d in paths" :key="d" :d="d" />
  </svg>
</template>

<style>
.mm-icon-glyph { display: inline-block; min-width: 18px; font-size: 16px; line-height: 18px; text-align: center; }
</style>
