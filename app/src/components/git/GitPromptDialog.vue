<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useI18n } from '../../i18n';
import { useGitPrompt } from '../../composables/useGitPrompt';

const { request, settlePrompt } = useGitPrompt();
const { t } = useI18n();
const value = ref('');
const inputEl = ref<HTMLInputElement | null>(null);

watch(request, async (next) => {
  if (!next) return;
  value.value = '';
  await nextTick();
  inputEl.value?.focus();
});

function submit(): void {
  const trimmed = value.value.trim();
  settlePrompt(trimmed || null);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="request" class="git-dialog__backdrop" @click.self="settlePrompt(null)" @keydown.esc.stop="settlePrompt(null)">
      <div class="git-dialog" role="dialog" aria-modal="true">
        <div class="git-dialog__title" dir="auto">{{ request.title }}</div>
        <input
          ref="inputEl"
          v-model="value"
          class="git-dialog__input"
          dir="auto"
          :placeholder="request.placeholder"
          @keydown.enter.prevent="submit"
        />
        <div class="git-dialog__actions">
          <button class="git-btn" @click="settlePrompt(null)">{{ t('git.cancel') }}</button>
          <button class="git-btn" :disabled="!value.trim()" @click="submit">OK</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
