<script setup lang="ts">
import { useGithubSyncStore } from '../stores/githubSync';
import { useSettingsStore } from '../stores/settings';
import { useWorkspaceStore } from '../stores/workspace';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import type { GithubSyncDrafts } from './githubSyncDrafts.ts';
import { syncMessageKey, type GiteaStep } from './githubSyncFormat.ts';

const props = defineProps<{
  drafts: GithubSyncDrafts;
  link: (remoteUrl: string) => Promise<void>;
}>();
const step = defineModel<GiteaStep>('step', { required: true });

const drafts = props.drafts;
const sync = useGithubSyncStore();
const settings = useSettingsStore();
const workspace = useWorkspaceStore();
const toasts = useToastsStore();
const { t } = useI18n();


async function linkClone() {
  const url = drafts.giteaCloneUrl.trim();
  if (!url) return;
  await props.link(url);
  drafts.giteaCloneUrl = '';
}

async function clearGiteaToken() {
  if (sync.status?.linked && workspace.currentFolder) {
    await sync.unlink(workspace.currentFolder).catch(() => {});
  }
  await sync.clearGiteaToken();
  step.value = 'token';
  toasts.info(t('githubSync.giteaTokenClearedToast'));
}

async function refreshRepos() {
  try {
    await sync.listGiteaRepos(sync.giteaUrl);
  } catch (e) {
    toasts.error(String(e));
  }
}

async function linkRepo(remoteUrl: string) {
  if (!workspace.currentFolder) { toasts.warning(t('githubSync.noWorkspace')); return; }
  if (!settings.autoGitEnabled) settings.toggleAutoGit();
  drafts.giteaLinking = true;
  try {
    await sync.link(workspace.currentFolder, remoteUrl, {
      encrypted: drafts.enableE2ee,
      provider: 'gitea',
    });
    toasts.success(t('githubSync.linkedToast'));
  } catch (e) {
    toasts.error(String(e));
  } finally {
    drafts.giteaLinking = false;
  }
}

async function createRepo() {
  const name = drafts.giteaRepoName.trim();
  if (!name) return;
  drafts.giteaCreatingRepo = true;
  try {
    const repo = await sync.createGiteaRepo(sync.giteaUrl, name, drafts.giteaRepoPrivate);
    toasts.success(t(syncMessageKey('gitea', 'repoCreatedToast'), { name: repo.full_name }));
    drafts.giteaRepoName = '';
    if (workspace.currentFolder) {
      await linkRepo(repo.clone_url);
    }
  } catch (e) {
    toasts.error(String(e));
  } finally {
    drafts.giteaCreatingRepo = false;
  }
}
</script>

<template>
  <div class="ghs-subblock">
    <div class="ghs-sub-title">{{ t('githubSync.giteaSignedInAs', { user: sync.giteaUser?.login ?? '…' }) }}</div>

    <div class="ghs-subblock" style="border: none; padding-top: 0;">
      <div class="ghs-sub-title">{{ t('githubSync.createNewTitle') }}</div>
      <div class="ghs-row">
        <input
          v-model="drafts.giteaRepoName"
          type="text"
          class="ghs-input"
          :placeholder="t('githubSync.newRepoPlaceholder')"
        />
      </div>
      <div class="ghs-row">
        <label class="ghs-checkbox">
          <input v-model="drafts.giteaRepoPrivate" type="checkbox" />
          {{ t('githubSync.privateRepo') }}
        </label>
      </div>
      <div class="ghs-row">
        <button
          class="ghs-btn ghs-btn--primary"
          :disabled="drafts.giteaCreatingRepo || !drafts.giteaRepoName.trim()"
          @click="createRepo"
        >
          {{ drafts.giteaCreatingRepo ? t('githubSync.creatingRepo') : t('githubSync.createAndLinkBtn') }}
        </button>
      </div>
    </div>

    <div class="ghs-subblock">
      <div class="ghs-sub-title">{{ t('githubSync.pickExistingTitle') }}</div>
      <div v-if="sync.giteaLoading" class="ghs-help">{{ t('githubSync.loadingRepos') }}</div>
      <div v-else-if="!sync.giteaRepos.length" class="ghs-help">
        {{ t('githubSync.noReposFound') }}
        <button class="ghs-btn ghs-btn--small" @click="refreshRepos">{{ t('githubSync.refreshRepos') }}</button>
      </div>
      <ul v-else class="ghs-repolist">
        <li v-for="r in sync.giteaRepos" :key="r.full_name" class="ghs-repolist__item">
          <div class="ghs-repolist__meta">
            <span class="ghs-repolist__name">{{ r.full_name }}</span>
            <span v-if="r.private" class="ghs-repolist__pill">{{ t('githubSync.privateBadge') }}</span>
          </div>
          <button
            class="ghs-btn ghs-btn--small"
            :disabled="drafts.giteaLinking"
            @click="linkRepo(r.clone_url)"
          >
            {{ t('githubSync.linkBtn') }}
          </button>
        </li>
      </ul>

      <div class="ghs-subblock">
        <div class="ghs-sub-title">{{ t('githubSync.giteaCloneUrlTitle') }}</div>
        <div class="ghs-row">
          <input
            v-model="drafts.giteaCloneUrl"
            type="text"
            class="ghs-input ghs-input--mono"
            placeholder="https://gitea.com/owner/repo.git"
          />
        </div>
        <div class="ghs-row">
          <button
            class="ghs-btn ghs-btn--primary"
            :disabled="drafts.linking || !drafts.giteaCloneUrl.trim()"
            @click="linkClone"
          >
            {{ t('githubSync.linkBtn') }}
          </button>
        </div>
      </div>
    </div>

    <div class="ghs-row">
      <button class="ghs-btn ghs-btn--ghost" @click="clearGiteaToken">
        {{ t('githubSync.signOutBtn') }}
      </button>
      <button class="ghs-btn ghs-btn--ghost" @click="refreshRepos">
        {{ t('githubSync.refreshRepos') }}
      </button>
    </div>
  </div>
</template>

<style scoped src="./GithubSyncSettings.css"></style>
