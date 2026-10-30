<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../i18n';
import { MINDMAP_LENSES, type MindmapLens } from '../lib/mindmap/lens';
import { MINDMAP_LAYOUT } from '../lib/mindmap/direction';
import type { MindmapIconName } from './MindmapIcon.vue';
import MindmapDock from './MindmapDock.vue';
import MindmapDockButton from './MindmapDockButton.vue';
import MindmapDockFlyout, { type FlyoutOption } from './MindmapDockFlyout.vue';

export interface RailState {
  readonly lens: MindmapLens;
  readonly hasCanvas: boolean;
  readonly direction: number;
  readonly isPanelOpen: boolean;
  readonly isDetailsOpen: boolean;
  readonly isReadOnly: boolean;
  readonly isPinStripOpen: boolean;
  readonly isSnippetsOpen: boolean;
  readonly isLocked: boolean;
  readonly isFocused: boolean;
}

const props = defineProps<{ state: RailState }>();
const emit = defineEmits<{ 'set-lens': [lens: MindmapLens]; run: [actionId: string]; 'toggle-panel': [] }>();
const { t } = useI18n();

const LENS_ICONS: Record<MindmapLens, MindmapIconName> = { data: 'lens-data', map: 'lens-map', doc: 'lens-doc' };
const LENS_LABEL_KEYS: Record<MindmapLens, string> = { data: 'mindmap.lensData', map: 'mindmap.lensMap', doc: 'mindmap.lensDoc' };
const DIRECTIONS: readonly { layout: number; actionId: string; icon: MindmapIconName; labelKey: string }[] = [
  { layout: MINDMAP_LAYOUT.LEFT, actionId: 'mindmap.layoutLeft', icon: 'dir-left', labelKey: 'mindmap.layoutLeft' },
  { layout: MINDMAP_LAYOUT.RIGHT, actionId: 'mindmap.layoutRight', icon: 'dir-right', labelKey: 'mindmap.layoutRight' },
  { layout: MINDMAP_LAYOUT.SIDE, actionId: 'mindmap.layoutSide', icon: 'dir-side', labelKey: 'mindmap.layoutSide' },
  { layout: MINDMAP_LAYOUT.DOWN, actionId: 'mindmap.layoutDown', icon: 'dir-down', labelKey: 'mindmap.layoutDown' },
];
const EXPORT_OPTIONS: readonly FlyoutOption[] = [
  { id: 'mindmap.exportPng', label: 'PNG' },
  { id: 'mindmap.exportSvg', label: 'SVG' },
  { id: 'mindmap.exportHtml', label: 'HTML' },
  { id: 'mindmap.exportJson', label: 'JSON' },
  { id: 'mindmap.exportMarkdown', label: 'Markdown' },
  { id: 'mindmap.exportMermaid', label: 'Mermaid' },
  { id: 'mindmap.exportAdjacency', label: 'Adjacency JSON' },
];
const MORE_ITEMS: readonly { id: string; labelKey: string }[] = [
  { id: 'mindmap.copyPlaintext', labelKey: 'mindmap.menuCopyPlaintext' },
  { id: 'mindmap.toHeadingsDocument', labelKey: 'mindmap.menuHeadings' },
  { id: 'mindmap.shortcutHelp', labelKey: 'mindmap.menuShortcuts' },
];

const lensOptions = computed<FlyoutOption[]>(() => MINDMAP_LENSES.map((l) => ({ id: l, label: t(LENS_LABEL_KEYS[l]), icon: LENS_ICONS[l] })));
const directionOptions = computed<FlyoutOption[]>(() => DIRECTIONS.map((d) => ({ id: d.actionId, label: t(d.labelKey), icon: d.icon })));
const currentDirection = computed(() => DIRECTIONS.find((d) => d.layout === props.state.direction) ?? DIRECTIONS[2]);
const moreOptions = computed<FlyoutOption[]>(() => MORE_ITEMS.map((m) => ({ id: m.id, label: t(m.labelKey) })));
const isHistoryBlocked = computed(() => props.state.isLocked || props.state.isReadOnly);
const isDirectionBlocked = computed(() => props.state.isLocked || props.state.isFocused);

function pickLens(id: string): void {
  emit('set-lens', id as MindmapLens);
}
</script>

<template>
  <MindmapDock :corner="state.hasCanvas ? 'top-start' : 'top-end'" :orientation="state.hasCanvas ? 'column' : 'row'" :label="t('mindmap.dockView')">
    <MindmapDockFlyout :icon="LENS_ICONS[state.lens]" :label="t('mindmap.lensLabel')" :options="lensOptions" :selected-id="state.lens" @pick="pickLens" />
    <template v-if="state.hasCanvas">
      <MindmapDockFlyout :icon="currentDirection.icon" :label="t('mindmap.dockDirection')" :options="directionOptions" :selected-id="currentDirection.actionId" :disabled="isDirectionBlocked" @pick="(id) => emit('run', id)" />
      <MindmapDockButton icon="lock" :label="t('mindmap.toolbarReadOnly')" :pressed="state.isReadOnly" :disabled="state.isLocked" @click="emit('run', 'mindmap.toggleReadOnly')" />
      <MindmapDockButton icon="panel" :label="t('mindmap.toolbarPanel')" :pressed="state.isPanelOpen" @click="emit('toggle-panel')" />
      <MindmapDockButton icon="details" :label="t('mindmap.toolbarDetails')" :pressed="state.isDetailsOpen" @click="emit('run', 'mindmap.toggleDetails')" />
      <MindmapDockButton icon="pin" :label="t('mindmap.toolbarPinStrip')" :pressed="state.isPinStripOpen" @click="emit('run', 'mindmap.togglePinStrip')" />
      <MindmapDockButton icon="snippets" :label="t('mindmap.toolbarSnippets')" :pressed="state.isSnippetsOpen" @click="emit('run', 'mindmap.toggleSnippets')" />
      <span class="mm-dock-sep" aria-hidden="true" />
      <MindmapDockButton icon="undo" :label="t('mindmap.toolbarUndo')" :disabled="isHistoryBlocked" @click="emit('run', 'mindmap.undo')" />
      <MindmapDockButton icon="redo" :label="t('mindmap.toolbarRedo')" :disabled="isHistoryBlocked" @click="emit('run', 'mindmap.redo')" />
      <span class="mm-dock-sep" aria-hidden="true" />
      <MindmapDockFlyout icon="export" :label="t('mindmap.toolbarExportFormats')" :options="EXPORT_OPTIONS" @pick="(id) => emit('run', id)" />
      <MindmapDockFlyout icon="more" :label="t('mindmap.toolbarMore')" :options="moreOptions" @pick="(id) => emit('run', id)" />
    </template>
  </MindmapDock>
</template>
