<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import { useRagToggles } from '../../internal/useRagToggles.ts';

const { t } = useI18n();
const settings = useSettingsStore();
const { onToggleOutlineGlobal } = useRagToggles();
</script>

<template>
  <section data-cat="basics" data-page="basics/sidebar">
    <label>
      <input type="checkbox" :checked="settings.showOutline" @change="onToggleOutlineGlobal()" />
      {{ t('settings.showOutline') }}
    </label>
  </section>

  <section data-cat="basics" data-page="basics/sidebar">
    <label>{{ t('settings.outlineSide') }}</label>
    <select
      :value="settings.outlineSide"
      @change="settings.setOutlineSide(($event.target as HTMLSelectElement).value as 'left' | 'right')"
    >
      <option value="left">{{ t('settings.outlineSideLeft') }}</option>
      <option value="right">{{ t('settings.outlineSideRight') }}</option>
    </select>
  </section>

  <section data-cat="basics" data-page="basics/sidebar">
    <label>{{ t('settings.outlineMarker') }}</label>
    <select
      :value="settings.outlineMarker"
      @change="settings.setOutlineMarker(($event.target as HTMLSelectElement).value as 'jump' | 'number' | 'none')"
    >
      <option value="jump">{{ t('settings.outlineMarkerJump') }}</option>
      <option value="number">{{ t('settings.outlineMarkerNumber') }}</option>
      <option value="none">{{ t('settings.outlineMarkerNone') }}</option>
    </select>
  </section>

  <section data-cat="basics" data-page="basics/sidebar">
    <label>
      <input
        type="checkbox"
        :checked="settings.explorerFullNames"
        @change="settings.toggleExplorerFullNames()"
      />
      {{ t('settings.explorerFullNames') }}
    </label>
    <p class="setting-hint">{{ t('settings.explorerFullNamesHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/sidebar">
    <label>
      <input
        type="checkbox"
        :checked="settings.explorerDoubleClickFolders"
        @change="settings.toggleExplorerDoubleClickFolders()"
      />
      {{ t('settings.explorerDoubleClickFolders') }}
    </label>
    <p class="setting-hint">{{ t('settings.explorerDoubleClickFoldersHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/sidebar">
    <label>
      <input
        type="checkbox"
        :checked="settings.explorerFollowActive"
        @change="settings.toggleExplorerFollowActive()"
      />
      {{ t('settings.explorerFollowActive') }}
    </label>
    <p class="setting-hint">{{ t('settings.explorerFollowActiveHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/sidebar">
    <label>
      <input
        type="checkbox"
        :checked="settings.explorerShowHidden"
        @change="settings.toggleExplorerShowHidden()"
      />
      {{ t('settings.explorerShowHidden') }}
    </label>
    <p class="setting-hint">{{ t('settings.explorerShowHiddenHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/sidebar">
    <label>
      <input
        type="checkbox"
        :checked="settings.distinctSplitPanes"
        @change="settings.toggleDistinctSplitPanes()"
      />
      {{ t('settings.distinctSplitPanes') }}
    </label>
    <p class="setting-hint">{{ t('settings.distinctSplitPanesHint') }}</p>
  </section>

  <section data-cat="basics" data-page="basics/sidebar">
    <label>
      <input type="checkbox" :checked="settings.showFileTree" @change="settings.toggleFileTree()" />
      {{ t('settings.showFileTree') }}
    </label>
  </section>

  <section data-cat="basics" data-page="basics/sidebar">
    <label>
      <input type="checkbox" :checked="settings.showBacklinks" @change="settings.toggleBacklinks()" />
      {{ t('settings.showBacklinks') }}
    </label>
  </section>

  <section data-cat="basics" data-page="basics/sidebar">
    <label>
      <input type="checkbox" :checked="settings.showTagsPanel" @change="settings.toggleTagsPanel()" />
      {{ t('settings.showTagsPanel') }}
    </label>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
