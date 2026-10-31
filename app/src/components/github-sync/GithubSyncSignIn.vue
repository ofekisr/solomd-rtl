<script setup lang="ts">
import { openerPort } from '../../platform/index.ts';
import { useGithubSyncStore } from '../../stores/githubSync';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';
import type { GithubSyncDrafts } from './githubSyncDrafts.ts';
import type { SyncProvider } from './githubSyncFormat.ts';

const props = defineProps<{ providerChoice: SyncProvider; drafts: GithubSyncDrafts }>();

const drafts = props.drafts;
const sync = useGithubSyncStore();
const toasts = useToastsStore();
const { t } = useI18n();

const PAT_HELP_URL =
  'https://github.com/settings/tokens/new?scopes=repo&description=SoloMD%20sync';


async function saveToken(providerChoice: SyncProvider) {
  const tok = drafts.tokenInput.trim();
  if (!tok) return;
  drafts.tokenSaving = true;
  try {
    await sync.setToken(tok, providerChoice);
    drafts.tokenInput = '';
    toasts.success(t('githubSync.tokenSavedToast'));
    // #229 — only GitHub tokens can be validated against api.github.com;
    // a bad token on other providers surfaces on the first push instead.
    if (providerChoice !== 'github') return;
    await sync.listRepos().catch((e) => {
      toasts.error(`${t('githubSync.tokenInvalid')}: ${e}`);
      void sync.clearToken();
    });
  } catch (e) {
    toasts.error(String(e));
  } finally {
    drafts.tokenSaving = false;
  }
}

function openPATHelp() {
  void openerPort.openUrl(PAT_HELP_URL);
}
</script>

<template>
  <div class="ghs-card">
    <div class="ghs-card__title">{{ t('githubSync.signInTitle') }}</div>
    <p class="ghs-help">{{ t('githubSync.signInHint') }}</p>
    <p v-if="providerChoice !== 'github'" class="ghs-help">
      {{ t('githubSync.selfHostedTokenHint') }}
    </p>
    <div class="ghs-row">
      <input
        v-model="drafts.tokenInput"
        type="password"
        autocomplete="off"
        spellcheck="false"
        class="ghs-input ghs-input--mono"
        :placeholder="t('githubSync.tokenPlaceholder')"
      />
    </div>
    <div class="ghs-row">
      <button
        class="ghs-btn ghs-btn--primary"
        :disabled="drafts.tokenSaving || !drafts.tokenInput.trim()"
        @click="saveToken(providerChoice)"
      >
        {{ drafts.tokenSaving ? t('githubSync.tokenSaving') : t('githubSync.tokenSaveBtn') }}
      </button>
      <button v-if="providerChoice === 'github'" class="ghs-btn" @click="openPATHelp">
        {{ t('githubSync.tokenGetBtn') }}
      </button>
    </div>
    <p class="ghs-fineprint">{{ t('githubSync.tokenScopeHint') }}</p>
  </div>
</template>

<style scoped src="./GithubSyncSettings.css"></style>
