<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../i18n';
import { MINDMAP_MODES, type MindmapMode } from '../lib/mindmap-view-mode';

const props = defineProps<{ mode: MindmapMode; isPanelOpen: boolean; isReadOnly: boolean; isGraphView: boolean }>();
const emit = defineEmits<{ 'set-mode': [mode: MindmapMode]; run: [actionId: string]; 'toggle-panel': [] }>();
const { t } = useI18n();
const isMenuOpen = ref(false);

const MODE_LABEL_KEYS: Record<MindmapMode, string> = { map: 'mindmap.viewMap', source: 'mindmap.viewSource', outline: 'mindmap.viewOutline' };
const EXPORT_ITEMS: readonly { id: string; label: string }[] = [
  { id: 'mindmap.exportPng', label: 'PNG' },
  { id: 'mindmap.exportSvg', label: 'SVG' },
  { id: 'mindmap.exportHtml', label: 'HTML' },
  { id: 'mindmap.exportJson', label: 'JSON' },
  { id: 'mindmap.exportMarkdown', label: 'Markdown' },
  { id: 'mindmap.exportMermaid', label: 'Mermaid' },
  { id: 'mindmap.exportAdjacency', label: 'Adjacency JSON' },
];
const MAP_ONLY_ITEMS: readonly { id: string; labelKey: string }[] = [
  { id: 'mindmap.copyPlaintext', labelKey: 'mindmap.menuCopyPlaintext' },
  { id: 'mindmap.toHeadingsDocument', labelKey: 'mindmap.menuHeadings' },
  { id: 'mindmap.findDuplicates', labelKey: 'mindmap.menuDuplicates' },
  { id: 'mindmap.shortcutHelp', labelKey: 'mindmap.menuShortcuts' },
];

function runAndClose(actionId: string): void {
  isMenuOpen.value = false;
  emit('run', actionId);
}

function isMap(): boolean {
  return props.mode === 'map';
}
</script>

<template>
  <div class="mm-toolbar" role="toolbar">
    <div class="mm-toolbar__modes" role="tablist">
      <button v-for="m in MINDMAP_MODES" :key="m" type="button" role="tab" :aria-selected="mode === m" :class="{ active: mode === m }" @click="emit('set-mode', m)">
        {{ t(MODE_LABEL_KEYS[m]) }}
      </button>
    </div>
    <template v-if="isMap()">
      <button type="button" :title="t('mindmap.toolbarUndo')" :disabled="isReadOnly || isGraphView" @click="emit('run', 'mindmap.undo')">↶</button>
      <button type="button" :title="t('mindmap.toolbarRedo')" :disabled="isReadOnly || isGraphView" @click="emit('run', 'mindmap.redo')">↷</button>
      <button type="button" :title="t('mindmap.toolbarPanel')" :aria-pressed="isPanelOpen" @click="emit('toggle-panel')">▤</button>
    </template>
    <div class="mm-toolbar__more">
      <button type="button" :title="t('mindmap.toolbarMore')" :aria-expanded="isMenuOpen" :disabled="!isMap()" @click="isMenuOpen = !isMenuOpen">⋯</button>
      <div v-if="isMenuOpen" class="mm-toolbar__menu" role="menu" @keydown.escape="isMenuOpen = false">
        <div class="mm-toolbar__group">{{ t('mindmap.menuExport') }}</div>
        <button v-for="item in EXPORT_ITEMS" :key="item.id" type="button" role="menuitem" @click="runAndClose(item.id)">{{ item.label }}</button>
        <hr />
        <button v-for="item in MAP_ONLY_ITEMS" :key="item.id" type="button" role="menuitem" @click="runAndClose(item.id)">{{ t(item.labelKey) }}</button>
        <hr />
        <button type="button" role="menuitemcheckbox" :aria-checked="isGraphView" @click="runAndClose('mindmap.toggleGraphView')">{{ isGraphView ? '✓ ' : '' }}{{ t('mindmap.graphViewBadge') }}</button>
        <button type="button" role="menuitemcheckbox" :aria-checked="isReadOnly" @click="runAndClose('mindmap.toggleReadOnly')">{{ isReadOnly ? '✓ ' : '' }}{{ t('mindmap.readOnlyBadge') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mm-toolbar { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-block-end: 1px solid var(--border); background: var(--bg-elev); color: var(--text); font-size: 12px; }
.mm-toolbar button { padding: 2px 8px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
.mm-toolbar button:disabled { opacity: 0.4; cursor: default; }
.mm-toolbar button.active, .mm-toolbar button[aria-pressed='true'] { border-color: var(--border); background: var(--bg); }
.mm-toolbar__modes { display: flex; gap: 2px; margin-inline-end: 8px; }
.mm-toolbar__more { position: relative; margin-inline-start: auto; }
.mm-toolbar__menu { position: absolute; inset-inline-end: 0; inset-block-start: 100%; z-index: 20; display: flex; flex-direction: column; min-width: 200px; padding: 4px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 4px 16px rgb(0 0 0 / 20%); }
.mm-toolbar__menu button { text-align: start; }
.mm-toolbar__group { padding: 4px 8px; color: var(--text-faint); }
.mm-toolbar__menu hr { width: 100%; border: 0; border-block-start: 1px solid var(--border); }
</style>
