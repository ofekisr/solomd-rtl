<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();
</script>

<template>
  <section data-cat="basics" data-page="basics/editor">
    <label>
      <input type="checkbox" :checked="settings.wordWrap" @change="settings.toggleWordWrap()" />
      {{ t('settings.wordWrap') }}
    </label>
  </section>

  <section data-cat="basics" data-page="basics/editor">
    <label>
      <input type="checkbox" :checked="settings.showLineNumbers" @change="settings.toggleLineNumbers()" />
      {{ t('settings.lineNumbers') }}
    </label>
  </section>

  <section data-cat="basics" data-page="basics/editor">
    <label>
      <input type="checkbox" :checked="settings.solidCursor" @change="settings.toggleSolidCursor()" />
      {{ t('settings.solidCursor') }}
    </label>
  </section>

  <section data-cat="basics" data-page="basics/editor">
    <label>
      <input type="checkbox" :checked="settings.livePreview" @change="settings.toggleLivePreview()" />
      {{ t('settings.livePreview') }}
    </label>
  </section>

  <section data-cat="basics" data-page="basics/editor">
    <label>
      <input type="checkbox" :checked="settings.alwaysShowMarkers" @change="settings.toggleAlwaysShowMarkers()" />
      {{ t('settings.alwaysShowMarkers') }}
    </label>
    <div class="hint">{{ t('settings.alwaysShowMarkersHint') }}</div>
  </section>

  <section data-cat="basics" data-page="basics/editor">
    <label>
      <input type="checkbox" :checked="settings.highlightCurrentLine" @change="settings.toggleHighlightCurrentLine()" />
      {{ t('settings.highlightCurrentLine') }}
    </label>
    <div class="hint">{{ t('settings.highlightCurrentLineHint') }}</div>
  </section>

  <section data-cat="basics" data-page="basics/editor">
    <label>
      <input type="checkbox" :checked="settings.limitEditorWidth" @change="settings.toggleLimitEditorWidth()" />
      {{ t('settings.limitEditorWidth') || 'Limit editor width (readable column)' }}
    </label>
  </section>

  <section data-cat="basics" data-page="basics/editor">
    <label>
      <input
        type="checkbox"
        :checked="settings.codeBlockLineNumbers"
        @change="settings.toggleCodeBlockLineNumbers()"
      />
      {{ t('settings.codeBlockLineNumbers') }}
    </label>
    <p class="setting-hint">{{ t('settings.codeBlockLineNumbersHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/editor">
    <label>
      <input
        type="checkbox"
        :checked="settings.foldingEnabled"
        @change="settings.toggleFolding()"
      />
      {{ t('settings.folding') }}
    </label>
    <p class="setting-hint">{{ t('settings.foldingHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/editor">
    <label>
      <input
        type="checkbox"
        :checked="settings.codeBlockWrap"
        @change="settings.toggleCodeBlockWrap()"
      />
      {{ t('settings.codeBlockWrap') }}
    </label>
    <p class="setting-hint">{{ t('settings.codeBlockWrapHint') }}</p>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
