<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();
</script>

<template>
  <section data-cat="basics" data-page="basics/preview">
    <label>
      <input type="checkbox" :checked="settings.previewFitWidth" @change="settings.togglePreviewFitWidth()" />
      {{ t('settings.previewFitWidth') }}
    </label>
  </section>

  <section data-cat="basics" data-page="basics/preview">
    <label>{{ t('settings.previewMaxWidth') }}: {{ settings.previewMaxWidth }}px</label>
    <input
      type="range"
      min="480"
      max="1600"
      step="20"
      :value="settings.previewMaxWidth"
      :disabled="settings.previewFitWidth"
      @input="settings.setPreviewMaxWidth(+($event.target as HTMLInputElement).value)"
    />
    <p class="setting-hint">{{ t('settings.previewMaxWidthHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/preview">
    <label>
      <input
        type="checkbox"
        :checked="settings.markdownHardBreaks"
        @change="settings.toggleMarkdownHardBreaks()"
      />
      {{ t('settings.markdownHardBreaks') }}
    </label>
    <p class="setting-hint">{{ t('settings.markdownHardBreaksHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/preview">
    <label>
      <input
        type="checkbox"
        :checked="settings.smartQuotes"
        @change="settings.toggleSmartQuotes()"
      />
      {{ t('settings.smartQuotes') }}
    </label>
    <p class="setting-hint">{{ t('settings.smartQuotesHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/preview">
    <label>
      <input
        type="checkbox"
        :checked="settings.markdownAutoNumberHeadings"
        @change="settings.toggleMarkdownAutoNumberHeadings()"
      />
      {{ t('settings.markdownAutoNumberHeadings') }}
    </label>
    <p class="setting-hint">{{ t('settings.markdownAutoNumberHeadingsHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/preview">
    <label>
      <input
        type="checkbox"
        :checked="settings.plantumlEnabled"
        @change="settings.togglePlantuml()"
      />
      {{ t('settings.plantuml') }}
    </label>
    <p class="setting-hint">{{ t('settings.plantumlHint') }}</p>
    <input
      v-if="settings.plantumlEnabled"
      type="text"
      :value="settings.plantumlServer"
      :placeholder="'https://www.plantuml.com/plantuml'"
      spellcheck="false"
      style="margin-top: 6px; width: 100%"
      @change="settings.setPlantumlServer(($event.target as HTMLInputElement).value)"
    />
  </section>

  <section data-cat="basics" data-page="basics/preview">
    <label>
      <input
        type="checkbox"
        :checked="settings.readingByDefaultOnMobile"
        @change="settings.toggleReadingByDefaultOnMobile()"
      />
      {{ t('reading.readingByDefaultOnMobile') }}
    </label>
    <p style="font-size: 11px; color: var(--text-faint); margin: 4px 0 0; line-height: 1.5;">{{ t('reading.readingByDefaultOnMobileHint') }}</p>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
