<script setup lang="ts">
import { useGitPaneStore } from '../../stores/gitPane';
import { useI18n } from '../../i18n';

const git = useGitPaneStore();
const { t } = useI18n();
const emit = defineEmits<{ (e: 'open-file', relPath: string): void }>();
</script>

<template>
  <div v-if="git.conflictedFiles.length" class="git-conflicts" role="status">
    <strong>{{ t('git.conflictsBanner', { count: git.conflictedFiles.length }) }}</strong>
    <span v-for="f in git.conflictedFiles" :key="f.id" class="git-conflicts__file">
      <span dir="auto">{{ f.path }}</span>
      <button class="git-btn" @click="emit('open-file', f.path)">{{ t('git.openInEditor') }}</button>
    </span>
  </div>
</template>
