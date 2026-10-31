<script setup lang="ts">
import { computed } from 'vue';
import { classifyPushError, classifyPullError, useGithubSyncStore } from '../../stores/githubSync';
import { useWorkspaceStore } from '../../stores/workspace';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';
import {
  formatAgo,
  linkedRepoLabel as toRepoLabel,
  syncMessageKey,
  type SyncProvider,
} from './githubSyncFormat.ts';
import type { GithubSyncDrafts } from './githubSyncDrafts.ts';
import { useGithubSyncToken } from './useGithubSyncToken.ts';

const props = defineProps<{ providerChoice: SyncProvider; drafts: GithubSyncDrafts }>();

const drafts = props.drafts;
const sync = useGithubSyncStore();
const workspace = useWorkspaceStore();
const toasts = useToastsStore();
const { t } = useI18n();
const { clearToken } = useGithubSyncToken();

const MIN_PASSPHRASE_LENGTH = 8;
const TOAST_LONG_MS = 8000;


const repoLabel = computed(() => toRepoLabel(sync.status?.remote_url ?? ''));

function tSync(key: string, params?: Record<string, string | number>): string {
  return t(syncMessageKey(props.providerChoice, key), params);
}

function startE2eeUpgrade() {
  drafts.upgradeOpen = true;
}
function cancelE2eeUpgrade() {
  drafts.upgradeOpen = false;
  drafts.upgradePassphrase = '';
  drafts.upgradeConfirm = '';
  drafts.upgradeAcknowledged = false;
}
async function commitE2eeUpgrade() {
  if (!workspace.currentFolder) return;
  if (drafts.upgradePassphrase.length < MIN_PASSPHRASE_LENGTH) {
    toasts.warning(t('githubSync.upgradeShortPassphrase'));
    return;
  }
  if (drafts.upgradePassphrase !== drafts.upgradeConfirm) {
    toasts.warning(t('githubSync.upgradeMismatch'));
    return;
  }
  if (!drafts.upgradeAcknowledged) {
    toasts.warning(t('githubSync.upgradeNotAcknowledged'));
    return;
  }
  drafts.upgrading = true;
  try {
    await sync.enableEncryption(workspace.currentFolder, drafts.upgradePassphrase);
    toasts.success(t('githubSync.upgradeDoneToast'));
    cancelE2eeUpgrade();
  } catch (e) {
    toasts.error(`${t('githubSync.upgradeFailed')}: ${e}`);
  } finally {
    drafts.upgrading = false;
  }
}

async function savePassphrase() {
  if (!workspace.currentFolder) return;
  const pw = drafts.passphraseInput;
  if (!pw) return;
  drafts.passphraseSaving = true;
  try {
    await sync.setPassphrase(workspace.currentFolder, pw);
    drafts.passphraseInput = '';
    toasts.success(t('githubSync.passphraseSavedToast'));
  } catch (e) {
    toasts.error(`${t('githubSync.passphraseFailed')}: ${e}`);
  } finally {
    drafts.passphraseSaving = false;
  }
}

async function decryptNow() {
  if (!workspace.currentFolder) return;
  drafts.decrypting = true;
  try {
    await sync.decryptNow(workspace.currentFolder);
    toasts.success(t('githubSync.decryptedToast'));
    window.dispatchEvent(new CustomEvent('solomd:remote-pulled'));
  } catch (e) {
    toasts.error(`${t('githubSync.decryptFailed')}: ${e}`);
  } finally {
    drafts.decrypting = false;
  }
}

async function unlink() {
  if (!workspace.currentFolder) return;
  try {
    await sync.unlink(workspace.currentFolder);
    toasts.info(t('githubSync.unlinkedToast'));
  } catch (e) {
    toasts.error(String(e));
  }
}

async function pushNow() {
  if (!workspace.currentFolder) return;
  if (!drafts.commitMsg.trim()) {
    toasts.warning(t('githubSync.commitMsgEmptyError'));
    return;
  }
  try {
    await sync.push(workspace.currentFolder, drafts.commitMsg.trim());
    drafts.commitMsg = '';
    toasts.success(tSync('pushedToast'));
  } catch (e) {
    const errType = classifyPushError(e);
    if (errType === 'protected-branch') {
      toasts.warning(t('githubSync.pushBlockedByBranchProtection'), TOAST_LONG_MS);
    } else if (errType === 'non-fast-forward') {
      toasts.warning(t('githubSync.pushRejectedPullFirst'), TOAST_LONG_MS);
    } else {
      toasts.error(`${t('githubSync.pushFailed')}: ${e}`);
    }
  }
}

