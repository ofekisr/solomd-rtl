<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useGitPaneStore } from '../../stores/gitPane';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';

interface CheckoutTarget {
  name: string;
  remote?: string;
}

const DIRTY_CODES = new Set(['DirtyWorktree']);

const git = useGitPaneStore();
const toasts = useToastsStore();
const { t } = useI18n();
const pending = ref<CheckoutTarget | null>(null);
const reason = ref('');
const stashBtn = ref<HTMLButtonElement | null>(null);

async function attempt(name: string, remote?: string, force = false): Promise<void> {
  const meta: Record<string, unknown> = {};
  if (remote) meta.remote = remote;
  if (force) meta.force = true;
  const ok = await git.run({ kind: 'checkout', target: name, meta });
  if (ok) {
    pending.value = null;
    return;
  }
  const error = git.lastError;
  if (!error) return;
  if (!DIRTY_CODES.has(error.code)) {
    pending.value = null;
    toasts.error(error.message);
    return;
  }
  reason.value = error.message;
  pending.value = { name, remote };
  void nextTick(() => stashBtn.value?.focus());
}

async function stashAndCheckout(): Promise<void> {
  if (!pending.value) return;
  const { name, remote } = pending.value;
  const isStashed = await git.run({ kind: 'stash', meta: { message: `SoloMD: before checkout ${name}` } });
  if (isStashed) await attempt(name, remote);
  else if (git.lastError) toasts.error(git.lastError.message);
}

function forceCheckout(): void {
  if (!pending.value) return;
  if (!window.confirm(t('git.confirmForceCheckout'))) return;
  void attempt(pending.value.name, pending.value.remote, true);
}

function onCheckout(e: Event): void {
  const detail = (e as CustomEvent<CheckoutTarget>).detail;
  void attempt(detail.name, detail.remote);
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && pending.value) pending.value = null;
}

onMounted(() => {
  window.addEventListener('gitpane:checkout', onCheckout);
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('gitpane:checkout', onCheckout);
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div v-if="pending" class="git-modal" @click.self="pending = null">
    <div class="git-modal__card" role="dialog" aria-modal="true" :aria-label="t('git.dirtyCheckoutTitle')">
      <h3 dir="auto">{{ t('git.dirtyCheckoutTitle', { branch: pending.name }) }}</h3>
      <p dir="auto">{{ reason }}</p>
      <div class="git-commit-actions">
        <span class="spacer" />
        <button class="git-btn" @click="pending = null">{{ t('git.cancel') }}</button>
        <button class="git-btn" :disabled="!!git.busyOp" @click="forceCheckout">{{ t('git.forceCheckout') }}</button>
        <button ref="stashBtn" class="git-btn git-btn--primary" :disabled="!!git.busyOp" @click="stashAndCheckout">{{ t('git.stashAndCheckout') }}</button>
      </div>
    </div>
  </div>
</template>
