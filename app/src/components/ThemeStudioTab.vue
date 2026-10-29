<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import ThemeStudio from './ThemeStudio.vue';
import { THEME_STUDIO_PREVIEW_ID, useThemeStudio } from '../composables/useThemeStudio';

const { studioOpen } = useThemeStudio();
onMounted(() => { studioOpen.value = true; });
onUnmounted(() => { studioOpen.value = false; });
</script>

<template>
  <div class="studio-tab">
    <aside :id="THEME_STUDIO_PREVIEW_ID" class="studio-tab__preview" />
    <main class="studio-tab__controls"><ThemeStudio /></main>
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
