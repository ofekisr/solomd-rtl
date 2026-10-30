<script setup lang="ts">
import { DsButton, DsModal } from '../ui';
import { useI18n } from '../i18n';
import type { NumberingScope } from '../lib/mindmap/numbering';

defineProps<{ open: boolean; count: number }>();
const emit = defineEmits<{ choose: [scope: NumberingScope]; cancel: [] }>();
const { t } = useI18n();
</script>

<template>
  <DsModal :model-value="open" :title="t('mindmap.numberingTitle', { count })" width="360px" @update:model-value="(isOpen) => !isOpen && emit('cancel')">
    <div class="mm-numbering">
      <DsButton @click="emit('choose', 'children')">{{ t('mindmap.numberingChildren') }}</DsButton>
      <DsButton @click="emit('choose', 'selves')">{{ t('mindmap.numberingSelves') }}</DsButton>
      <DsButton variant="ghost" @click="emit('cancel')">{{ t('mindmap.numberingCancel') }}</DsButton>
    </div>
  </DsModal>
</template>

<style scoped>
.mm-numbering { display: flex; flex-direction: column; gap: 8px; }
</style>
