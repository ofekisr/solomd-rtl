<script setup lang="ts">
import { ref, watch } from 'vue';
import { DsModal, DsButton } from '../../ui';
import { useI18n } from '../../i18n';
import { answerConvertConflict, convertConflictPrompt } from '../../composables/useConvertConflict';
import type { ConvertConflictChoice } from '../../lib/convert-conflict';

const { t } = useI18n();
const shouldRemember = ref(false);

watch(convertConflictPrompt, (prompt) => {
  if (prompt) shouldRemember.value = false;
});

function answer(choice: ConvertConflictChoice): void {
  answerConvertConflict({ choice, shouldRemember: shouldRemember.value });
}
</script>

<template>
  <DsModal
    :model-value="!!convertConflictPrompt"
    :title="t('convertConflict.title')"
    width="420px"
    @update:model-value="answer('cancel')"
  >
    <p class="cc-msg">
      <strong>{{ convertConflictPrompt?.targetName }}</strong>
      {{ t('convertConflict.message', { source: convertConflictPrompt?.sourceName ?? '' }) }}
    </p>
    <label class="cc-remember">
      <input v-model="shouldRemember" type="checkbox" />
      {{ t('convertConflict.remember') }}
    </label>
    <template #footer>
      <DsButton variant="ghost" @click="answer('cancel')">{{ t('convertConflict.cancel') }}</DsButton>
      <DsButton variant="ghost" @click="answer('keep')">{{ t('convertConflict.keep') }}</DsButton>
      <DsButton variant="primary" @click="answer('replace')">{{ t('convertConflict.replace') }}</DsButton>
    </template>
  </DsModal>
</template>

<style scoped>
.cc-msg {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0 0 var(--sp-3);
  line-height: 1.5;
}
.cc-msg strong {
  color: var(--text);
}
.cc-remember {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
