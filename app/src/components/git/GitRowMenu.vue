<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from '../../i18n';

defineProps<{ x: number; y: number; canRollback: boolean }>();
const emit = defineEmits<{
  (e: 'show-diff'): void;
  (e: 'open-file'): void;
  (e: 'rollback'): void;
  (e: 'close'): void;
}>();
const { t } = useI18n();

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
      <button class="git-menu__item" role="menuitem" @click="emit('show-diff')">{{ t('git.showDiff') }}</button>
      <button class="git-menu__item" role="menuitem" @click="emit('open-file')">{{ t('git.openFile') }}</button>
      <button class="git-menu__item" role="menuitem" :disabled="!canRollback" @click="emit('rollback')">{{ t('git.rollback') }}</button>
    </div>
  </Teleport>
</template>
