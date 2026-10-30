<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import { useFontPicker } from '../../internal/useFontPicker.ts';

const { t } = useI18n();
const settings = useSettingsStore();
const { fontFamilies, customFontFamily, fontFamilySelectValue, onSelectFontFamily, onCustomFontInput } = useFontPicker();
</script>

<template>
  <section data-cat="basics" data-page="basics/fonts">
    <label>{{ t('settings.fontFamily') }}</label>
    <select :value="fontFamilySelectValue" @change="onSelectFontFamily(($event.target as HTMLSelectElement).value)">
      <option v-for="f in fontFamilies" :key="f.label" :value="f.value">{{ f.label }}</option>
      <option value="__custom__">{{ t('settings.customFont') }}</option>
    </select>
    <input
      v-if="fontFamilySelectValue === '__custom__'"
      type="text"
      :placeholder="t('settings.customFontPlaceholder')"
      :value="customFontFamily"
      @input="onCustomFontInput(($event.target as HTMLInputElement).value)"
      style="margin-top: 6px; padding: 6px 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px; font: inherit; width: 100%;"
    />
    <p class="setting-hint">{{ t('settings.fontFamilyHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/fonts">
    <label>{{ t('settings.codeFontFamily') }}</label>
    <input
      type="text"
      :placeholder="t('settings.codeFontFamilyPlaceholder')"
      :value="settings.codeFontFamily"
      @input="settings.setCodeFontFamily(($event.target as HTMLInputElement).value)"
      style="padding: 6px 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px; font: inherit; width: 100%;"
    />
    <p class="setting-hint">{{ t('settings.codeFontFamilyHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/fonts">
    <label>{{ t('settings.fontSize') }}: {{ settings.fontSize }}px</label>
    <input
      type="range"
      min="10"
      max="28"
      :value="settings.fontSize"
      @input="settings.setFontSize(+($event.target as HTMLInputElement).value)"
    />
  </section>
</template>

<style scoped src="../settings-page.css"></style>
