<script setup lang="ts">
import { DsButton, DsModal } from '../../../ui';
import { useI18n } from '../../../i18n';
import { isMobile } from '../../../lib/platform';
import type { TreeNode } from '../internal/tree-types.ts';

defineProps<{ target: TreeNode | null }>();
defineEmits<{ (e: 'cancel'): void; (e: 'confirm'): void }>();

const { t } = useI18n();
</script>

<template>
  <!-- Delete confirmation. In-app rather than `window.confirm`: the
       webview's dialog is unstyled, untranslated and suppressed outright on
       some platforms, and a mis-aimed right-click → Delete should not be one
       keystroke away from losing a folder. -->
  <DsModal
    :model-value="!!target"
    :title="t('explorer.deleteTitle')"
    width="420px"
    @update:model-value="$emit('cancel')"
  >
    <p class="ftree__confirm-msg">
      {{
        target?.is_dir
          ? t('explorer.deleteFolderMsg', { name: target?.name ?? '' })
          : t('explorer.deleteFileMsg', { name: target?.name ?? '' })
      }}
    </p>
    <!-- #112 — desktop deletes go to the OS trash and are recoverable; a
         phone has no user-visible trash, so the wording stays honest per
         platform. Server-side, the delete is also held briefly so the toast
         can undo it. -->
    <p class="ftree__confirm-note">
      {{ isMobile() ? t('explorer.deletePermanent') : t('explorer.deleteTrash') }}
    </p>
    <template #footer>
      <DsButton variant="ghost" @click="$emit('cancel')">{{ t('explorer.cancel') }}</DsButton>
      <DsButton variant="danger" @click="$emit('confirm')">{{ t('explorer.delete') }}</DsButton>
    </template>
  </DsModal>
</template>

<style scoped src="./file-tree-dialog.css"></style>
