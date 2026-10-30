<script setup lang="ts">
import { useI18n } from '../../../i18n';
import type { TreeNode } from '../internal/tree-types.ts';

defineProps<{
  root: TreeNode;
  open: boolean;
  isDropTarget: boolean;
  list: { path: string; name: string; parent: string }[];
}>();

defineEmits<{
  (e: 'toggle'): void;
  (e: 'contextmenu', event: MouseEvent): void;
  (e: 'pick', path: string): void;
  (e: 'open-folder'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="ftree__root-wrap">
    <button
      class="ftree__root ftree__root--btn"
      :class="{
        'ftree__root--open': open,
        'ftree__root--drop': isDropTarget,
      }"
      :title="(t('explorer.switchWorkspace') || 'Switch workspace') + ' · ' + root.path"
      @click.stop="$emit('toggle')"
      @contextmenu.prevent="$emit('contextmenu', $event)"
    >
      <span class="ftree__root-vicon" aria-hidden="true">🗂</span>
      <span class="ftree__root-name">{{ root.name }}</span>
      <span class="ftree__root-caret" aria-hidden="true">▾</span>
    </button>
    <div v-if="open" class="ftree__switcher" @click.stop>
      <div class="ftree__switcher-label">{{ t('explorer.recentFolders') }}</div>
      <button
        v-for="folder in list"
        :key="folder.path"
        class="ftree__switcher-item"
        :class="{ 'ftree__switcher-item--active': folder.path === root.path }"
        :title="folder.path"
        @click="$emit('pick', folder.path)"
      >
        <span class="ftree__switcher-name">{{ folder.name }}</span>
        <span class="ftree__switcher-path">{{ folder.parent }}</span>
      </button>
      <div v-if="list.length === 0" class="ftree__switcher-empty">
        {{ t('explorer.noRecentFolders') }}
      </div>
      <div class="ftree__switcher-sep"></div>
      <button class="ftree__switcher-item ftree__switcher-item--cta" @click="$emit('open-folder')">
        📁 {{ t('explorer.openFolder') }}
      </button>
    </div>
  </div>
</template>

<style scoped src="./file-tree-switcher.css"></style>
