<script setup lang="ts">
import { useGithubSyncStore } from '../../stores/githubSync';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';
import type { GithubSyncDrafts } from './githubSyncDrafts.ts';
import type { GiteaStep } from './githubSyncFormat.ts';

const props = defineProps<{ drafts: GithubSyncDrafts }>();
const step = defineModel<GiteaStep>('step', { required: true });
const urlInput = defineModel<string>('url', { required: true });

const drafts = props.drafts;
const sync = useGithubSyncStore();
const toasts = useToastsStore();
const { t } = useI18n();


async function saveUrl() {
  const url = urlInput.value.trim();
  if (!url) return;
  drafts.giteaUrlValidating = true;
  try {
    const valid = await sync.validateGiteaUrl(url);
    if (valid) {
      await sync.setGiteaUrl(url);
      step.value = 'token';
    } else {
      toasts.warning('Could not reach this Gitea server — check the URL');
    }
  } catch (e) {
    toasts.error(String(e));
  } finally {
    drafts.giteaUrlValidating = false;
  }
}

async function saveToken() {
  const tok = drafts.giteaTokenInput.trim();
  if (!tok) return;
  drafts.giteaTokenSaving = true;
  try {
    await sync.setGiteaToken(tok);
    drafts.giteaTokenInput = '';
    step.value = 'ready';
    toasts.success(t('githubSync.giteaTokenSavedToast'));
    await sync.listGiteaRepos(sync.giteaUrl).catch(() => {});
  } catch (e) {
    toasts.error(`${t('githubSync.giteaTokenInvalid')}: ${e}`);
    void sync.clearGiteaToken();
  } finally {
    drafts.giteaTokenSaving = false;
  }
}
</script>

<template>
  <div class="ghs-card">
    <div v-if="step === 'url'">
      <div class="ghs-card__title">{{ t('githubSync.giteaUrlTitle') }}</div>
      <p class="ghs-help">{{ t('githubSync.giteaUrlHint') }}</p>
      <div class="ghs-row">
        <input
          v-model="urlInput"
          type="text"
          class="ghs-input ghs-input--mono"
          placeholder="https://gitea.com or http://gitea.example.com:3000"
        />
        <button
          class="ghs-btn ghs-btn--primary"
          :disabled="drafts.giteaUrlValidating || !urlInput.trim()"
          @click="saveUrl"
        >
          {{ drafts.giteaUrlValidating ? t('githubSync.giteaUrlValidating') : t('githubSync.giteaUrlValidateBtn') }}
        </button>
      </div>
    </div>

    <div v-else-if="step === 'token'">
      <div class="ghs-card__title">{{ t('githubSync.giteaTokenTitle') }}</div>
      <p class="ghs-help">{{ t('githubSync.giteaTokenHint') }}</p>
      <div class="ghs-row">
        <input
          v-model="drafts.giteaTokenInput"
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
          :disabled="drafts.giteaTokenSaving || !drafts.giteaTokenInput.trim()"
          @click="saveToken"
        >
          {{ drafts.giteaTokenSaving ? t('githubSync.tokenSaving') : t('githubSync.tokenSaveBtn') }}
        </button>
        <button class="ghs-btn" @click="step = 'url'">
          {{ t('githubSync.backBtn') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./GithubSyncSettings.css"></style>
