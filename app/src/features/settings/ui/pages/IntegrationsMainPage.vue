<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import { IS_APP_STORE_BUILD } from '../../../../lib/app-build';
import { quickCaptureError } from '../../../../composables/useQuickCaptureStatus.ts';
import { useRagStore } from '../../../../stores/rag';
import { useWorkspaceStore } from '../../../../stores/workspace';
import { useRagToggles } from '../../internal/useRagToggles.ts';
import { useSettingsEnv } from '../../internal/settings-env.ts';
import AISettings from '../../../../components/settings/AISettings.vue';
import CaptureEndpointSettings from '../../../../components/settings/CaptureEndpointSettings.vue';
import CostMeterSettings from '../../../../components/settings/CostMeterSettings.vue';
import IntegrationsSettings from '../../../../components/settings/IntegrationsSettings.vue';
import RecipesSettings from '../../../../components/settings/RecipesSettings.vue';
import RestApiSettings from '../../../../components/settings/RestApiSettings.vue';

const { t } = useI18n();
const settings = useSettingsStore();
const workspace = useWorkspaceStore();
const rag = useRagStore();
const { gitBackend, isPhoneOrTablet } = useSettingsEnv();
const { onToggleRagEnabled, onReindexNow } = useRagToggles();
</script>

<template>
  <section data-cat="integrations" data-page="integrations/main">
    <h3 style="font-size: 13px; font-weight: 600; color: var(--text); margin: 18px 0 6px;">
      {{ t('rag.settingsHeading') }}
    </h3>
    <label>
      <input
        type="checkbox"
        :checked="settings.ragEnabled"
        @change="onToggleRagEnabled()"
      />
      {{ t('rag.enable') }}
    </label>
    <p style="font-size: 11px; color: var(--text-faint); margin: 4px 0 0; line-height: 1.5;">
      {{ t('rag.enableHint') }}
    </p>
    <div
      v-if="settings.ragEnabled && workspace.currentFolder"
      style="margin-top: 8px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;"
    >
      <span style="font-size: 11px; color: var(--text-muted);">
        <template v-if="rag.status?.ready">
          {{ t('rag.statusReady', {
            indexed: String(rag.status.indexed_files),
            total: String(rag.status.total_files),
            chunks: String(rag.status.total_chunks),
            backend: rag.status.backend,
          }) }}
        </template>
        <template v-else>
          {{ t('rag.statusEmpty') }}
        </template>
      </span>
      <button
        :disabled="rag.indexing"
        @click="onReindexNow"
        style="font-size: 11px; padding: 4px 10px;"
      >
        {{ rag.indexing ? t('rag.indexing') : t('rag.reindexNow') }}
      </button>
    </div>
  </section>

  <section v-if="!isPhoneOrTablet" data-cat="integrations" data-page="integrations/main">
    <label>
      <input
        type="checkbox"
        :checked="settings.quickCaptureEnabled"
        @change="settings.toggleQuickCapture()"
      />
      {{ t('settings.quickCapture') }}
    </label>
    <p class="setting-hint">{{ t('settings.quickCaptureHint') }}</p>
    <input
      type="text"
      :value="settings.quickCaptureShortcut"
      :disabled="!settings.quickCaptureEnabled"
      spellcheck="false"
      placeholder="CmdOrCtrl+Alt+M"
      @change="settings.setQuickCaptureShortcut(($event.target as HTMLInputElement).value)"
      style="margin-top: 6px; padding: 6px 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px; font: inherit; width: 100%;"
    />
    <p v-if="quickCaptureError" class="setting-hint" style="color: var(--danger);">
      {{ t('settings.quickCaptureFailed', { error: quickCaptureError }) }}
    </p>
  </section>

  <!-- App Store builds strip the AI / Agent / Recipes / CostMeter
       surface under Guideline 3.1.1 (BYOK API keys unlocking paid
       functionality). The GitHub Developer ID build keeps them. -->
  <div v-if="!IS_APP_STORE_BUILD" data-cat="integrations" data-page="integrations/main"><AISettings
    :enabled="settings.aiEnabled"
    :provider="(settings.aiProvider as any)"
    :model="settings.aiModel"
    :base-url="settings.aiBaseUrl"
    @update:enabled="settings.toggleAiEnabled()"
    @update:provider="(v: string) => settings.setAiProvider(v)"
    @update:model="(v: string) => settings.setAiModel(v)"
    @update:baseUrl="(v: string) => settings.setAiBaseUrl(v)"
  /></div>

  <!-- v4.0: BYOK cost meter — sits under AI so users see "your spend"
       right below "your provider key". -->
  <div v-if="!IS_APP_STORE_BUILD" data-cat="integrations" data-page="integrations/main"><CostMeterSettings /></div>

  <!-- v2.4: Integrations (CLI + MCP). -->
  <div data-cat="integrations" data-page="integrations/main"><IntegrationsSettings /></div>

  <!-- v4.0 Pillar 2: Agent Recipes. -->
  <!-- #230 — recipe_runner is desktop/iOS only (git-backed receipts). -->
  <div v-if="!IS_APP_STORE_BUILD && gitBackend" data-cat="integrations" data-page="integrations/main"><RecipesSettings /></div>

  <!-- v2.4 Integrations: HTTP capture endpoint. -->
  <div data-cat="integrations" data-page="integrations/main"><CaptureEndpointSettings /></div>

  <!-- v4.0: Public REST API for non-MCP clients. -->
  <div data-cat="integrations" data-page="integrations/main"><RestApiSettings /></div>
</template>

<style scoped src="../settings-page.css"></style>
