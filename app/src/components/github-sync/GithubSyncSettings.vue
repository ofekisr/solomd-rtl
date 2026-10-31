<script setup lang="ts">
/**
 * GithubSyncSettings — v2.6 Settings → GitHub sync panel.
 *
 * Three states, each its own child:
 *   1. No token       → GithubSyncSignIn (Gitea: GithubSyncGiteaSetup)
 *   2. Token, no link → GithubSyncLink (repo picker / create)
 *   3. Linked         → GithubSyncLinked (status, auto-sync, E2EE)
 *
 * Lives inside SettingsPanel.vue under the AutoGit section.
 */
import { ref, onMounted, watch } from 'vue';
import { useGithubSyncStore } from '../../stores/githubSync';
import { useWorkspaceStore } from '../../stores/workspace';
import { useI18n } from '../../i18n';
import type { GiteaStep, SyncProvider } from './githubSyncFormat.ts';
import { createGithubSyncDrafts } from './githubSyncDrafts.ts';
import GithubSyncSignIn from './GithubSyncSignIn.vue';
import GithubSyncGiteaSetup from './GithubSyncGiteaSetup.vue';
import GithubSyncLink from './GithubSyncLink.vue';
import GithubSyncLinked from './GithubSyncLinked.vue';

const sync = useGithubSyncStore();
const workspace = useWorkspaceStore();
const { t } = useI18n();

// PR #150 narrowed this to 'github' | 'gitea'; the full set is restored —
// GitLab and custom HTTPS remotes link through the clone-URL path.
const providerChoice = ref<SyncProvider>('github');
const drafts = createGithubSyncDrafts();
const giteaStep = ref<GiteaStep>('url');
const giteaUrlInput = ref('');

onMounted(async () => {
  await sync.refreshHasToken();
  if (workspace.currentFolder) {
    await sync.refreshStatus(workspace.currentFolder);
    if (sync.status?.provider) {
      providerChoice.value = sync.status.provider as SyncProvider;
    }
  }
  if (sync.status?.provider === 'gitea' || providerChoice.value === 'gitea') {
    await initGiteaState();
  }
  if (providerChoice.value === 'github' && sync.hasToken && !sync.isLinked) {
    await Promise.all([sync.refreshUser(), sync.listRepos().catch(() => {})]);
  } else if (providerChoice.value === 'github' && sync.hasToken && sync.isLinked) {
    void sync.refreshUser();
  }
});

/** Reconnect after the saved token went bad: drop the dead credential so the
 *  sign-in form reappears (the workspace ↔ repo link is kept). */
async function reconnect() {
  await sync.clearToken();
}

watch(
  () => workspace.currentFolder,
  (f) => {
    void sync.refreshStatus(f);
  },
);

watch(
  () => providerChoice.value,
  (p) => {
    if (p === 'gitea') {
      void initGiteaState();
    }
  },
);

let _initGiteaBusy = false;
async function initGiteaState() {
  if (_initGiteaBusy) return;
  _initGiteaBusy = true;
  try {
    const saved = await sync.getGiteaUrl();
    if (saved) {
      giteaUrlInput.value = saved;
      await sync.refreshHasGiteaToken();
      if (sync.hasGiteaToken) {
        giteaStep.value = 'ready';
        await sync.listGiteaRepos(saved).catch(() => {});
      } else {
        giteaStep.value = 'token';
      }
    } else {
      giteaStep.value = 'url';
    }
  } finally {
    _initGiteaBusy = false;
  }
}
</script>

<template>
  <section class="ghs">
    <h3 class="ghs__heading">{{ providerChoice === 'gitea' ? 'Gitea sync' : t('githubSync.heading') }}</h3>
    <p class="ghs__intro">{{ providerChoice === 'gitea' ? t('githubSync.giteaIntro') : t('githubSync.intro') }}</p>

    <!-- Provider picker — the single picker for the whole panel, always
         visible so a self-hosted user can choose a backend before a token
         exists (#229). -->
    <div class="ghs-card" style="padding: 8px 12px;">
      <div class="ghs-sub-title" style="margin-top: 0;">{{ t('githubSync.providerTitle') }}</div>
      <div class="ghs-row">
        <select v-model="providerChoice" class="ghs-select" style="flex: 1;">
          <option value="github">GitHub</option>
          <option value="gitlab">GitLab</option>
          <option value="gitea">Gitea / Forgejo (self-hosted)</option>
          <option value="custom">{{ t('githubSync.customProvider') }}</option>
        </select>
      </div>
      <p v-if="providerChoice === 'gitlab' || providerChoice === 'custom'" class="ghs-help">
        {{ t('githubSync.nonGithubHint') }}
      </p>
    </div>

    <!-- v3.0 — first-time-setup hint: macOS prompts once for the PAT and
         once for the E2EE key; "Always Allow" silences both. -->
    <div class="ghs-keychain-hint">
      <span class="ghs-keychain-hint__icon">🔑</span>
      <div>
        <strong>{{ t('githubSync.keychainHintTitle') }}</strong>
        <p>{{ t('githubSync.keychainHintBody') }}</p>
      </div>
    </div>

    <!-- Token-expired banner: the saved PAT was rejected (401). Sync is
         paused until the user reconnects. -->
    <div v-if="sync.tokenInvalid || sync.giteaTokenInvalid" class="ghs-authwarn">
      <span class="ghs-authwarn__icon">⚠️</span>
      <div class="ghs-authwarn__body">
        <strong>{{ providerChoice === 'gitea' ? t('githubSync.giteaTokenExpiredTitle') : t('githubSync.tokenExpiredTitle') }}</strong>
        <p>{{ providerChoice === 'gitea' ? t('githubSync.giteaTokenExpiredBanner') : t('githubSync.tokenExpiredBanner') }}</p>
      </div>
      <button class="ghs-btn ghs-btn--primary" @click="reconnect">
        {{ t('githubSync.reconnectBtn') }}
      </button>
    </div>

    <div v-if="sync.pushErrorType === 'protected-branch' && sync.isLinked" class="ghs-authwarn" style="border-color: #b45309;">
      <span class="ghs-authwarn__icon">🛡️</span>
      <div class="ghs-authwarn__body">
        <strong>{{ t('githubSync.pushBlockedByBranchProtection') }}</strong>
        <p>Go to your Gitea/GitHub server and create a Pull Request with your changes, or remove branch protection on the repository settings.</p>
      </div>
    </div>

    <!-- State 1: no token. Gitea has its own URL-then-token flow; every other
         provider signs in with a bare token. -->
    <GithubSyncSignIn v-if="providerChoice !== 'gitea' && !sync.hasToken" :provider-choice="providerChoice" :drafts="drafts" />

    <GithubSyncGiteaSetup
      v-else-if="providerChoice === 'gitea' && (!sync.hasGiteaToken || giteaStep !== 'ready')"
      v-model:step="giteaStep"
      v-model:url="giteaUrlInput"
      :drafts="drafts"
    />

    <!-- State 2: token ready, no link. -->
    <GithubSyncLink v-else-if="!sync.isLinked" v-model:gitea-step="giteaStep" :provider-choice="providerChoice" :drafts="drafts" />

    <!-- State 3: linked. -->
    <GithubSyncLinked v-else :provider-choice="providerChoice" :drafts="drafts" />

    <p v-if="sync.lastError" class="ghs-error">{{ sync.lastError }}</p>
  </section>
</template>

<style scoped src="./GithubSyncSettings.css"></style>
