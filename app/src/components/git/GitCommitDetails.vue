<script setup lang="ts">
import { computed } from 'vue';
import { useGitPaneStore } from '../../stores/gitPane';
import { useTabsStore } from '../../stores/tabs';
import { statusLetter } from '../../lib/git-pane/statusLetter';

const git = useGitPaneStore();
const tabs = useTabsStore();
const commit = computed(() => git.commits.find((c) => c.sha === git.selectedSha) ?? null);
</script>

<template>
  <div class="git-details">
    <template v-if="commit">
      <div class="git-details__subject" dir="auto">{{ commit.subject }}</div>
      <pre v-if="commit.body" class="git-details__body" dir="auto">{{ commit.body }}</pre>
      <div class="git-details__meta">
        <code dir="ltr">{{ commit.shortSha }}</code> · <span dir="auto">{{ commit.author.name }}</span> · {{ new Date(commit.date).toLocaleString() }}
      </div>
      <div
        v-for="f in git.selectedFiles"
        :key="f.id"
        class="git-row"
        @dblclick="tabs.openGitDiff({ path: f.path, side: 'commit', sha: commit.sha })"
      >
        <span class="git-row__letter" :data-s="statusLetter(f.status)">{{ statusLetter(f.status) }}</span>
        <span class="git-row__name" dir="auto">{{ f.fileName }}</span>
        <span class="git-row__dir" dir="auto">{{ f.directory }}</span>
      </div>
    </template>
  </div>
</template>
