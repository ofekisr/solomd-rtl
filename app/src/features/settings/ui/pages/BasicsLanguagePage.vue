<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();
</script>

<template>
  <section data-cat="basics" data-page="basics/language">
    <label>{{ t('settings.language') }}</label>
    <select
      :value="settings.language"
      @change="settings.setLanguage(($event.target as HTMLSelectElement).value as 'en' | 'ja' | 'ko' | 'de' | 'fr' | 'es' | 'pt' | 'it' | 'pl' | 'nl' | 'tr' | 'sv' | 'uk' | 'ru')"
    >
      <option value="en">English</option>
      <option value="ja">日本語</option>
      <option value="ko">한국어</option>
      <option value="de">Deutsch</option>
      <option value="fr">Français</option>
      <option value="es">Español</option>
      <option value="pt">Português</option>
      <option value="it">Italiano</option>
      <option value="pl">Polski</option>
      <option value="nl">Nederlands</option>
      <option value="tr">Türkçe</option>
      <option value="sv">Svenska</option>
      <option value="uk">Українська</option>
      <option value="ru">Русский</option>
    </select>
  </section>

  <section data-cat="basics" data-page="basics/language">
    <label>{{ t('settings.uiFontSize') }}: {{ settings.uiFontSize }}px</label>
    <input
      type="range"
      min="10"
      max="20"
      :value="settings.uiFontSize"
      @input="settings.setUiFontSize(+($event.target as HTMLInputElement).value)"
    />
  </section>

  <section data-cat="basics" data-page="basics/language">
    <label>
      {{ t('settings.globalZoom') }}:
      {{ Math.round((settings.globalZoom || 1) * 100) }}%
    </label>
    <input
      type="range"
      min="0.75"
      max="2.5"
      step="0.05"
      :value="settings.globalZoom"
      @input="settings.setGlobalZoom(+($event.target as HTMLInputElement).value)"
    />
    <p class="setting-hint">
      {{ t('settings.globalZoomHint') }}
      <button
        type="button"
        class="link-button"
        style="margin-left: 8px;"
        @click="settings.resetZoom()"
      >
        {{ t('settings.globalZoomReset') }}
      </button>
    </p>
    <label>
      <input
        type="checkbox"
        :checked="settings.wheelZoomEnabled"
        @change="settings.toggleWheelZoom()"
      />
      {{ t('settings.wheelZoom') }}
    </label>
    <p class="setting-hint">{{ t('settings.wheelZoomHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/language">
    <label>
      <input
        type="checkbox"
        :checked="settings.showStatusBarViewModes"
        @change="settings.toggleStatusBarViewModes()"
      />
      {{ t('settings.showStatusBarViewModes') }}
    </label>
    <p class="setting-hint">{{ t('settings.showStatusBarViewModesHint') }}</p>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
