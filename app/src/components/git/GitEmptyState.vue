<script setup lang="ts">
import { useI18n } from '../../i18n';
import { useGitPaneStore, type GitPaneStatus } from '../../stores/gitPane';
import { useSettingsStore } from '../../stores/settings';

const INSTALL_GIT_URL = 'https://git-scm.com/downloads';

defineProps<{ status: GitPaneStatus | 'no-folder' | 'no-changes' }>();
const emit = defineEmits<{ (e: 'init'): void }>();
const { t } = useI18n();
const git = useGitPaneStore();
const settings = useSettingsStore();

function trustRepo(): void {
  if (git.untrustedRoot) settings.trustGitRepo(git.untrustedRoot);
  void git.trustAndReopen();
}

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
    <template v-else-if="status === 'untrusted'">
      <span>{{ t('git.untrustedTitle') }}</span>
      <ul class="git-untrusted-keys" dir="ltr">
        <li v-for="key in git.untrustedKeys" :key="key"><code>{{ key }}</code></li>
      </ul>
      <span class="git-untrusted-hint">{{ t('git.untrustedHint') }}</span>
      <button class="git-btn" :disabled="!git.untrustedRoot" @click="trustRepo">{{ t('git.trustRepo') }}</button>
    </template>
    <span v-else-if="status === 'no-folder' || status === 'idle'">{{ t('git.noFolder') }}</span>
    <span v-else-if="status === 'no-changes'">{{ t('git.noChanges') }}</span>
    <span v-else-if="status === 'loading'">{{ t('git.loading') }}</span>
    <span v-else-if="status === 'error'">{{ git.lastError?.message ?? t('git.error') }}</span>
  </div>
</template>
