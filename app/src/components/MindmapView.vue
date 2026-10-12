<script setup lang="ts">
import { computed } from 'vue';
import type { Tab } from '../types';
import { useTabsStore } from '../stores/tabs';
import { mmapCodec } from '../lib/mindmap-format';
import MindmapCanvas from './MindmapCanvas.vue';

const props = defineProps<{ tab: Tab }>();
const tabs = useTabsStore();
const codec = computed(() => mmapCodec(props.tab.fileName));
const exportName = computed(() => props.tab.fileName.replace(/\.[^.]+$/u, ''));

function onUpdate(text: string): void {
  tabs.setContent(props.tab.id, text);
}

function openAsText(): void {
  props.tab.language = 'plaintext';
}
</script>

<template>
  <MindmapCanvas :content="tab.content" :codec="codec" :export-name="exportName" @update:content="onUpdate" @open-as-text="openAsText" />
</template>
