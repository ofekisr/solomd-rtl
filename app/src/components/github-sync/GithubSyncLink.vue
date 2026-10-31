<script setup lang="ts">
import { useGithubSyncStore } from '../../stores/githubSync';
import { useSettingsStore } from '../../stores/settings';
import { useWorkspaceStore } from '../../stores/workspace';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';
import { syncMessageKey, type GiteaStep, type SyncProvider } from './githubSyncFormat.ts';
import type { GithubSyncDrafts } from './githubSyncDrafts.ts';
import { useGithubSyncToken } from './useGithubSyncToken.ts';
import GithubSyncGiteaRepos from './GithubSyncGiteaRepos.vue';

const props = defineProps<{ providerChoice: SyncProvider; drafts: GithubSyncDrafts }>();
const giteaStep = defineModel<GiteaStep>('giteaStep', { required: true });

const drafts = props.drafts;
const sync = useGithubSyncStore();
const settings = useSettingsStore();
const workspace = useWorkspaceStore();
const toasts = useToastsStore();
const { t } = useI18n();
const { clearToken } = useGithubSyncToken();


async function link(remoteUrl: string) {
  if (!workspace.currentFolder) {
    toasts.warning(t('githubSync.noWorkspace'));
    return;
  }
  if (!settings.autoGitEnabled) {
    settings.toggleAutoGit();
  }
  drafts.linking = true;
  try {
    await sync.link(workspace.currentFolder, remoteUrl, {
      encrypted: drafts.enableE2ee,
      provider: props.providerChoice,
    });
    toasts.success(t('githubSync.linkedToast'));
  } catch (e) {
    toasts.error(`${t('githubSync.linkFailed')}: ${e}`);
  } finally {
    drafts.linking = false;
  }
}

async function createRepo() {
  const name = drafts.newRepoName.trim();
  if (!name) return;
  drafts.creatingRepo = true;
  try {
    const repo = await sync.createRepo(name, drafts.newRepoPrivate);
    toasts.success(t(syncMessageKey(props.providerChoice, 'repoCreatedToast'), { name: repo.full_name }));
    drafts.newRepoName = '';
    if (workspace.currentFolder) {
      await link(repo.clone_url);
    }
  } catch (e) {
    toasts.error(`${t('githubSync.repoCreateFailed')}: ${e}`);
  } finally {
    drafts.creatingRepo = false;
  }
}

async function linkManualClone() {
  const url = drafts.manualCloneUrl.trim();
  if (!url) return;
  await link(url);
  drafts.manualCloneUrl = '';
}

async function refreshRepos() {
  try {
    await sync.listRepos();
  } catch (e) {
    toasts.error(String(e));
  }
}
</script>

<template>
  <div class="ghs-card">
    <div class="ghs-card__title">
      <template v-if="providerChoice === 'gitea'">
        {{ t('githubSync.giteaSignedInAs', { user: sync.giteaUser?.login ?? '…' }) }}
      </template>
      <template v-else-if="providerChoice === 'github'">
        {{ t('githubSync.signedInAs', { user: sync.user?.login ?? '…' }) }}
      </template>
      <template v-else>{{ t('githubSync.tokenSavedTitle') }}</template>
    </div>

    <p v-if="!workspace.currentFolder" class="ghs-help">
      {{ t('githubSync.openFolderFirst') }}
    </p>

    <template v-else>
      <p class="ghs-help">{{ t('githubSync.linkHint') }}</p>

      <div class="ghs-subblock">
        <label class="ghs-checkbox" style="margin-top: 6px;">
          <input v-model="drafts.enableE2ee" type="checkbox" />
          {{ t('githubSync.enableE2ee') }}
        </label>
        <p class="ghs-help">{{ t('githubSync.e2eeHint') }}</p>
      </div>

      <div v-if="providerChoice === 'github'" class="ghs-subblock">
        <div class="ghs-sub-title">{{ t('githubSync.createNewTitle') }}</div>
        <div class="ghs-row">
          <input
            v-model="drafts.newRepoName"
            type="text"
            class="ghs-input"
            :placeholder="t('githubSync.newRepoPlaceholder')"
          />
        </div>
        <div class="ghs-row">
          <label class="ghs-checkbox">
            <input v-model="drafts.newRepoPrivate" type="checkbox" />
            {{ t('githubSync.privateRepo') }}
          </label>
        </div>
        <div class="ghs-row">
          <button
            class="ghs-btn ghs-btn--primary"
            :disabled="drafts.creatingRepo || !drafts.newRepoName.trim()"
            @click="createRepo"
          >
            {{ drafts.creatingRepo ? t('githubSync.creatingRepo') : t('githubSync.createAndLinkBtn') }}
          </button>
        </div>
      </div>

      <div
        v-if="providerChoice === 'gitlab' || providerChoice === 'custom'"
        class="ghs-subblock"
      >
        <div class="ghs-sub-title">{{ t('githubSync.giteaCloneUrlTitle') }}</div>
        <div class="ghs-row">
          <input
            v-model="drafts.manualCloneUrl"
            type="text"
            class="ghs-input ghs-input--mono"
            :placeholder="providerChoice === 'gitlab'
              ? 'https://gitlab.com/owner/repo.git'
              : 'https://git.example.com/owner/repo.git'"
          />
        </div>
        <div class="ghs-row">
          <button
            class="ghs-btn ghs-btn--primary"
            :disabled="drafts.linking || !drafts.manualCloneUrl.trim()"
            @click="linkManualClone"
          >
            {{ t('githubSync.linkBtn') }}
          </button>
        </div>
      </div>

      <GithubSyncGiteaRepos
        v-if="providerChoice === 'gitea' && giteaStep === 'ready'"
        v-model:step="giteaStep"
        :drafts="drafts"
        :link="link"
      />

      <div v-if="providerChoice === 'github'" class="ghs-subblock">
        <div class="ghs-sub-title">{{ t('githubSync.pickExistingTitle') }}</div>
        <div v-if="sync.loading" class="ghs-help">{{ t('githubSync.loadingRepos') }}</div>
        <div v-else-if="!sync.repos.length" class="ghs-help">
          {{ t('githubSync.noReposFound') }}
          <button class="ghs-btn ghs-btn--small" @click="refreshRepos">{{ t('githubSync.refreshRepos') }}</button>
        </div>
        <ul v-else class="ghs-repolist">
          <li v-for="r in sync.repos" :key="r.full_name" class="ghs-repolist__item">
            <div class="ghs-repolist__meta">
              <span class="ghs-repolist__name">{{ r.full_name }}</span>
              <span v-if="r.private" class="ghs-repolist__pill">{{ t('githubSync.privateBadge') }}</span>
            </div>
            <button
              class="ghs-btn ghs-btn--small"
              :disabled="drafts.linking"
              @click="link(r.clone_url)"
            >
              {{ t('githubSync.linkBtn') }}
            </button>
          </li>
        </ul>
      </div>

      <div v-if="providerChoice !== 'gitea'" class="ghs-row">
        <button class="ghs-btn ghs-btn--ghost" @click="clearToken">
          {{ t('githubSync.signOutBtn') }}
        </button>
        <button v-if="providerChoice === 'github'" class="ghs-btn ghs-btn--ghost" @click="refreshRepos">
          {{ t('githubSync.refreshRepos') }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped src="./GithubSyncSettings.css"></style>
