<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from '../i18n';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { MINDMAP_OPEN_EVENT, mindmapFenceCodec, replaceMindmapFence, type MindmapOpenDetail } from '../lib/mindmap-fence';

const MindmapCanvas = defineAsyncComponent(() => import('./MindmapCanvas.vue'));

interface CanvasHandle {
  flush: () => void;
}

const ESCAPE_KEY = 'Escape';
const TOPIC_EDITOR_ID = 'input-box';

const { t } = useI18n();
const tabs = useTabsStore();
const toasts = useToastsStore();
const target = ref<MindmapOpenDetail | null>(null);
const isStale = ref(false);
const canvas = ref<CanvasHandle | null>(null);

function onOpen(e: Event): void {
  const detail = (e as CustomEvent<MindmapOpenDetail>).detail;
  if (!detail) return;
  close();
  isStale.value = false;
  target.value = { ...detail };
}

function markStale(): void {
  isStale.value = true;
  toasts.error(t('mindmap.fenceStale'));
}

function onUpdate(nextBody: string): void {
  const current = target.value;
  const tab = current && tabs.tabs.find((x) => x.id === current.tabId);
  if (!current || !tab || isStale.value) return;
  const result = replaceMindmapFence(tab.content ?? '', current, nextBody);
  if (!result.ok) return markStale();
  target.value = { ...current, body: nextBody };
  if (result.source !== tab.content) tabs.setContent(current.tabId, result.source);
}

function close(): void {
  canvas.value?.flush();
  target.value = null;
}

function onKeydown(e: KeyboardEvent): void {
  if (!target.value || e.key !== ESCAPE_KEY) return;
  if (e.target instanceof HTMLElement && e.target.id === TOPIC_EDITOR_ID) return;
  e.preventDefault();
  close();
}

onMounted(() => {
  window.addEventListener(MINDMAP_OPEN_EVENT, onOpen);
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener(MINDMAP_OPEN_EVENT, onOpen);
  window.removeEventListener('keydown', onKeydown);
  close();
});
</script>

<template>
  <div v-if="target" class="mm-overlay">
    <div class="mm-overlay__bar">
      <span class="mm-overlay__title">{{ t('mindmap.fenceEditorTitle') }}</span>
      <button type="button" class="mm-overlay__close" @click="close">{{ t('mindmap.close') }}</button>
    </div>
    <div class="mm-overlay__surface">
      <MindmapCanvas
        ref="canvas"
        :key="`${target.tabId}:${target.index}`"
        :content="target.body"
        :codec="mindmapFenceCodec"
        @update:content="onUpdate"
        @open-as-text="close"
      />
    </div>
  </div>
</template>

<style scoped>
.mm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}
.mm-overlay__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-soft, var(--bg));
}
.mm-overlay__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.mm-overlay__close {
  appearance: none;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}
.mm-overlay__close:hover {
  background: var(--bg-hover, var(--bg-soft));
}
.mm-overlay__surface {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}
</style>
