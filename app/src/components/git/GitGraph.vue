<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { useI18n } from '../../i18n';
import { useGitPaneStore } from '../../stores/gitPane';
import { computeGraphLayout } from '../../lib/git-pane/graph/computeGraphLayout';
import { useGitBranchCreate } from '../../composables/useGitBranchCreate';
import GitGraphRow from './GitGraphRow.vue';

const ROW_HEIGHT = 24;
const LANE_WIDTH = 14;
const OVERSCAN = 12;
const LOAD_MORE_THRESHOLD = 40;

const git = useGitPaneStore();
const scrollEl = ref<HTMLElement | null>(null);
const { t } = useI18n();
const query = ref('');
const { createBranchFrom } = useGitBranchCreate();
const isLoadingMore = ref(false);
const isFiltering = computed(() => query.value.trim() !== '');

const visibleCommits = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return git.commits;
  return git.commits.filter((c) => c.subject.toLowerCase().includes(q) || c.sha.startsWith(q) || c.author.name.toLowerCase().includes(q));
});
const layout = computed(() => computeGraphLayout(isFiltering.value ? [] : visibleCommits.value));

const virtualizer = useVirtualizer(computed(() => ({
  count: visibleCommits.value.length,
  getScrollElement: () => scrollEl.value,
  estimateSize: () => ROW_HEIGHT,
  overscan: OVERSCAN,
})));

const lastVisibleIndex = computed(() => {
  const items = virtualizer.value.getVirtualItems();
  return items.length ? items[items.length - 1].index : undefined;
});

watch(lastVisibleIndex, async (last) => {
  const isNearEnd = last !== undefined && last > visibleCommits.value.length - LOAD_MORE_THRESHOLD;
  if (!isNearEnd || !git.hasMoreCommits || isLoadingMore.value) return;
  isLoadingMore.value = true;
  try {
    await git.loadMoreCommits();
  } finally {
    isLoadingMore.value = false;
  }
});
</script>

<template>
  <div class="git-graph">
    <input v-model="query" class="git-search" :placeholder="t('git.searchCommits')" />
    <div ref="scrollEl" class="git-graph__scroll">
      <div class="git-graph__canvas" :style="{ blockSize: `${virtualizer.getTotalSize()}px` }">
        <div
          v-for="item in virtualizer.getVirtualItems()"
          :key="item.index"
          class="git-graph__item"
          :style="{ insetBlockStart: `${item.start}px` }"
        >
          <GitGraphRow
            v-if="visibleCommits[item.index]"
            :commit="visibleCommits[item.index]"
            :node="layout.nodes[item.index]"
            :edges-above="item.index > 0 ? layout.bands[item.index - 1] ?? [] : []"
            :edges-below="layout.bands[item.index] ?? []"
            :lane-count="layout.maxLanes"
            :row-height="ROW_HEIGHT"
            :lane-width="LANE_WIDTH"
            :is-selected="git.selectedSha === visibleCommits[item.index].sha"
            @select="git.selectCommit(visibleCommits[item.index].sha)"
            @context="createBranchFrom(visibleCommits[item.index].sha)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
