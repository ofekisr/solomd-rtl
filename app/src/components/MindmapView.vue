<script setup lang="ts">
import { computed } from 'vue';
import type { Tab } from '../types';
import { useI18n } from '../i18n';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { mmapCodec } from '../lib/mindmap-format';
import { useMindmapJump } from '../composables/useMindmapJump';
import type { MindmapSource } from '../lib/mindmap-source';
import MindmapCanvas from './MindmapCanvas.vue';

const props = defineProps<{ tab: Tab }>();
const tabs = useTabsStore();
const toasts = useToastsStore();
const { t } = useI18n();
const { jumpTo } = useMindmapJump();
const codec = computed(() => mmapCodec(props.tab.fileName));
const exportName = computed(() => props.tab.fileName.replace(/\.[^.]+$/u, ''));

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

function openAsText(): void {
  props.tab.language = 'plaintext';
}
</script>

<template>
  <MindmapCanvas :content="tab.content" :codec="codec" :export-name="exportName" @update:content="onUpdate" @open-as-text="openAsText" @jump-to-source="onJump" />
</template>
