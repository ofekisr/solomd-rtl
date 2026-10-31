<script setup lang="ts">
import { computed } from 'vue';
import { useWorkspaceStore } from '../../../stores/workspace';
import { useFiles } from '../../../composables/useFiles';
import { useInbox } from '../../../composables/useInbox';
import { useInboxView } from '../../../composables/useInboxView';
import { useSettingsStore } from '../../../stores/settings';
import { entryKey } from '../../../lib/mindmap/workbench';
import { useMindmapWorkbenchStore } from '../../../stores/mindmapWorkbench';
import { fileDraft } from '../../../composables/mindmap/useMindmapWorkbench';
import { useI18n } from '../../../i18n';
import MoveToDialog from '../../../components/dialogs/MoveToDialog.vue';
import { dropTarget } from '../internal/useTreeDrag.ts';
import { createFileTreeState } from '../internal/useFileTreeState.ts';
import { useTreeResize } from '../internal/useTreeResize.ts';
import { useTreeContextActions, isMmap } from '../internal/useTreeContextActions.ts';
import { useTreeSelection } from '../internal/useTreeSelection.ts';
import { useTreeSort } from '../internal/useTreeSort.ts';
import { useTreeLoad } from '../internal/useTreeLoad.ts';
import { useTreeFilter } from '../internal/useTreeFilter.ts';
import { useTreeRefresh } from '../internal/useTreeRefresh.ts';
import { useTreeEdit } from '../internal/useTreeEdit.ts';
import { useTreeMove } from '../internal/useTreeMove.ts';
import { useTreeDragDrop } from '../internal/useTreeDragDrop.ts';
import { useTreeRevealRow } from '../internal/useTreeRevealRow.ts';
import { useTreeDelete } from '../internal/useTreeDelete.ts';
import { useWorkspaceSwitcher } from '../internal/useWorkspaceSwitcher.ts';
import { useTreeWindowKeys } from '../internal/useTreeWindowKeys.ts';
import FileTreeHeader from './FileTreeHeader.vue';
import FileTreeSwitcher from './FileTreeSwitcher.vue';
import FileTreeContextMenu from './FileTreeContextMenu.vue';
import FileTreeDeleteDialog from './FileTreeDeleteDialog.vue';
import { FileTreeNode } from './FileTreeNode.ts';

const workspace = useWorkspaceStore();
const files = useFiles();
const inbox = useInbox();
const inboxView = useInboxView();
const settings = useSettingsStore();
const workbench = useMindmapWorkbenchStore();
const { t } = useI18n();

// v2.4 inbox filter — when on, the FileTreeNode subtree below prunes
// non-inbox files (and dirs whose subtree contains no inbox docs).
const showInboxOnly = computed(() => inbox.filterMode.value);

// Composables are called in the order the original single component registered
// its watchers and lifecycle hooks (LLD S12; file-tree-order.test.ts guards it).
const state = createFileTreeState();
const { root, selected, ctx, isNewFileSubOpen, editing, editInput, treeBody, rootMissing, sortOpen, filterOpen } = state;
const { isResizing, onResizeStart } = useTreeResize();
const menu = useTreeContextActions(state);
const { newEntryParent } = useTreeSelection(state);
const refreshLazily = () => refresh.refreshTreePreservingExpansion();
const sort = useTreeSort(state, { refreshPreservingExpansion: refreshLazily });
const load = useTreeLoad(state, sort);
const filter = useTreeFilter(state, { refreshPreservingExpansion: refreshLazily });
const refresh = useTreeRefresh(state, load, filter);
const edit = useTreeEdit(state, load, sort, refresh, {
  closeCtx: menu.closeCtx,
  showInboxOnly,
  extFilter: filter.extFilter,
});
const move = useTreeMove(refresh, menu.closeCtx);
const { onNodePress } = useTreeDragDrop(state, load, sort, move);
useTreeRevealRow(state, load, { newEntryParent, startNewFile: edit.startNewFile });
const del = useTreeDelete(refresh, menu.closeCtx);
const switcher = useWorkspaceSwitcher();
useTreeWindowKeys(state, switcher, menu.closeCtx);

const { EditRowAtRoot } = edit;
const { extFilter } = filter;

