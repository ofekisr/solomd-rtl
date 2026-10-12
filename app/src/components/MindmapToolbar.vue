<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from '../i18n';
import { MINDMAP_LENSES, type MindmapLens } from '../lib/mindmap-lens';

type MenuId = 'export' | 'more';

const props = defineProps<{ lens: MindmapLens; hasMap: boolean; isPanelOpen: boolean; isReadOnly: boolean; isGraphView: boolean }>();
const emit = defineEmits<{ 'set-lens': [lens: MindmapLens]; run: [actionId: string]; 'toggle-panel': [] }>();
const { t } = useI18n();
const openMenu = ref<MenuId | null>(null);

const MENU_HOST_SELECTOR = '.mm-toolbar__menu-host';
const PRIMARY_EXPORT = 'mindmap.exportPng';
const LENS_LABEL_KEYS: Record<MindmapLens, string> = { data: 'mindmap.lensData', map: 'mindmap.lensMap', doc: 'mindmap.lensDoc' };
const EXPORT_ITEMS: readonly { id: string; label: string }[] = [
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
  { id: 'mindmap.findDuplicates', labelKey: 'mindmap.menuDuplicates' },
  { id: 'mindmap.shortcutHelp', labelKey: 'mindmap.menuShortcuts' },
];

function closeOnOutsidePointer(event: PointerEvent): void {
  if (!(event.target as Element | null)?.closest(MENU_HOST_SELECTOR)) openMenu.value = null;
}

watch(openMenu, (menu) => {
  if (menu) document.addEventListener('pointerdown', closeOnOutsidePointer);
  else document.removeEventListener('pointerdown', closeOnOutsidePointer);
});
watch(() => [props.lens, props.hasMap], () => { openMenu.value = null; });
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutsidePointer));

function toggleMenu(menu: MenuId): void {
  openMenu.value = openMenu.value === menu ? null : menu;
}

function runAndClose(actionId: string): void {
  openMenu.value = null;
  emit('run', actionId);
}
</script>

<template>
  <div class="mm-toolbar" role="toolbar">
    <div class="mm-toolbar__modes" role="tablist" :aria-label="t('mindmap.lensLabel')">
      <button v-for="l in MINDMAP_LENSES" :key="l" type="button" role="tab" :aria-selected="lens === l" :class="{ active: lens === l }" @click="emit('set-lens', l)">
        {{ t(LENS_LABEL_KEYS[l]) }}
      </button>
    </div>
    <button type="button" :title="t('mindmap.toolbarUndo')" :aria-label="t('mindmap.toolbarUndo')" :disabled="!hasMap || isReadOnly || isGraphView" @click="emit('run', 'mindmap.undo')">↶</button>
    <button type="button" :title="t('mindmap.toolbarRedo')" :aria-label="t('mindmap.toolbarRedo')" :disabled="!hasMap || isReadOnly || isGraphView" @click="emit('run', 'mindmap.redo')">↷</button>
    <span class="mm-toolbar__sep" aria-hidden="true" />
    <div class="mm-toolbar__split mm-toolbar__menu-host">
      <button type="button" :title="t('mindmap.toolbarExportPng')" :aria-label="t('mindmap.toolbarExportPng')" :disabled="!hasMap" @click="emit('run', PRIMARY_EXPORT)">⬇</button>
      <button type="button" class="mm-toolbar__caret" :title="t('mindmap.toolbarExportFormats')" :aria-label="t('mindmap.toolbarExportFormats')" aria-haspopup="menu" :aria-expanded="openMenu === 'export'" :disabled="!hasMap" @click="toggleMenu('export')">▾</button>
      <div v-if="openMenu === 'export'" class="mm-toolbar__menu" role="menu" @keydown.escape="openMenu = null">
        <button v-for="item in EXPORT_ITEMS" :key="item.id" type="button" role="menuitem" @click="runAndClose(item.id)">{{ item.label }}</button>
      </div>
    </div>
    <button type="button" :title="t('mindmap.toolbarGraph')" :aria-label="t('mindmap.toolbarGraph')" :aria-pressed="isGraphView" :disabled="!hasMap" @click="emit('run', 'mindmap.toggleGraphView')">⇄</button>
    <button type="button" :title="t('mindmap.toolbarReadOnly')" :aria-label="t('mindmap.toolbarReadOnly')" :aria-pressed="isReadOnly" :disabled="!hasMap" @click="emit('run', 'mindmap.toggleReadOnly')">🔒</button>
    <button type="button" :title="t('mindmap.toolbarPanel')" :aria-label="t('mindmap.toolbarPanel')" :aria-pressed="isPanelOpen" :disabled="!hasMap" @click="emit('toggle-panel')">▤</button>
    <div class="mm-toolbar__more mm-toolbar__menu-host">
      <button type="button" :title="t('mindmap.toolbarMore')" :aria-label="t('mindmap.toolbarMore')" aria-haspopup="menu" :aria-expanded="openMenu === 'more'" :disabled="!hasMap" @click="toggleMenu('more')">⋯</button>
      <div v-if="openMenu === 'more'" class="mm-toolbar__menu" role="menu" @keydown.escape="openMenu = null">
        <button v-for="item in MORE_ITEMS" :key="item.id" type="button" role="menuitem" @click="runAndClose(item.id)">{{ t(item.labelKey) }}</button>
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
.mm-toolbar__sep { width: 1px; align-self: stretch; margin-inline: 4px; background: var(--border); }
.mm-toolbar__split { position: relative; display: flex; }
.mm-toolbar__split > button:first-child { border-start-end-radius: 0; border-end-end-radius: 0; }
.mm-toolbar__caret { padding-inline: 4px !important; border-start-start-radius: 0 !important; border-end-start-radius: 0 !important; }
.mm-toolbar__more { position: relative; margin-inline-start: auto; }
.mm-toolbar__menu { position: absolute; inset-inline-end: 0; inset-block-start: 100%; z-index: 20; display: flex; flex-direction: column; min-width: 200px; padding: 4px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 4px 16px rgb(0 0 0 / 20%); }
.mm-toolbar__split .mm-toolbar__menu { inset-inline-end: auto; inset-inline-start: 0; }
.mm-toolbar__menu button { text-align: start; }
</style>
