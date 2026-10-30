<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import { MINDMAP_CONTROL_STYLES, type MindmapControlStyle } from '../../../../lib/mindmap/icon-names';
import { PASTE_MAP_SETTINGS, type PasteMapSetting } from '../../../../lib/mindmap/insert';
import MindmapMapFields from '../../../../components/MindmapMapFields.vue';

const { t } = useI18n();
const settings = useSettingsStore();
</script>

<template>
  <section data-cat="mindmap" data-page="mindmap/main">
    <label>{{ t('settings.mindmapControlStyle') }}</label>
    <select
      :value="settings.mindmapControlStyle"
      @change="settings.setMindmapControlStyle(($event.target as HTMLSelectElement).value as MindmapControlStyle)"
    >
      <option v-for="style in MINDMAP_CONTROL_STYLES" :key="style" :value="style">{{ t(`settings.mindmapControlStyle_${style}`) }}</option>
    </select>
  </section>

  <section data-cat="mindmap" data-page="mindmap/main">
    <label>{{ t('settings.mindmapPasteMapTarget') }}</label>
    <select
      :value="settings.mindmapPasteMapTarget"
      @change="settings.setMindmapPasteMapTarget(($event.target as HTMLSelectElement).value as PasteMapSetting)"
    >
      <option v-for="v in PASTE_MAP_SETTINGS" :key="v" :value="v">{{ t(`settings.mindmapPasteMapTarget_${v}`) }}</option>
    </select>
    <button type="button" :disabled="settings.mindmapPasteMapTarget === 'ask'" @click="settings.setMindmapPasteMapTarget('ask')">{{ t('settings.mindmapPasteMapReset') }}</button>
  </section>

  <section data-cat="mindmap" data-page="mindmap/main">
    <h4>{{ t('mindmap.settingsDefaults') }}</h4>
    <p class="setting-hint">{{ t('mindmap.settingsDefaultsHint') }}</p>
    <MindmapMapFields :value="settings.mindmapDefaults" @set="settings.setMindmapDefaults($event)" @clear="settings.clearMindmapDefault($event)" />
  </section>
</template>

<style scoped src="../settings-page.css"></style>