async function pullNow() {
  if (!workspace.currentFolder) return;
  try {
    const r = await sync.pull(workspace.currentFolder);
    if (r.kind === 'up_to_date') {
      toasts.info(t('githubSync.upToDate'));
    } else if (r.kind === 'conflicts') {
      toasts.warning(t('githubSync.pullConflicts', { n: String(r.conflicts.length) }));
    } else {
      toasts.success(tSync('pulledToast'));
      window.dispatchEvent(new CustomEvent('solomd:remote-pulled'));
    }
  } catch (e) {
    // auth errors are surfaced by the store's tokenInvalid flag → reconnect banner
    if (classifyPullError(e) !== 'auth') {
      toasts.error(`${t('githubSync.pullFailed')}: ${e}`);
    }
  }
}

async function setAutoPush(checked: boolean) {
  if (!workspace.currentFolder || !sync.status?.linked) return;
  try {
    await sync.setConfig(workspace.currentFolder, checked, sync.status.auto_pull_minutes);
    toasts.info(checked ? t('githubSync.autoPushOn') : t('githubSync.autoPushOff'));
  } catch (e) {
    toasts.error(String(e));
  }
}

async function setAutoPullMinutes(v: number) {
  if (!workspace.currentFolder || !sync.status?.linked) return;
  try {
    await sync.setConfig(
      workspace.currentFolder,
      sync.status.auto_push,
      Number.isFinite(v) && v >= 0 ? v : 0,
    );
  } catch (e) {
    toasts.error(String(e));
  }
}
</script>

