<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

export interface GitMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
}

defineProps<{ x: number; y: number; items: GitMenuItem[] }>();
const emit = defineEmits<{ (e: 'select', id: string): void; (e: 'close'): void }>();

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close');
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <div class="git-menu__backdrop" @click="emit('close')" @contextmenu.prevent="emit('close')" />
    <div class="git-menu" role="menu" :style="{ insetInlineStart: x + 'px', insetBlockStart: y + 'px' }">
      <button
        v-for="item in items"
        :key="item.id"
        class="git-menu__item"
        role="menuitem"
        :disabled="item.disabled"
        dir="auto"
        @click="emit('select', item.id)"
      >{{ item.label }}</button>
    </div>
  </Teleport>
</template>
