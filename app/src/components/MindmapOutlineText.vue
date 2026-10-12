<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../i18n';
import { outlineLines } from '../lib/mindmap-outline';

const props = defineProps<{ markdown: string }>();
const { t } = useI18n();
const lines = computed(() => outlineLines(props.markdown));
</script>

<template>
  <div class="mm-outline-text">
    <p class="mm-outline-text__note" role="note">{{ t('mindmap.outlineLocked') }}</p>
    <div class="mm-outline-text__body" role="textbox" aria-multiline="true" aria-readonly="true" tabindex="0">
      <div v-for="(line, index) in lines" :key="index" class="mm-outline-text__line" dir="auto">{{ line }}</div>
    </div>
  </div>
</template>

<style scoped>
.mm-outline-text { display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--bg); color: var(--text); }
.mm-outline-text__note { margin: 0; padding: 6px 12px; font-size: 12px; color: var(--text-faint); background: var(--bg-elev); border-block-end: 1px solid var(--border); }
.mm-outline-text__body { flex: 1; overflow: auto; padding: 12px 16px; font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; line-height: 1.6; }
.mm-outline-text__line { white-space: pre-wrap; min-height: 1.6em; unicode-bidi: plaintext; text-align: start; }
</style>
