<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from '../i18n';
import type { PasteMapTarget } from '../lib/mindmap/insert';

const emit = defineEmits<{ choose: [target: PasteMapTarget, remember: boolean]; cancel: [] }>();
const { t } = useI18n();
const remember = ref(false);
const primary = ref<HTMLButtonElement | null>(null);

onMounted(() => primary.value?.focus());
</script>

<template>
  <div class="mindmap-paste-target__overlay" @click.self="emit('cancel')" @keydown.esc.prevent="emit('cancel')">
    <div class="mindmap-paste-target" role="dialog" aria-modal="true" :aria-label="t('mindmap.pasteMapTitle')">
      <h3>{{ t('mindmap.pasteMapTitle') }}</h3>
      <button ref="primary" type="button" class="primary" @click="emit('choose', 'selected', remember)">{{ t('mindmap.pasteMapIntoSelected') }}</button>
      <button type="button" @click="emit('choose', 'root', remember)">{{ t('mindmap.pasteMapIntoRoot') }}</button>
      <label><input v-model="remember" type="checkbox" /> {{ t('mindmap.pasteMapRemember') }}</label>
    </div>
  </div>
</template>

<style scoped>
.mindmap-paste-target__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 0.35);
}
.mindmap-paste-target {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 260px;
  padding: 16px;
  border-radius: 8px;
  background: var(--bg, #fff);
  color: var(--text, #222);
  border: 1px solid var(--border, rgb(0 0 0 / 0.12));
}
h3 { margin: 0 0 4px; font-size: 14px; }
button {
  padding: 6px 10px;
  border: 1px solid var(--border, rgb(0 0 0 / 0.2));
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
button.primary { background: var(--accent, #3b82f6); color: #fff; border-color: transparent; }
label { display: flex; align-items: center; gap: 6px; font-size: 12px; }
</style>