<template>
  <div class="ghs-card ghs-card--linked">
    <div class="ghs-card__title">
      {{ t('githubSync.linkedTitle', { repo: repoLabel }) }}
    </div>

    <div class="ghs-status">
      <div>
        <span class="ghs-dot" :class="sync.status?.dirty ? 'ghs-dot--warn' : 'ghs-dot--ok'"></span>
        <span v-if="sync.status?.dirty">{{ t('githubSync.statusDirty') }}</span>
        <span v-else>{{ t('githubSync.statusClean') }}</span>
      </div>
      <div v-if="(sync.status?.ahead ?? 0) > 0" class="ghs-status__pill">
        ↑ {{ sync.status?.ahead }} {{ t('githubSync.ahead') }}
      </div>
      <div v-if="(sync.status?.behind ?? 0) > 0" class="ghs-status__pill">
        ↓ {{ sync.status?.behind }} {{ t('githubSync.behind') }}
      </div>
      <div v-if="sync.hasConflicts" class="ghs-status__pill ghs-status__pill--err">
        ⚠ {{ sync.status?.conflicts.length }} {{ t('githubSync.conflictsBadge') }}
      </div>
    </div>

    <div class="ghs-timestamps">
      <div>{{ t('githubSync.lastPush') }}: {{ formatAgo(sync.status?.last_push_at ?? null, t) }}</div>
      <div>{{ t('githubSync.lastPull') }}: {{ formatAgo(sync.status?.last_pull_at ?? null, t) }}</div>
    </div>

    <div class="ghs-row" style="margin-bottom: 8px;">
      <input
        v-model="drafts.commitMsg"
        type="text"
        class="ghs-input"
        :placeholder="t('githubSync.commitMsgPlaceholder')"
        style="flex: 1;"
      />
    </div>
    <div class="ghs-row">
      <button
        class="ghs-btn ghs-btn--primary"
        :disabled="sync.pushing || sync.pulling || sync.hasConflicts || !drafts.commitMsg.trim()"
        @click="pushNow"
      >
        {{ sync.pushing ? t('githubSync.pushing') : t('githubSync.pushNow') }}
      </button>
      <button
        class="ghs-btn"
        :disabled="sync.pushing || sync.pulling"
        @click="pullNow"
      >
        {{ sync.pulling ? t('githubSync.pulling') : t('githubSync.pullNow') }}
      </button>
    </div>

    <div v-if="!sync.status?.encrypted && !drafts.upgradeOpen" class="ghs-upgrade-row">
      <span class="ghs-upgrade-row__icon">🔒</span>
      <div class="ghs-upgrade-row__copy">
        <strong>{{ t('githubSync.upgradeRowTitle') }}</strong>
        <p>{{ t('githubSync.upgradeRowBody') }}</p>
      </div>
      <button class="ghs-btn" @click="startE2eeUpgrade">
        {{ t('githubSync.upgradeRowBtn') }}
      </button>
    </div>

    <div v-if="!sync.status?.encrypted && drafts.upgradeOpen" class="ghs-subblock ghs-upgrade-form">
      <div class="ghs-sub-title">{{ t('githubSync.upgradeFormTitle') }}</div>
      <p class="ghs-help">{{ t('githubSync.upgradeFormBody') }}</p>
      <div class="ghs-warn">⚠ {{ t('githubSync.upgradeForcePushWarning') }}</div>
      <div class="ghs-row">
        <input
          v-model="drafts.upgradePassphrase"
          type="password"
          autocomplete="new-password"
          class="ghs-input"
          :placeholder="t('githubSync.upgradePassphrasePlaceholder')"
        />
      </div>
      <div class="ghs-row">
        <input
          v-model="drafts.upgradeConfirm"
          type="password"
          autocomplete="new-password"
          class="ghs-input"
          :placeholder="t('githubSync.upgradeConfirmPlaceholder')"
        />
      </div>
      <label class="ghs-checkbox" style="margin-top: 4px;">
        <input v-model="drafts.upgradeAcknowledged" type="checkbox" />
        {{ t('githubSync.upgradeAcknowledge') }}
      </label>
      <div class="ghs-row" style="margin-top: 4px;">
        <button class="ghs-btn ghs-btn--ghost" :disabled="drafts.upgrading" @click="cancelE2eeUpgrade">
          {{ t('githubSync.upgradeCancelBtn') }}
        </button>
        <button
          class="ghs-btn ghs-btn--primary"
          :disabled="drafts.upgrading || !drafts.upgradePassphrase || !drafts.upgradeConfirm || !drafts.upgradeAcknowledged"
          @click="commitE2eeUpgrade"
        >
          {{ drafts.upgrading ? t('githubSync.upgradeRunning') : t('githubSync.upgradeCommitBtn') }}
        </button>
      </div>
    </div>

    <div v-if="sync.status?.encrypted" class="ghs-subblock">
      <div class="ghs-sub-title">{{ t('githubSync.e2eeSection') }}</div>
      <p class="ghs-help">{{ t('githubSync.e2eePromptHint') }}</p>
      <div class="ghs-row">
        <input
          v-model="drafts.passphraseInput"
          type="password"
          autocomplete="new-password"
          class="ghs-input"
          :placeholder="t('githubSync.passphrasePlaceholder')"
        />
      </div>
      <div class="ghs-row">
        <button
          class="ghs-btn ghs-btn--primary"
          :disabled="drafts.passphraseSaving || !drafts.passphraseInput"
          @click="savePassphrase"
        >
          {{ drafts.passphraseSaving ? t('githubSync.passphraseSaving') : t('githubSync.passphraseSaveBtn') }}
        </button>
        <button class="ghs-btn" :disabled="drafts.decrypting" @click="decryptNow">
          {{ drafts.decrypting ? t('githubSync.decrypting') : t('githubSync.decryptBtn') }}
        </button>
      </div>
    </div>

    <details class="ghs-details" :open="drafts.showAdvanced">
      <summary @click.prevent="drafts.showAdvanced = !drafts.showAdvanced">
        {{ t('githubSync.advanced') }}
      </summary>
      <div class="ghs-advanced">
        <label class="ghs-checkbox">
          <input
            type="checkbox"
            :checked="sync.status?.auto_push ?? false"
            @change="setAutoPush(($event.target as HTMLInputElement).checked)"
          />
          {{ t('githubSync.autoPushLabel') }}
        </label>
        <p class="ghs-help">{{ t('githubSync.autoPushHint') }}</p>

        <label class="ghs-row" style="align-items: center;">
          <span class="ghs-help" style="margin-right: 8px;">{{ t('githubSync.autoPullLabel') }}:</span>
          <select
            :value="String(sync.status?.auto_pull_minutes ?? 0)"
            @change="setAutoPullMinutes(parseInt(($event.target as HTMLSelectElement).value, 10))"
            class="ghs-select"
          >
            <option value="0">{{ t('githubSync.autoPullOff') }}</option>
            <option value="5">5 {{ t('githubSync.minutes') }}</option>
            <option value="15">15 {{ t('githubSync.minutes') }}</option>
            <option value="30">30 {{ t('githubSync.minutes') }}</option>
            <option value="60">60 {{ t('githubSync.minutes') }}</option>
          </select>
        </label>
        <p class="ghs-help">{{ t('githubSync.autoPullHint') }}</p>

        <div class="ghs-row" style="margin-top: 10px;">
          <button class="ghs-btn ghs-btn--ghost" @click="unlink">
            {{ t('githubSync.unlinkBtn') }}
          </button>
          <button class="ghs-btn ghs-btn--ghost" @click="clearToken">
            {{ t('githubSync.signOutBtn') }}
          </button>
        </div>
      </div>
    </details>
  </div>
</template>

<style scoped src="./GithubSyncSettings.css"></style>
