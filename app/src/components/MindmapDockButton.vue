<script setup lang="ts">
import MindmapIcon, { type MindmapIconName } from './MindmapIcon.vue';

withDefaults(defineProps<{ icon: MindmapIconName; label: string; pressed?: boolean | null; disabled?: boolean }>(), { pressed: null, disabled: false });
const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <button type="button" class="mm-dock-btn" :title="label" :aria-label="label" :aria-pressed="pressed ?? undefined" :disabled="disabled" @click="emit('click')">
    <MindmapIcon :name="icon" />
  </button>
</template>
