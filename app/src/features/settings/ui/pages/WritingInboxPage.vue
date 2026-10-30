<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();
</script>

<template>
  <section data-cat="writing" data-page="writing/inbox">
    <label>{{ t('settings.dailyNotesFolder') }}</label>
    <input
      type="text"
      :value="settings.dailyNotesFolder"
      @input="settings.setDailyNotesFolder(($event.target as HTMLInputElement).value)"
      placeholder="Daily"
      style="padding: 6px 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px; font: inherit;"
    />
  </section>

  <section data-cat="writing" data-page="writing/inbox">
    <label>{{ t('settings.dailyNotesFormat') }}</label>
    <input
      type="text"
      :value="settings.dailyNotesFormat"
      @input="settings.setDailyNotesFormat(($event.target as HTMLInputElement).value)"
      placeholder="YYYY-MM-DD.md"
      style="padding: 6px 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px; font: inherit;"
    />
  </section>

  <!-- v4.6 F6 — Inbox workflow -->
  <section data-cat="writing" data-page="writing/inbox">
    <label>
      <input type="checkbox" :checked="settings.inboxWorkflowEnabled" @change="settings.toggleInboxWorkflow()" />
      {{ t('inbox.workflowSetting') }}
    </label>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('inbox.workflowSettingHint') }}
    </div>
    <label v-if="settings.inboxWorkflowEnabled" style="margin-top: 8px;">
      <input type="checkbox" :checked="settings.autoAdvanceInboxAfterOrganize" @change="settings.toggleAutoAdvanceInbox()" />
      {{ t('inbox.autoAdvanceSetting') }}
    </label>
    <div v-if="settings.inboxWorkflowEnabled" style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('inbox.autoAdvanceSettingHint') }}
    </div>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
