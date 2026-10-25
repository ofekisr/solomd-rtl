<script setup lang="ts">
import { useI18n } from '../i18n';

defineEmits<{ close: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="ai-working" role="status" aria-live="polite">
    <div class="ai-working__card">
      <button type="button" class="ai-working__close" :aria-label="t('mindmap.aiWorkingDismiss')" :title="t('mindmap.aiWorkingDismiss')" @click="$emit('close')">×</button>
      <span class="ai-working__icon" aria-hidden="true">⚠</span>
      <span class="ai-working__title">{{ t('mindmap.aiWorkingTitle') }}</span>
      <span class="ai-working__text">{{ t('mindmap.aiWorking') }}</span>
      <span class="ai-working__dots" aria-hidden="true"><i /><i /><i /></span>
    </div>
  </div>
</template>

<style scoped>
.ai-working { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: color-mix(in srgb, var(--bg) 55%, transparent); backdrop-filter: blur(2px); }
.ai-working__card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: min(520px, 100%); padding: 32px 48px; border-radius: 16px; text-align: center; color: var(--text); background: color-mix(in srgb, #f5a524 16%, var(--bg)); border: 2px solid #f5a524; box-shadow: 0 12px 40px rgb(0 0 0 / 0.25); }
.ai-working__icon { font-size: 56px; line-height: 1; color: #f5a524; animation: ai-working-pulse 1.2s ease-in-out infinite; }
.ai-working__title { font-size: 32px; font-weight: 800; letter-spacing: 0.02em; }
.ai-working__text { font-size: 16px; opacity: 0.85; }
.ai-working__dots { display: flex; gap: 8px; }
.ai-working__dots i { width: 10px; height: 10px; border-radius: 50%; background: #f5a524; animation: ai-working-pulse 1.2s ease-in-out infinite; }
.ai-working__dots i:nth-child(2) { animation-delay: 0.2s; }
.ai-working__dots i:nth-child(3) { animation-delay: 0.4s; }
.ai-working__close { position: absolute; inset-block-start: 8px; inset-inline-end: 10px; border: 0; background: none; color: inherit; opacity: 0.6; cursor: pointer; font-size: 26px; line-height: 1; padding: 4px 8px; }
.ai-working__close:hover { opacity: 1; }
@keyframes ai-working-pulse { 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) { .ai-working__icon, .ai-working__dots i { animation: none; } }
</style>
