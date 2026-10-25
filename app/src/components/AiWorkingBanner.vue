<script setup lang="ts">
import { useI18n } from '../i18n';

defineEmits<{ close: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="ai-working" role="status" aria-live="polite">
    <span class="ai-working__pulse" aria-hidden="true" />
    <span class="ai-working__text">⚠ {{ t('mindmap.aiWorking') }}</span>
    <button type="button" class="ai-working__close" :aria-label="t('mindmap.aiWorkingDismiss')" :title="t('mindmap.aiWorkingDismiss')" @click="$emit('close')">×</button>
  </div>
</template>

<style scoped>
.ai-working { display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 12px; background: color-mix(in srgb, #f5a524 18%, var(--bg)); color: var(--text); border-block-end: 1px solid color-mix(in srgb, #f5a524 45%, var(--border)); }
.ai-working__pulse { width: 8px; height: 8px; border-radius: 50%; background: #f5a524; animation: ai-working-pulse 1.2s ease-in-out infinite; }
.ai-working__text { flex: 1; font-weight: 600; }
.ai-working__close { border: 0; background: none; color: inherit; opacity: 0.6; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 4px; }
.ai-working__close:hover { opacity: 1; }
@keyframes ai-working-pulse { 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) { .ai-working__pulse { animation: none; } }
</style>
