<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import { useChordHint } from '../../internal/useChordHint.ts';
import { useSettingsEnv } from '../../internal/settings-env.ts';
import CloudFolderBanner from '../../../../components/CloudFolderBanner.vue';
import GithubSyncSettings from '../../../../components/GithubSyncSettings.vue';
import ProxySettings from '../../../../components/ProxySettings.vue';

const { t } = useI18n();
const settings = useSettingsStore();
const withChord = useChordHint();
const { gitBackend } = useSettingsEnv();
</script>

<template>
  <!-- #230 — Android has no libgit2, so the whole Sync tab would be a
       row of buttons that answer "Command … not found". Say so plainly
       instead of shipping dead controls. -->
  <section v-if="!gitBackend" data-cat="sync" data-page="sync/main">
    <h3 style="font-size: 13px; font-weight: 600; color: var(--text); margin: 18px 0 6px;">
      {{ t('settings.catSync') }}
    </h3>
    <p style="font-size: 12px; color: var(--text-faint); margin: 0; line-height: 1.6;">
      {{ t('settings.syncUnsupportedAndroid') }}
    </p>
  </section>

  <section v-if="gitBackend" data-cat="sync" data-page="sync/main">
    <h3 style="font-size: 13px; font-weight: 600; color: var(--text); margin: 18px 0 6px;">
      {{ t('settings.versionHistoryHeading') }}
    </h3>
    <label>
      <input type="checkbox" :checked="settings.autoGitEnabled" @change="settings.toggleAutoGit()" />
      {{ t('settings.autoGitEnabled') }}
    </label>
    <p style="font-size: 11px; color: var(--text-faint); margin: 4px 0 0; line-height: 1.5;">
      {{ withChord('settings.autoGitHelp', 'file.save') }}
    </p>
  </section>

  <!-- v2.6.1 cloud-folder banner. Self-hides if the workspace isn't
       inside a known cloud-sync folder. -->
  <div v-if="gitBackend" data-cat="sync" data-page="sync/main"><CloudFolderBanner /></div>

  <!-- v2.6 GitHub sync — sits right under AutoGit since it pushes the
       same commits AutoGit produces; reads top-down as one story. -->
  <div v-if="gitBackend" data-cat="sync" data-page="sync/main"><GithubSyncSettings /></div>

  <!-- v3.0 — proxy URL (network-level, applies to libgit2 push/pull
       across GitHub / GitLab / Gitea). Pulled out of GithubSyncSettings
       so users hitting timeouts find it at the top of the Sync tab. -->
  <div v-if="gitBackend" data-cat="sync" data-page="sync/main"><ProxySettings /></div>
</template>

<style scoped src="../settings-page.css"></style>
