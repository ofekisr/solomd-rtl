<script setup lang="ts">
import { useI18n } from '../../../i18n';
import { isMobile } from '../../../lib/platform';
import { NEW_FILE_TYPES } from '../../../lib/new-file-types';
import type { PaneSide } from '../../../lib/pane-place';
import type { CtxMenu, TreeNode } from '../internal/tree-types.ts';

const PANE_SIDES: PaneSide[] = ['left', 'right', 'down', 'up'];

defineProps<{
  ctx: CtxMenu;
  subOpen: boolean;
  subFlipped: boolean;
  subRaised: boolean;
  canMove: boolean;
  rootPath: string | undefined;
  isMmap: (path: string) => boolean;
  inWorkbench: (path: string) => boolean;
}>();

defineEmits<{
  (e: 'update:subOpen', open: boolean): void;
  (e: 'new-file', node: TreeNode | null, ext: string | undefined): void;
  (e: 'new-folder', node: TreeNode | null): void;
  (e: 'open-side', node: TreeNode, side: PaneSide): void;
  (e: 'rename', node: TreeNode): void;
  (e: 'move-to', node: TreeNode): void;
  (e: 'delete', node: TreeNode): void;
  (e: 'copy-path', node: TreeNode): void;
  (e: 'copy-rel-path', node: TreeNode): void;
  (e: 'copy-git-url', node: TreeNode): void;
  (e: 'toggle-workbench', path: string): void;
  (e: 'open-workbench', path: string): void;
  (e: 'copy-map', path: string): void;
  (e: 'reveal', node: TreeNode | null): void;
}>();

const { t } = useI18n();
</script>

<template>
  <!-- Context menu — absolute-positioned floating div. Items vary by
       whether the click landed on a file, a folder, or empty area. -->
  <div
    class="ftree__ctx"
    :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }"
    @click.stop
  >
    <template v-if="!ctx.node || ctx.node.is_dir">
      <div
        class="ftree__ctx-sub"
        :class="{ 'ftree__ctx-sub--flip': subFlipped, 'ftree__ctx-sub--raise': subRaised }"
        @mouseenter="$emit('update:subOpen', true)"
        @mouseleave="$emit('update:subOpen', false)"
      >
        <button
          class="ftree__ctx-item ftree__ctx-item--sub"
          aria-haspopup="menu"
          :aria-expanded="subOpen"
          @click="$emit('update:subOpen', !subOpen)"
          @keydown.right.prevent="$emit('update:subOpen', true)"
          @keydown.left.prevent="$emit('update:subOpen', false)"
        >
          <span>📄 {{ t('explorer.newFile') || 'New File' }}</span>
          <span class="ftree__ctx-arrow">▸</span>
        </button>
        <div v-if="subOpen" class="ftree__ctx ftree__ctx--sub" role="menu">
          <button
            v-for="type in NEW_FILE_TYPES"
            :key="type.ext"
            class="ftree__ctx-item ftree__ctx-item--sub"
            role="menuitem"
            @click="$emit('new-file', ctx.node, type.ext)"
          >
            <span><span class="ftree__ctx-icon">{{ type.icon }}</span>{{ type.label }}</span>
            <span class="ftree__ctx-ext">.{{ type.ext }}</span>
          </button>
        </div>
      </div>
      <button class="ftree__ctx-item" @click="$emit('new-folder', ctx.node)">
        📁 {{ t('explorer.newFolder') || 'New Folder' }}
      </button>
    </template>
    <template v-if="ctx.node && !ctx.node.is_dir">
      <button
        v-for="side in PANE_SIDES"
        :key="side"
        class="ftree__ctx-item"
        @click="$emit('open-side', ctx.node, side)"
      >
        {{ t(`paneOpen.${side}`) }}
      </button>
    </template>
    <div v-if="ctx.node" class="ftree__ctx-sep"></div>
    <button v-if="ctx.node" class="ftree__ctx-item" @click="$emit('rename', ctx.node)">
      ✎ {{ t('explorer.rename') || 'Rename' }}
    </button>
    <button
      v-if="ctx.node && canMove && ctx.node.path !== rootPath"
      class="ftree__ctx-item"
      @click="$emit('move-to', ctx.node)"
    >
      ↪ {{ t('explorer.moveTo') || 'Move to…' }}
    </button>
    <button v-if="ctx.node" class="ftree__ctx-item ftree__ctx-item--danger" @click="$emit('delete', ctx.node)">
      🗑 {{ t('explorer.delete') || 'Delete' }}
    </button>
    <button v-if="ctx.node" class="ftree__ctx-item" @click="$emit('copy-path', ctx.node)">
      📋 {{ t('explorer.copyPath') || 'Copy Path' }}
    </button>
    <button v-if="ctx.node" class="ftree__ctx-item" @click="$emit('copy-rel-path', ctx.node)">
      📋 {{ t('explorer.copyRelPath') || 'Copy Relative Path' }}
    </button>
    <button v-if="ctx.node && !ctx.node.is_dir" class="ftree__ctx-item" @click="$emit('copy-git-url', ctx.node)">
      🔗 {{ t('explorer.copyGitUrl') || 'Copy Git URL' }}
    </button>
    <template v-if="ctx.node && !ctx.node.is_dir && isMmap(ctx.node.path)">
      <div class="ftree__ctx-sep"></div>
      <button class="ftree__ctx-item" @click="$emit('toggle-workbench', ctx.node.path)">
        {{ inWorkbench(ctx.node.path) ? t('mindmap.menuRemoveFromWorkbench') : t('mindmap.menuAddToWorkbench') }}
      </button>
      <button class="ftree__ctx-item" @click="$emit('open-workbench', ctx.node.path)">{{ t('mindmap.menuOpenWorkbench') }}</button>
      <button class="ftree__ctx-item" @click="$emit('copy-map', ctx.node.path)">{{ t('mindmap.menuCopyMap') }}</button>
    </template>
    <!-- #148 follow-up — hidden on mobile: revealItemInDir silently no-ops
         there (no user-reachable file manager can browse the app sandbox
         on Android, and iOS has no Finder), so the item just looked broken. -->
    <template v-if="!isMobile()">
      <div class="ftree__ctx-sep"></div>
      <button class="ftree__ctx-item" @click="$emit('reveal', ctx.node)">
        🔍 {{ t('explorer.reveal') || 'Reveal in Finder' }}
      </button>
    </template>
  </div>
</template>

<style scoped src="./file-tree-menu.css"></style>
