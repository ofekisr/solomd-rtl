<script setup lang="ts">
import { useI18n } from '../../../i18n';
import { useTabsStore } from '../../../stores/tabs';
import { useSettingsStore } from '../../../stores/settings';
import { useToastsStore } from '../../../stores/toasts';
import { IS_APP_STORE_BUILD } from '../../../lib/app-build';
import { aiRewrite, cleanAI } from './toolbar-actions.ts';
import { useMeasureOnUpdate } from './useToolbarOverflow.ts';
import { useToolbarTips } from './useToolbarTips.ts';

const { t } = useI18n();
const { tip } = useToolbarTips();
const tabs = useTabsStore();
const settings = useSettingsStore();
const toasts = useToastsStore();
useMeasureOnUpdate();

function onCleanAI(): void {
  cleanAI(tabs, toasts);
}
function onAIRewrite(): void {
  aiRewrite({ tabs, toasts, isAiEnabled: settings.aiEnabled, keybindings: settings.keybindings });
}
</script>

<template>
  <div class="toolbar__group">
    <button
      class="icon-btn clean-ai-btn"
      @click="onCleanAI"
      v-bind:title="t('toolbar.cleanAiTitle')"
    >
      <span class="clean-ai-broom">🧹</span>
      <span class="clean-ai-label">AI</span>
    </button>
    <!-- #346: hidden until AI is switched on in Settings. With AI off, the
         button only ever answered "enable AI first". The command palette
         entry stays, and so does the setting. -->
    <button
      v-if="!IS_APP_STORE_BUILD && settings.aiEnabled"
      class="icon-btn ai-rewrite-btn"
      @mousedown.prevent
      @click="onAIRewrite"
      :title="tip('toolbar.aiRewriteTooltip', 'editor.aiRewrite')"
    >
      <span class="ai-rewrite-label">AI</span>
      <span class="ai-rewrite-spark">✨</span>
    </button>
  </div>
</template>

<style scoped src="./toolbar-controls.css"></style>