function onNewFileFromMenu(node: { path: string } | null, ext?: string): void {
  void edit.startNewFile(node ? node.path : newEntryParent(), ext);
}
</script>

<template>
  <aside
    class="ftree"
    :class="{ 'ftree--fullnames': settings.explorerFullNames }"
    :style="{ '--file-tree-width': settings.fileTreeWidth + 'px' }"
    @contextmenu.prevent="menu.openCtx($event, null)"
  >
    <!-- Width resize handle -->
    <div
      class="ftree__resize-handle"
      :class="{ 'ftree__resize-handle--active': isResizing }"
      @mousedown="onResizeStart"
    />
    <FileTreeHeader
      :has-root="!!root"
      :has-workspace="!!workspace.currentFolder"
      :local-vault="move.localVault.value"
      :ext-filter="extFilter"
      :ext-list="filter.extList.value"
      :filter-open="filterOpen"
      :sort-open="sortOpen"
      :sort-mode="sort.sortMode.value"
      :show-hidden="settings.explorerShowHidden"
      :ext-label="filter.extLabel"
      :sort-label="sort.sortLabel"
      @new-file="edit.startNewFile(newEntryParent())"
      @open-filter="filter.openFilter"
      @clear-filter="settings.clearExplorerExtFilter()"
      @toggle-ext="settings.toggleExplorerExt($event)"
      @toggle-sort="sort.toggleSortMenu"
      @set-sort="sort.setSortMode"
      @toggle-hidden="settings.toggleExplorerShowHidden()"
      @refresh="refresh.scheduleRefresh"
      @open-folder="files.openFolder()"
      @close-folder="switcher.closeFolder"
    />

    <div v-if="!root" class="ftree__empty">
      <button class="ftree__open-btn" @click="files.openFolder">{{ t('explorer.openFolder') }}</button>
    </div>
    <div v-else ref="treeBody" class="ftree__body">
      <!-- v4.3.5: root display doubles as the workspace switcher. Click
           opens a dropdown listing recent folders + "Open folder…". -->
      <FileTreeSwitcher
        :root="root"
        :open="switcher.switcherOpen.value"
        :is-drop-target="dropTarget === root.path"
        :list="switcher.switcherList.value"
        @toggle="switcher.toggleSwitcher"
        @contextmenu="menu.openCtx($event, root)"
        @pick="switcher.pickRecentFolder"
        @open-folder="switcher.openFolderAndClose"
      />

      <!-- The folder itself is gone (moved in Finder, deleted, drive
           unmounted). Saying so beats an empty tree under its own name,
           which reads as "my notes are gone". -->
      <div v-if="rootMissing" class="ftree__missing">
        <p class="ftree__missing-title">{{ t('explorer.folderMissing') }}</p>
        <p class="ftree__missing-path">{{ root.path }}</p>
        <div class="ftree__missing-actions">
          <button class="ftree__open-btn" @click="files.openFolder">
            {{ t('explorer.folderMissingLocate') }}
          </button>
          <button class="ftree__missing-secondary" @click="workspace.setFolder(null)">
            {{ t('explorer.closeFolder') }}
          </button>
        </div>
      </div>

      <!-- Inline new/rename input. Normally drawn in the tree itself (#321,
           see renderEditRow); here only when a filter hides its target. -->
      <div v-if="editing && !edit.editInTree.value" class="ftree__edit">
        <span class="ftree__icon">{{ editing.kind === 'new-dir' ? '▸' : editing.kind === 'rename' ? '•' : '•' }}</span>
        <input
          ref="editInput"
          v-model="editing.name"
          class="ftree__edit-input"
          spellcheck="false"
          @keydown="edit.onRenameKey"
          @keydown.escape.prevent="edit.cancelEdit"
          @blur="edit.commitEdit"
        />
      </div>

      <!-- v2.4 / v4.6 F6: Inbox row. The chevron toggles the inbox-only tree
           filter (so the tree below shows only `inbox: true` docs); clicking
           the name opens the dedicated InboxView workflow. Gated on the
           v4.6 inbox-workflow opt-out. -->
      <div
        v-if="settings.inboxWorkflowEnabled"
        class="ftree__inbox"
        :class="{ 'ftree__inbox--active': showInboxOnly }"
      >
        <button
          class="ftree__inbox-toggle"
          :title="showInboxOnly ? t('inbox.filterOff') : t('inbox.filterOn')"
          @click="inbox.toggleFilter()"
        >
          <span class="ftree__icon">{{ showInboxOnly ? '▾' : '▸' }}</span>
        </button>
        <button
          class="ftree__inbox-open"
          :title="t('inbox.openView')"
          @click="inboxView.openInbox()"
        >
          <span class="ftree__name">{{ t('inbox.heading') }}</span>
        </button>
        <span class="ftree__badge" v-if="inbox.inboxCount.value > 0">
          {{ inbox.inboxCount.value }}
        </span>
      </div>

      <!-- A persisted filter that hides files must never be invisible. -->
      <div v-if="extFilter.length" class="ftree__filter-banner">
        <span class="ftree__filter-banner-text">
          {{ t('explorer.filterActive', { types: filter.filterLabel.value }) }}
        </span>
        <button class="ftree__filter-banner-clear" @click="settings.clearExplorerExtFilter()">
          {{ t('explorer.filterClear') || 'Clear' }}
        </button>
      </div>

      <div v-if="root.loading" class="ftree__loading">
        <span class="ftree__spinner" aria-hidden="true"></span>
        <span>{{ t('explorer.loading') }}</span>
      </div>
      <ul v-else class="ftree__list" :class="{ 'ftree__list--drop': dropTarget === root.path }">
        <FileTreeNode
          v-for="child in root.children"
          :key="child.path"
          :node="child"
          :depth="0"
          :selected-path="selected?.path ?? ''"
          :inbox-only="showInboxOnly"
          :inbox-paths="inbox.inboxPaths.value"
          :ext-filter="extFilter"
          :filter-dirs="filter.filterDirs.value"
          @toggle="load.toggle"
          @contextmenu="menu.openCtx"
          @press="onNodePress"
        />
        <EditRowAtRoot
          v-if="edit.editInTree.value && editing && editing.kind !== 'rename' && editing.parent === root.path"
        />
        <li v-if="root.truncated" class="ftree__truncated" :title="t('explorer.truncatedHint')">
          {{ t('explorer.truncated') }}
        </li>
      </ul>
    </div>

    <FileTreeContextMenu
      v-if="ctx"
      v-model:sub-open="isNewFileSubOpen"
      :ctx="ctx"
      :sub-flipped="menu.isNewFileSubFlipped.value"
      :sub-raised="menu.isNewFileSubRaised.value"
      :can-move="move.canMove.value"
      :root-path="root?.path"
      :is-mmap="isMmap"
      :in-workbench="(path) => workbench.has(entryKey(fileDraft(path)))"
      @new-file="onNewFileFromMenu"
      @new-folder="edit.startNewFolder($event ? $event.path : newEntryParent())"
      @open-side="menu.openNodeOnSide"
      @rename="edit.startRename"
      @move-to="move.startMoveTo"
      @delete="del.deleteNode"
      @copy-path="menu.copyNodePath"
      @copy-rel-path="menu.copyNodeRelativePath"
      @copy-git-url="menu.copyGitUrl"
      @toggle-workbench="menu.toggleWorkbenchFile"
      @open-workbench="menu.openWorkbenchWith"
      @copy-map="menu.copyMapFile"
      @reveal="menu.revealNode($event ?? root!)"
    />

    <MoveToDialog
      :open="!!move.moveDialog.value"
      :node-name="move.moveDialog.value?.node.name ?? ''"
      :dirs="move.moveDialog.value?.dirs ?? []"
      :current-dir="move.moveDialog.value ? move.relativeToRoot(move.moveDialog.value.node.path).replace(/\/?[^/]+$/, '') : ''"
      :self-dir="move.moveDialog.value?.node.is_dir ? move.relativeToRoot(move.moveDialog.value.node.path) : null"
      @confirm="move.onMovePicked"
      @cancel="move.moveDialog.value = null"
    />

    <FileTreeDeleteDialog
      :target="del.deleteTarget.value"
      @cancel="del.deleteTarget.value = null"
      @confirm="del.confirmDelete"
    />
  </aside>
</template>

<style scoped src="./file-tree.css"></style>
