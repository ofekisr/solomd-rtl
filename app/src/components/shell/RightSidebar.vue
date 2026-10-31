<script setup lang="ts">
import Outline from '../panels/Outline.vue';
import BacklinksPanel from '../panels/BacklinksPanel.vue';
import NeighborhoodPanel from '../panels/NeighborhoodPanel.vue';
import RelationshipsPanel from '../panels/RelationshipsPanel.vue';
import TagsPanel from '../panels/TagsPanel.vue';
import TasksPanel from '../panels/TasksPanel.vue';
import TypesPanel from '../panels/TypesPanel.vue';
import HistoryPanel from '../panels/HistoryPanel.vue';
import PropertiesInspector from '../PropertiesInspector.vue';
import AgentPanel from '../ai/AgentPanel.vue';
import GlobalSearch from '../GlobalSearch.vue';
import RsSplitter from '../RsSplitter.vue';
import { useRightSidebar } from '../../composables/useRightSidebar';
import { useRsPaneReorder } from '../../composables/useRsPaneReorder';
import { useEditorCursor } from '../../composables/useEditorCursor';
import { useAppDialogs } from '../../composables/useAppDialogs';
import { useSettingsStore } from '../../stores/settings';
import { useI18n } from '../../i18n';

/** Which edge of the editor the strip sits on (`settings.outlineSide`). */
const props = defineProps<{ side: 'left' | 'right' }>();

const settings = useSettingsStore();
const { t } = useI18n();
const { searchOpen, searchPrefill, searchPreset, visiblePanes, paneStyle, widthStyle, startResize, openCtx, ctxToggle, onFilterTag } =
  useRightSidebar();
const { draggingPaneId, dragOverPaneId, startPaneReorder } = useRsPaneReorder();
const { outlineLine, onOutlineGoto } = useEditorCursor();
const { openSettingsAt } = useAppDialogs();

/** The resize handle sits on the edge facing the editor. */
const resizeEdge = props.side === 'left' ? 'right' : 'left';
</script>

<template>
  <aside
    :class="['side-sidebar', `side-sidebar--${props.side}`]"
    :style="widthStyle"
    @contextmenu.prevent="openCtx"
  >
    <div :class="['side-sidebar__resize', `side-sidebar__resize--${resizeEdge}`]" @mousedown="startResize(props.side, $event)" />
    <template v-for="(id, idx) in visiblePanes" :key="id">
      <RsSplitter v-if="idx > 0" :above="visiblePanes[idx - 1]" :below="id" />
      <div
        :data-rs-pane="id"
        :class="[
          'rs-pane-host',
          `rs-pane-host--${id}`,
          draggingPaneId === id ? 'rs-pane-host--dragging' : '',
          dragOverPaneId === id ? 'rs-pane-host--drop-target' : '',
        ]"
        :style="paneStyle(id)"
      >
        <div class="rs-pane-grip" :title="t('rsPane.dragToReorder')" @pointerdown="startPaneReorder($event, id)">⋮⋮</div>
        <GlobalSearch v-if="id === 'search'" :prefill="searchPrefill" :preset="searchPreset" @close="searchOpen = false" />
        <Outline v-if="id === 'outline'" :cursor-line="outlineLine" @goto="onOutlineGoto" />
        <BacklinksPanel v-if="id === 'backlinks'" @close="ctxToggle(() => settings.toggleBacklinks())" />
        <RelationshipsPanel v-if="id === 'relationships'" @close="ctxToggle(() => settings.toggleRelationships())" />
        <TagsPanel v-if="id === 'tags'" @close="ctxToggle(() => settings.toggleTagsPanel())" @filter-tag="onFilterTag" />
        <TasksPanel v-if="id === 'tasks'" @close="ctxToggle(() => settings.toggleTasksPanel())" />
        <NeighborhoodPanel v-if="id === 'neighborhood'" @close="ctxToggle(() => settings.toggleNeighborhood())" />
        <TypesPanel v-if="id === 'types'" @close="ctxToggle(() => settings.toggleTypesPanel())" />
        <HistoryPanel v-if="id === 'history'" @close="ctxToggle(() => settings.toggleHistoryPanel())" />
        <PropertiesInspector v-if="id === 'inspector'" @close="ctxToggle(() => settings.toggleInspector())" />
        <AgentPanel
          v-if="id === 'agent'"
          @open-settings="(section?: string) => openSettingsAt(section ?? 'integrations')"
          @close="ctxToggle(() => settings.toggleAgentPanel())"
        />
      </div>
    </template>
  </aside>
</template>

<style scoped>
.side-sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 260px;
  flex: 0 0 260px;
  min-width: 240px;
  background: var(--bg-soft, var(--bg));
}
.side-sidebar--left {
  border-right: 1px solid var(--border);
}
.side-sidebar--right {
  border-left: 1px solid var(--border);
}
/* #168 — on a phone the strip floats over the editor as a drawer. */
.app--narrow .side-sidebar {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 40;
  width: min(86vw, 320px);
  max-width: 86vw;
  flex: none;
  min-width: 0;
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.28);
}
.app--narrow .side-sidebar--right {
  right: 0;
}
.app--narrow .side-sidebar--left {
  left: 0;
}
/* Live-resize hit zone on the edge facing the editor. */
.side-sidebar__resize {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  z-index: 10;
  background: transparent;
}
.side-sidebar__resize--right {
  right: -4px;
}
.side-sidebar__resize--left {
  left: -4px;
}
.side-sidebar__resize:hover {
  background: var(--accent, #6366f1);
  opacity: 0.5;
}
/* The drag-to-resize handles are a mouse affordance and a touch trap. */
.app--narrow .side-sidebar__resize {
  display: none;
}
/* v4.0.2 — each pane sits in an .rs-pane-host so <RsSplitter> can find
   neighbours via [data-rs-pane] and resize them. */
.rs-pane-host {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
}
/* Agent chat gets 4× the share of read-only panes until a splitter is dragged. */
.rs-pane-host--agent {
  flex: 4 1 0;
  min-height: 240px;
}
.rs-pane-host > :deep(*) {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}
.rs-pane-host :deep(.outline) {
  width: 100% !important;
  border-left: 0;
  border-right: 0;
}
.rs-pane-host :deep(.backlinks) {
  border-left: 0;
  border-right: 0;
}
.rs-pane-host :deep(.rel) {
  border-left: 0;
  border-right: 0;
}
/* v4.3.0 #57b — only the grip drags, so text selection in the pane still works. */
.rs-pane-grip {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 10px;
  flex: 0 0 10px;
  color: var(--text-faint);
  font-size: 8px;
  letter-spacing: 2px;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  /* #131 — keep a vertical drag on the grip from becoming a scroll gesture. */
  touch-action: none;
  background: transparent;
  transition: background 120ms, color 120ms;
}
.rs-pane-grip:hover {
  background: var(--bg-hover);
  color: var(--text-muted);
}
.rs-pane-grip:active {
  cursor: grabbing;
}
.rs-pane-host--dragging {
  opacity: 0.4;
}
.rs-pane-host--drop-target {
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
}
.rs-pane-host > .rs-pane-grip + :deep(*) {
  flex: 1 1 0;
  min-height: 0;
}
</style>
