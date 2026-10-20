<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useGitPaneStore } from '../../stores/gitPane';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';
import { redactUrl } from '../../lib/git-pane/redactUrl';

const git = useGitPaneStore();
const toasts = useToastsStore();
const { t } = useI18n();
const isOpen = ref(false);
const commitFirst = ref(false);
const force = ref(false);
const pushBtn = ref<HTMLButtonElement | null>(null);

const branch = computed(() => git.snapshot?.branches.find((b) => b.isCurrent));
const upstream = computed(() => branch.value?.upstream ?? `origin/${git.currentBranch}`);
const remoteUrl = computed(() => redactUrl(git.snapshot?.repository.remoteUrl ?? ''));
const outgoing = computed(() => git.commits.slice(0, git.aheadBehind.ahead));
const pendingSubject = computed(() => git.message.split('\n')[0] ?? '');
const canPush = computed(() => !git.busyOp && (commitFirst.value ? git.canCommit : true));

function onOpen(e: Event): void {
  commitFirst.value = Boolean((e as CustomEvent<{ commitFirst?: boolean } | null>).detail?.commitFirst);
  force.value = false;
  isOpen.value = true;
  void nextTick(() => pushBtn.value?.focus());
}

async function push(): Promise<void> {
  if (force.value && !window.confirm(t('git.confirmForcePush', { branch: git.currentBranch }))) return;
  const ok = commitFirst.value
    ? await git.commit({ push: true, force: force.value })
    : await git.run({ kind: force.value ? 'force-push' : 'push' });
  if (ok) {
    isOpen.value = false;
    toasts.success(t('git.pushed'));
  } else if (git.lastError) {
    toasts.error(git.lastError.message);
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isOpen.value) isOpen.value = false;
}

onMounted(() => {
  window.addEventListener('gitpane:open-push', onOpen);
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('gitpane:open-push', onOpen);
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div v-if="isOpen" class="git-modal" @click.self="isOpen = false">
    <div class="git-modal__card" role="dialog" aria-modal="true" :aria-label="t('git.push')">
      <h3 dir="auto">{{ t('git.pushTitle', { branch: git.currentBranch, upstream }) }}</h3>
      <div class="git-details__meta" dir="ltr">{{ remoteUrl }}</div>
      <div class="git-modal__list">
        <div v-if="outgoing.length === 0 && !commitFirst" class="git-modal__empty">{{ t('git.nothingToPush') }}</div>
        <div v-if="commitFirst" class="git-row"><em dir="auto">{{ pendingSubject }}</em></div>
        <div v-for="c in outgoing" :key="c.sha" class="git-row"><code dir="ltr">{{ c.shortSha }}</code>&nbsp;<span dir="auto">{{ c.subject }}</span></div>
      </div>
      <label><input v-model="force" type="checkbox" /> {{ t('git.forceWithLease') }}</label>
      <div class="git-commit-actions">
        <span class="spacer" />
        <button class="git-btn" @click="isOpen = false">{{ t('git.cancel') }}</button>
        <button ref="pushBtn" class="git-btn git-btn--primary" :disabled="!canPush" @click="push">{{ t('git.push') }}</button>
      </div>
    </div>
  </div>
</template>
