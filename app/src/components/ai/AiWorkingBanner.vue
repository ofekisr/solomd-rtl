<script setup lang="ts">
import { useI18n } from '../../i18n';

defineProps<{ minimized: boolean; alwaysMinimized: boolean }>();
defineEmits<{ minimize: []; keepForTab: []; always: []; expand: [] }>();
const { t } = useI18n();
</script>

<template>
  <div v-if="minimized" class="ai-strip" role="status" aria-live="polite">
    <span class="ai-strip__icon" aria-hidden="true">⚠</span>
    <span class="ai-strip__title">{{ t('aiWorking.title') }}</span>
    <span class="ai-strip__text">{{ t('aiWorking.text') }}</span>
    <span class="ai-working__dots" aria-hidden="true"><i /><i /><i /></span>
    <button type="button" class="ai-strip__expand" :title="t('aiWorking.expand')" :aria-label="t('aiWorking.expand')" @click="$emit('expand')">▴</button>
  </div>
  <div v-else class="ai-working" role="status" aria-live="polite">
    <div class="ai-working__card">
      <button type="button" class="ai-working__minimize" :aria-label="t('aiWorking.minimize')" :title="t('aiWorking.minimize')" @click="$emit('minimize')">−</button>
      <span class="ai-working__icon" aria-hidden="true">⚠</span>
      <span class="ai-working__title">{{ t('aiWorking.title') }}</span>
      <span class="ai-working__text">{{ t('aiWorking.text') }}</span>
      <span class="ai-working__dots" aria-hidden="true"><i /><i /><i /></span>
      <div class="ai-working__actions">
        <button type="button" @click="$emit('minimize')">{{ t('aiWorking.minimize') }}</button>
        <button type="button" @click="$emit('keepForTab')">{{ t('aiWorking.keepForTab') }}</button>
        <button v-if="!alwaysMinimized" type="button" @click="$emit('always')">{{ t('aiWorking.always') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-working { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: color-mix(in srgb, var(--bg) 55%, transparent); backdrop-filter: blur(2px); }
.ai-working__card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: min(560px, 100%); padding: 32px 48px; border-radius: 16px; text-align: center; color: var(--text); background: color-mix(in srgb, #f5a524 16%, var(--bg)); border: 2px solid #f5a524; box-shadow: 0 12px 40px rgb(0 0 0 / 0.25); }
.ai-working__icon { font-size: 56px; line-height: 1; color: #f5a524; animation: ai-working-pulse 1.2s ease-in-out infinite; }
.ai-working__title { font-size: 32px; font-weight: 800; letter-spacing: 0.02em; }
.ai-working__text { font-size: 16px; opacity: 0.85; }
.ai-working__dots { display: flex; gap: 8px; }
.ai-working__dots i { width: 10px; height: 10px; border-radius: 50%; background: #f5a524; animation: ai-working-pulse 1.2s ease-in-out infinite; }
.ai-working__dots i:nth-child(2) { animation-delay: 0.2s; }
.ai-working__dots i:nth-child(3) { animation-delay: 0.4s; }
.ai-working__minimize { position: absolute; inset-block-start: 8px; inset-inline-end: 10px; border: 0; background: none; color: inherit; opacity: 0.6; cursor: pointer; font-size: 28px; font-weight: 700; line-height: 1; padding: 4px 10px; }
.ai-working__minimize:hover { opacity: 1; }
.ai-working__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 4px; }
.ai-working__actions button { padding: 6px 12px; border-radius: 8px; border: 1px solid #f5a524; background: var(--bg); color: var(--text); cursor: pointer; font-size: 13px; }
.ai-working__actions button:hover { background: color-mix(in srgb, #f5a524 25%, var(--bg)); }
.ai-strip { display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding: 6px 12px; border-top: 2px solid #f5a524; color: var(--text); background: color-mix(in srgb, #f5a524 16%, var(--bg)); font-size: 13px; }
.ai-strip__icon { color: #f5a524; font-size: 16px; animation: ai-working-pulse 1.2s ease-in-out infinite; }
.ai-strip__title { font-weight: 700; }
.ai-strip__text { flex: 1; min-width: 0; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-strip .ai-working__dots i { width: 6px; height: 6px; }
.ai-strip__expand { border: 0; background: none; color: inherit; cursor: pointer; font-size: 16px; padding: 0 6px; opacity: 0.7; }
.ai-strip__expand:hover { opacity: 1; }
@keyframes ai-working-pulse { 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) { .ai-working__icon, .ai-strip__icon, .ai-working__dots i { animation: none; } }
</style>
