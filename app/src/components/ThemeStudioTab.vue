<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import ThemeStudio from './ThemeStudio.vue';
import { nextPreviewTargetId, useThemeStudio } from '../composables/useThemeStudio';

const { acquirePreview } = useThemeStudio();
const previewTargetId = nextPreviewTargetId();
let releasePreview: (() => void) | null = null;
onMounted(() => { releasePreview = acquirePreview(); });
onUnmounted(() => releasePreview?.());
</script>

<template>
  <div class="studio-tab">
    <aside :id="previewTargetId" class="studio-tab__preview" />
    <main class="studio-tab__controls"><ThemeStudio :preview-target="previewTargetId" /></main>
  </div>
</template>

<style scoped>
.studio-tab {
  display: grid;
  grid-template-columns: minmax(280px, 2fr) 3fr;
  gap: var(--sp-4);
  height: 100%;
  padding: var(--sp-4);
  overflow: hidden;
  background: var(--bg);
}
.studio-tab__preview { overflow-y: auto; }
.studio-tab__controls { overflow-y: auto; min-width: 0; }
@media (max-width: 760px) {
  .studio-tab { grid-template-columns: 1fr; grid-template-rows: auto 1fr; overflow-y: auto; }
}
</style>
