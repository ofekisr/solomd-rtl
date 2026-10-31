<script setup lang="ts">
import { useI18n } from '../../i18n';

defineProps<{ error: string }>();
const emit = defineEmits<{ 'switch-to-data': [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="mm-outline-invalid" role="alert">
    <p>{{ t('mindmap.outlineInvalid') }}</p>
    <pre>{{ error }}</pre>
    <button type="button" @click="emit('switch-to-data')">{{ t('mindmap.outlineSwitchToData') }}</button>
  </div>
</template>

<style scoped>
.mm-outline-invalid { padding: 24px; color: var(--text); }
.mm-outline-invalid pre { white-space: pre-wrap; color: var(--text-faint); }
.mm-outline-invalid button { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; }
</style>
