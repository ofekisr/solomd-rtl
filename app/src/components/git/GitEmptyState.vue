<script setup lang="ts">
import { useI18n } from '../../i18n';
import { useGitPaneStore, type GitPaneStatus } from '../../stores/gitPane';

const INSTALL_GIT_URL = 'https://git-scm.com/downloads';

defineProps<{ status: GitPaneStatus | 'no-folder' | 'no-changes' }>();
const emit = defineEmits<{ (e: 'init'): void }>();
const { t } = useI18n();
const git = useGitPaneStore();

async function openInstall(): Promise<void> {
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(INSTALL_GIT_URL);
}
</script>

<template>
  <div class="git-empty">
    <template v-if="status === 'no-repo'">
      <span>{{ t('git.notARepo') }}</span>
      <button class="git-btn" @click="emit('init')">{{ t('git.init') }}</button>
    </template>
    <template v-else-if="status === 'no-git'">
      <span>{{ t('git.gitNotFound') }}</span>
      <button class="git-btn" @click="openInstall">{{ t('git.installGit') }}</button>
    </template>
    <span v-else-if="status === 'no-folder' || status === 'idle'">{{ t('git.noFolder') }}</span>
    <span v-else-if="status === 'no-changes'">{{ t('git.noChanges') }}</span>
    <span v-else-if="status === 'loading'">{{ t('git.loading') }}</span>
    <span v-else-if="status === 'error'">{{ git.lastError?.message ?? t('git.error') }}</span>
  </div>
</template>
