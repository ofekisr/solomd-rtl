<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue';
import Toolbar from '../Toolbar.vue';
import TelemetryBanner from '../TelemetryBanner.vue';
import TileRoot from '../TileRoot.vue';
import StatusBar from '../StatusBar.vue';
import TableEditor from '../TableEditor.vue';
import FormulaEditor from '../FormulaEditor.vue';
import FileTree from '../FileTree.vue';
import ViewsPanel from '../ViewsPanel.vue';
import ViewNoteList from '../ViewNoteList.vue';
import BasesView from '../BasesView.vue';
import InboxView from '../InboxView.vue';
import TypeLensView from '../TypeLensView.vue';
import GitCommitPanel from '../git/GitCommitPanel.vue';
import RightSidebar from './RightSidebar.vue';
import SidebarContextMenu from './SidebarContextMenu.vue';
import { useRightSidebar } from '../../composables/useRightSidebar';
import { useEditorCursor } from '../../composables/useEditorCursor';
import { useAppDialogs } from '../../composables/useAppDialogs';
import { useCenterView } from '../../composables/useCenterView';
import { useGitPaneAvailable } from '../../composables/useGitPaneAvailable';
import { useSettingsStore } from '../../stores/settings';
import { useTilesStore } from '../../stores/tiles';
import { tableEditor, closeTableEditor } from '../../lib/table-editor-bus';
import { formulaEditor, closeFormulaEditor } from '../../lib/formula-editor-bus';

const GitBottomDock = defineAsyncComponent(() => import('../git/GitBottomDock.vue'));
const GitPushDialog = defineAsyncComponent(() => import('../git/GitPushDialog.vue'));
const GitCheckoutDialog = defineAsyncComponent(() => import('../git/GitCheckoutDialog.vue'));
const GitPromptDialog = defineAsyncComponent(() => import('../git/GitPromptDialog.vue'));

/** Editing-mode chrome: toolbar, three-column workspace, status bar. Reading mode swaps all of it out. */
const settings = useSettingsStore();
const tiles = useTilesStore();
const { isVisible: isRightSidebarVisible, narrowDrawer, closeNarrowDrawer, toggleGlobalSearch } = useRightSidebar();
const { cursorLine, cursorCol, selectionText, onCursor, onSelection } = useEditorCursor();
const { paletteOpen, helpOpen, openSettingsAt } = useAppDialogs();
const { basesOpen, inboxViewOpen, typeLensOpen, typeLensName, viewPaneVisible } = useCenterView();

const isGitPaneAvailable = useGitPaneAvailable();
const showGitCommit = computed(() => isGitPaneAvailable.value && settings.showGitCommit);
const showGitLog = computed(() => isGitPaneAvailable.value && settings.showGitLog);
const gitCommitRef = ref<InstanceType<typeof GitCommitPanel> | null>(null);

watch(showGitCommit, (isShown) => {
  if (isShown) void nextTick(() => gitCommitRef.value?.focusMessage());
});
</script>

<template>
  <Toolbar
    @open-palette="paletteOpen = true"
    @open-settings="openSettingsAt()"
    @open-help="helpOpen = true"
    @open-search="toggleGlobalSearch()"
  />
  <TelemetryBanner />
  <div class="workspace">
    <!-- #168 — on a phone the side panes float over the editor; this catches the dismissing tap. -->
    <div v-if="narrowDrawer" class="workspace__scrim" aria-hidden="true" @click="closeNarrowDrawer" />
    <div v-if="settings.showFileTree || settings.showViewsPanel || showGitCommit" class="left-stack">
      <FileTree v-if="settings.showFileTree" />
      <ViewsPanel v-if="settings.showViewsPanel" />
      <GitCommitPanel v-if="showGitCommit" ref="gitCommitRef" />
    </div>
    <RightSidebar v-if="isRightSidebarVisible && settings.outlineSide === 'left'" side="left" />
    <div class="content">
      <div class="content__main">
        <BasesView v-if="basesOpen" />
        <InboxView v-else-if="inboxViewOpen" />
        <TypeLensView v-else-if="typeLensOpen" :type-name="typeLensName" />
        <ViewNoteList v-else-if="viewPaneVisible" />
        <TileRoot v-else :node="tiles.root" @cursor="onCursor" @selection="onSelection" />
      </div>
      <GitBottomDock v-if="showGitLog" />
      <GitPromptDialog />
      <template v-if="isGitPaneAvailable">
        <GitPushDialog />
        <GitCheckoutDialog />
      </template>
    </div>
    <RightSidebar v-if="isRightSidebarVisible && settings.outlineSide !== 'left'" side="right" />
  </div>
  <StatusBar :line="cursorLine" :col="cursorCol" :selection-text="selectionText" />
  <!-- Grid editor for the table under the caret; the pane supplies the write-back closure. -->
  <TableEditor
    v-if="tableEditor.session"
    :source="tableEditor.session.source"
    @apply="(md: string) => tableEditor.session?.apply(md)"
    @close="closeTableEditor()"
  />
  <FormulaEditor
    v-if="formulaEditor.session"
    :latex="formulaEditor.session.latex"
    :display="formulaEditor.session.display"
    :labels="formulaEditor.session.labels"
    @apply="(latex: string, display: boolean) => formulaEditor.session?.apply(latex, display)"
    @close="closeFormulaEditor()"
  />
  <SidebarContextMenu />
</template>

<style scoped>
.workspace {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}
/* #168 — phone shell: side panes float over the editor as drawers
   (keyed off `.app--narrow`, see composables/useViewport.ts). */
.app--narrow .workspace {
  position: relative;
}
.app--narrow .left-stack {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  width: min(86vw, 320px);
  max-width: 86vw;
  flex: none;
  min-width: 0;
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.28);
}
.workspace__scrim {
  position: absolute;
  inset: 0;
  z-index: 35;
  background: rgba(0, 0, 0, 0.32);
  border: 0;
  padding: 0;
}
.app--narrow .content {
  flex: 1 1 100%;
  min-width: 0;
}
/* v4.6 F5 — left column stacks the file tree above the Saved Views panel. */
.left-stack {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 0 0 auto;
}
.left-stack > :deep(.ftree) {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
}
.app--mobile .left-stack > :deep(.ftree) {
  width: 100%;
}
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  position: relative;
}
.content__main {
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
</style>
