<script setup lang="ts">
import { useI18n } from '../../../i18n';
import { TREE_SORT_MODES, type TreeSortMode } from '../../../lib/tree-sort';

defineProps<{
  hasRoot: boolean;
  hasWorkspace: boolean;
  localVault: boolean;
  extFilter: string[];
  extList: { ext: string; count: number }[];
  filterOpen: boolean;
  sortOpen: boolean;
  sortMode: TreeSortMode;
  showHidden: boolean;
  extLabel: (ext: string) => string;
  sortLabel: (mode: TreeSortMode) => string;
}>();

defineEmits<{
  (e: 'new-file'): void;
  (e: 'open-filter'): void;
  (e: 'clear-filter'): void;
  (e: 'toggle-ext', ext: string): void;
  (e: 'toggle-sort'): void;
  (e: 'set-sort', mode: TreeSortMode): void;
  (e: 'toggle-hidden'): void;
  (e: 'refresh'): void;
  (e: 'open-folder'): void;
  (e: 'close-folder'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="ftree__header">
    <span class="ftree__header-title">{{ t('explorer.heading') }}</span>
    <div class="ftree__header-btns">
      <button
        class="ftree__hbtn"
        :title="t('explorer.newFile') || 'New file'"
        @click="hasRoot && $emit('new-file')"
        :disabled="!hasRoot"
      >＋</button>
      <div class="ftree__filter-wrap">
        <button
          v-if="localVault"
          class="ftree__hbtn"
          :class="{ 'ftree__hbtn--on': extFilter.length > 0 }"
          :title="t('explorer.filterByType') || 'Filter by file type'"
          @click.stop="$emit('open-filter')"
          :disabled="!hasRoot"
        >{{ extFilter.length ? '▼' : '▽' }}</button>
        <div v-if="filterOpen" class="ftree__filter-pop" @click.stop>
          <div class="ftree__filter-label">{{ t('explorer.filterByType') || 'Filter by file type' }}</div>
          <button
            class="ftree__filter-item"
            :class="{ 'ftree__filter-item--active': extFilter.length === 0 }"
            @click="$emit('clear-filter')"
          >
            <span class="ftree__filter-check">{{ extFilter.length === 0 ? '✓' : '' }}</span>
            <span class="ftree__filter-name">{{ t('explorer.filterAll') || 'All files' }}</span>
          </button>
          <div class="ftree__filter-sep"></div>
          <button
            v-for="e in extList"
            :key="e.ext || '__noext__'"
            class="ftree__filter-item"
            :class="{ 'ftree__filter-item--active': extFilter.includes(e.ext) }"
            @click="$emit('toggle-ext', e.ext)"
          >
            <span class="ftree__filter-check">{{ extFilter.includes(e.ext) ? '✓' : '' }}</span>
            <span class="ftree__filter-name">{{ extLabel(e.ext) }}</span>
            <span class="ftree__filter-count">{{ e.count }}</span>
          </button>
          <div v-if="extList.length === 0" class="ftree__filter-empty">
            {{ t('explorer.filterNoTypes') || 'Nothing to filter yet.' }}
          </div>
        </div>
      </div>
      <div class="ftree__filter-wrap">
        <button
          class="ftree__hbtn"
          :class="{ 'ftree__hbtn--on': sortMode !== 'name-asc' }"
          :title="(t('explorer.sortBy') || 'Sort') + ' · ' + sortLabel(sortMode)"
          @click.stop="$emit('toggle-sort')"
          :disabled="!hasRoot"
        >⇅</button>
        <div v-if="sortOpen" class="ftree__filter-pop" @click.stop>
          <div class="ftree__filter-label">{{ t('explorer.sortBy') || 'Sort' }}</div>
          <button
            v-for="m in TREE_SORT_MODES"
            :key="m"
            class="ftree__filter-item"
            :class="{ 'ftree__filter-item--active': sortMode === m }"
            :disabled="m === 'manual' && !localVault"
            @click="$emit('set-sort', m)"
          >
            <span class="ftree__filter-check">{{ sortMode === m ? '✓' : '' }}</span>
            <span class="ftree__filter-name">{{ sortLabel(m) }}</span>
          </button>
          <div v-if="sortMode === 'manual'" class="ftree__filter-empty">
            {{ t('explorer.sortManualHint') }}
          </div>
        </div>
      </div>
      <button
        class="ftree__hbtn ftree__hbtn--icon"
        :class="{ 'ftree__hbtn--on': showHidden }"
        :title="t('settings.explorerShowHidden')"
        :aria-label="t('settings.explorerShowHidden')"
        :aria-pressed="showHidden"
        data-testid="explorer-toggle-hidden"
        @click="$emit('toggle-hidden')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          <line v-if="!showHidden" x1="3" y1="3" x2="21" y2="21" />
        </svg>
      </button>
      <button
        class="ftree__hbtn"
        :title="t('explorer.refresh') || 'Refresh'"
        @click="$emit('refresh')"
        :disabled="!hasRoot"
      >↻</button>
      <button
        class="ftree__hbtn"
        :title="t('explorer.openFolder') || 'Open folder…'"
        @click="$emit('open-folder')"
      >📁</button>
      <button
        v-if="hasWorkspace"
        class="ftree__hbtn"
        :title="t('explorer.closeFolder') || 'Close folder'"
        @click="$emit('close-folder')"
      >✕</button>
    </div>
  </div>
</template>

<style scoped src="./file-tree-header.css"></style>
