<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import { AI_DELAY_LIMITS } from '../../../../lib/ai-activity';
import { useSettingsEnv } from '../../internal/settings-env.ts';
import { useUpdateCheck } from '../../internal/useUpdateCheck.ts';

const { t } = useI18n();
const settings = useSettingsStore();
const { isMobilePlatform, masBuild } = useSettingsEnv();
const { checkingUpdate, manualCheckUpdate } = useUpdateCheck();
</script>

<template>
  <section data-cat="advanced" data-page="advanced/updates">
    <label>
      <input type="checkbox" :checked="settings.aiWarningAlwaysMinimized" @change="settings.setAiWarningAlwaysMinimized(($event.target as HTMLInputElement).checked)" />
      {{ t('settings.aiWarningAlwaysMinimized') }}
    </label>
    <label style="margin-top: 6px;">
      {{ t('settings.aiReleaseDelay') }}
      <input
        type="number"
        :min="AI_DELAY_LIMITS.releaseDelayMs.min"
        :max="AI_DELAY_LIMITS.releaseDelayMs.max"
        step="500"
        style="width: 90px;"
        :value="settings.aiReleaseDelayMs"
        @change="settings.setAiReleaseDelayMs(Number(($event.target as HTMLInputElement).value))"
      />
      ms
    </label>
    <label style="margin-top: 6px;">
      {{ t('settings.aiStaleTimeout') }}
      <input
        type="number"
        :min="AI_DELAY_LIMITS.staleMs.min"
        :max="AI_DELAY_LIMITS.staleMs.max"
        step="5000"
        style="width: 90px;"
        :value="settings.aiStaleTimeoutMs"
        @change="settings.setAiStaleTimeoutMs(Number(($event.target as HTMLInputElement).value))"
      />
      ms
    </label>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('settings.aiWorkingHint') }}
    </div>
  </section>

  <section v-if="!isMobilePlatform && !masBuild" data-cat="advanced" data-page="advanced/updates">
    <label>
      <input type="checkbox" :checked="settings.autoCheckUpdate" @change="settings.toggleAutoCheckUpdate()" />
      {{ t('settings.autoCheckUpdate') }}
    </label>
    <div class="row" style="gap: 8px; align-items: center; margin-top: 8px;">
      <button :disabled="checkingUpdate" @click="manualCheckUpdate">
        {{ checkingUpdate ? t('settings.checkingUpdate') : t('settings.checkUpdate') }}
      </button>
    </div>
  </section>

  <section data-cat="advanced" data-page="advanced/updates">
    <label>
      <input type="checkbox" :checked="settings.telemetryEnabled" @change="settings.toggleTelemetry()" />
      {{ t('settings.telemetry') }}
    </label>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('settings.telemetryHint') }}
    </div>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
