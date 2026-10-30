<script setup lang="ts">
import { inject, ref } from 'vue';
import { useI18n } from '../../../i18n';
import { useThemeStudio } from '../../../composables/useThemeStudio';
import { ALL_PAGE_KEYS, crumbsOf, defaultPage, isMultiPage, SETTINGS_NAV } from '../../../lib/settings-nav';
import ThemeMarketplace from '../../../components/ThemeMarketplace.vue';
import { DsModal } from '../../../ui';
import type { SettingsPanelProps } from '../internal/settings-panel-props.ts';
import { provideSettingsPanelContext } from '../internal/useSettingsPanelContext.ts';
import { useSearchShortcuts } from '../internal/useSearchShortcuts.ts';
import { useSettingsNavigation } from '../internal/useSettingsNavigation.ts';
import { useSettingsSearch } from '../internal/useSettingsSearch.ts';
import { SETTINGS_PAGES_KEY } from '../contracts/settings-pages.key.ts';

const props = defineProps<SettingsPanelProps>();
const emit = defineEmits<{ (e: 'close'): void }>();

const { t } = useI18n();
const settingsPages = inject(SETTINGS_PAGES_KEY);
if (!settingsPages) throw new Error('SettingsPanel: SETTINGS_PAGES_KEY is not provided; App.vue must provide it');
const MODAL_WIDTH = 'min(960px, 92vw)';

const bodyEl = ref<HTMLElement | null>(null);
const searchQuery = ref('');
const { activePage, activeCategory, openPage } = useSettingsNavigation(props, bodyEl, searchQuery);
const { searchInput, searching, searchHitCount, pagesWithHits } = useSettingsSearch(props, {
  bodyEl,
  searchQuery,
  activePage,
});
useSearchShortcuts(props, searchQuery, searchInput);

const { isDirty: themeDraftDirty } = useThemeStudio();
const themeMarketplaceOpen = ref(false);
provideSettingsPanelContext({
  close: () => emit('close'),
  openThemeMarketplace: () => {
    themeMarketplaceOpen.value = true;
  },
});
</script>

<template>
  <DsModal
    :model-value="open"
    :title="t('settings.title')"
    :width="MODAL_WIDTH"
    class="settings-modal"
    @update:model-value="emit('close')"
  >
      <div class="settings__frame">
      <div class="settings__search">
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="search"
          class="settings__search-input"
          :placeholder="t('settings.searchPlaceholder')"
          :aria-label="t('settings.searchPlaceholder')"
          spellcheck="false"
          autocomplete="off"
        />
        <span v-if="searching" class="settings__search-count">{{ t('settings.searchCount', { n: searchHitCount }) }}</span>
      </div>
      <div class="settings__layout">
        <nav class="settings__nav">
          <template v-for="c in SETTINGS_NAV" :key="c.id">
            <button
              class="settings__nav-item"
              :class="{ 'settings__nav-item--active': !searching && activeCategory === c.id }"
              :aria-expanded="isMultiPage(c.id) ? activeCategory === c.id : undefined"
              @click="openPage(defaultPage(c.id))"
            >
              <span class="settings__nav-icon">{{ c.icon }}</span>
              <span class="settings__nav-label">{{ t(c.labelKey) }}</span>
              <span v-if="c.id === 'theme' && themeDraftDirty" class="settings__nav-dot" :title="t('themeStudio.unsaved')">●</span>
            </button>
            <template v-if="isMultiPage(c.id) && activeCategory === c.id && !searching">
              <button
                v-for="p in c.pages"
                :key="p.id"
                class="settings__nav-item settings__nav-sub"
                :class="{ 'settings__nav-item--active': activePage === `${c.id}/${p.id}` }"
                @click="openPage(`${c.id}/${p.id}`)"
              >{{ t(p.labelKey) }}</button>
            </template>
          </template>
        </nav>
      <div
        ref="bodyEl"
        class="settings__body"
        :data-active-page="searching ? undefined : activePage"
        :data-searching="searching ? '' : undefined"
      >
        <template v-if="!searching">
          <h2 class="settings__crumb">
            {{ t(crumbsOf(activePage).categoryLabelKey) }}<template v-if="crumbsOf(activePage).pageLabelKey"> › {{ t(crumbsOf(activePage).pageLabelKey!) }}</template>
          </h2>
        </template>
        <template v-if="searching">
          <button
            v-for="(key, i) in ALL_PAGE_KEYS"
            v-show="pagesWithHits.has(key)"
            :key="'sg-' + key"
            type="button"
            class="settings__search-group"
            :style="{ order: i * 2 }"
            @click="openPage(key)"
          >{{ t(crumbsOf(key).categoryLabelKey) }}<template v-if="crumbsOf(key).pageLabelKey"> › {{ t(crumbsOf(key).pageLabelKey!) }}</template> ›</button>
          <p v-if="searchHitCount === 0" class="settings__search-empty">
            {{ t('settings.searchEmpty', { q: searchQuery.trim() }) }}
          </p>
        </template>
        <component :is="p.component" v-for="p in settingsPages" :key="p.key" />
      </div>
      </div>
      </div>
    <!-- v2.5: theme marketplace modal. Lives outside settings__body so it
         overlays the entire viewport; it self-teleports to body so closing
         settings (which unmounts DsModal) closes it too. -->
    <ThemeMarketplace
      :open="themeMarketplaceOpen"
      @close="themeMarketplaceOpen = false"
    />
  </DsModal>
</template>

<style scoped src="./settings-panel.css"></style>
