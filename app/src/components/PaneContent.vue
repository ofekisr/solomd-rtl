<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue';
import { Editor } from '../features/editor/contracts/editor-component.ts';
import Preview from './Preview.vue';
import { useSettingsStore } from '../stores/settings';
import { useTilesStore } from '../stores/tiles';
import type { Tab } from '../types';
import { MINDMAP_CONVERT_EVENT, useMindmapConvert, type LineSelection, type MindmapConvertDetail } from '../composables/useMindmapConvert';
import { isWindowsEditorRuntime, shouldUsePlainWindowsEditor } from '../lib/platform';
import { isVirtualLanguage } from '../lib/virtual-tabs';
import { usePaneScrollSync } from './usePaneScrollSync.ts';

const props = defineProps<{
  paneId: string;
  tab: Tab | undefined;
}>();

const emit = defineEmits<{
  (e: 'cursor', line: number, col: number): void;
  (e: 'selection', text: string): void;
}>();

const settings = useSettingsStore();
const tiles = useTilesStore();

const editorRef = ref<InstanceType<typeof Editor> | null>(null);
const mindmapRef = ref<{ openFind?: () => void } | null>(null);
const previewRef = ref<InstanceType<typeof Preview> | null>(null);

const MindmapView = defineAsyncComponent(() => import('./MindmapView.vue'));

const GitDiff = defineAsyncComponent(() => import('./git/GitDiff.vue'));

const ThemeStudioTab = defineAsyncComponent(() => import('./ThemeStudioTab.vue'));

const isMindmap = computed(() => props.tab?.language === 'mindmap');
const isGitDiff = computed(() => props.tab?.language === 'git-diff');
const isThemeStudio = computed(() => props.tab?.language === 'theme-studio');

const showEditor = computed(
  () => !isMindmap.value && !isVirtualLanguage(props.tab?.language) && (props.tab?.language !== 'markdown' || settings.viewMode !== 'preview')
);
// `liveEdit` mode is editor-only: the inline-rendered markdown IS the
// preview, so we don't show the separate Preview pane next to it.
const showPreview = computed(
  () =>
    props.tab?.language === 'markdown' &&
    settings.viewMode !== 'edit' &&
    settings.viewMode !== 'liveEdit'
);

const isFocused = computed(() => tiles.focusedPaneId === props.paneId);
const windowsEditorRuntime = isWindowsEditorRuntime();
// Preserve CodeMirror history/caret on macOS and Linux. Only Windows needs a
// remount because toggling Vim or the editor engine changes the editor
// implementation itself.
const editorImplementationKey = computed(() => {
  if (!windowsEditorRuntime) return `${props.paneId}:codemirror`;
  const plain = shouldUsePlainWindowsEditor(true, settings.vimMode, settings.windowsEditorEngine);
  return `${props.paneId}:${plain ? 'plain' : 'codemirror'}`;
});

function onCursor(line: number, col: number) {
  if (isFocused.value) {
    emit('cursor', line, col);
  }
}

function onSelection(text: string) {
  if (isFocused.value) {
    emit('selection', text);
  }
}

function gotoLine(line: number) {
  if (settings.viewMode === 'preview') {
    previewRef.value?.scrollToLine(line);
  } else {
    editorRef.value?.gotoLine(line);
  }
}


onMounted(() => {
  window.addEventListener('solomd:outline-goto', onOutlineGotoEvent);
  window.addEventListener('solomd:insert-markdown', onInsertMarkdownEvent);
  window.addEventListener(MINDMAP_CONVERT_EVENT, onMindmapConvertEvent);
  window.addEventListener('solomd:insert-image-path', onInsertImagePathEvent);
  window.addEventListener('solomd:insert-image-url', onInsertImageUrlEvent);
  window.addEventListener('solomd:upload-local-images', onUploadLocalImagesEvent);
  window.addEventListener('solomd:editor-find', onEditorFindEvent);
  window.addEventListener('solomd:preview-search', onPreviewSearchEvent);
  window.addEventListener('solomd:fold', onFoldEvent);
  window.addEventListener('solomd:edit-table', onEditTableEvent);
  window.addEventListener('solomd:edit-formula', onEditFormulaEvent);
});

onBeforeUnmount(() => {
  window.removeEventListener('solomd:outline-goto', onOutlineGotoEvent);
  window.removeEventListener('solomd:insert-markdown', onInsertMarkdownEvent);
  window.removeEventListener(MINDMAP_CONVERT_EVENT, onMindmapConvertEvent);
  window.removeEventListener('solomd:insert-image-path', onInsertImagePathEvent);
  window.removeEventListener('solomd:insert-image-url', onInsertImageUrlEvent);
  window.removeEventListener('solomd:upload-local-images', onUploadLocalImagesEvent);
  window.removeEventListener('solomd:editor-find', onEditorFindEvent);
  window.removeEventListener('solomd:preview-search', onPreviewSearchEvent);
  window.removeEventListener('solomd:fold', onFoldEvent);
  window.removeEventListener('solomd:edit-table', onEditTableEvent);
  window.removeEventListener('solomd:edit-formula', onEditFormulaEvent);
});

usePaneScrollSync({ paneId: () => props.paneId, tabId: () => props.tab?.id, editorRef });

defineExpose({ gotoLine, editorRef });

// #350 — preview mode has no editor cursor to follow, so hand the preview's
// reading position to the outline instead. Split mode keeps the cursor.
function onPreviewTopline(line: number) {
  if (settings.viewMode !== 'preview') return;
  window.dispatchEvent(new CustomEvent('solomd:preview-topline', {
    detail: { line, paneId: props.paneId },
  }));
}

function onOutlineGotoEvent(e: Event) {
  const { line, paneId } = (e as CustomEvent).detail;
  if (paneId !== props.paneId) return;
  gotoLine(line);
}

const mindmapConvert = useMindmapConvert();

function onMindmapConvertEvent(e: Event) {
  const { scope, output, paneId } = (e as CustomEvent<MindmapConvertDetail>).detail;
  if (paneId !== props.paneId) return;
  if (!props.tab) return;
  window.dispatchEvent(new Event('solomd:flush-content-sync'));
  const ed = editorRef.value as unknown as { getLineSelection?: () => LineSelection | null } | null;
  void mindmapConvert.convert(props.tab, scope, output, ed?.getLineSelection?.() ?? null);
}

function onInsertMarkdownEvent(e: Event) {
  const { snippet, paneId } = (e as CustomEvent).detail;
  if (paneId !== props.paneId) return;
  const ed = editorRef.value as unknown as { insertMarkdown?: (s: string) => void } | null;
  ed?.insertMarkdown?.(snippet);
}

function onInsertImagePathEvent(e: Event) {
  const { path, paneId } = (e as CustomEvent).detail;
  if (paneId !== props.paneId) return;
  const ed = editorRef.value as unknown as { insertImageFromPath?: (p: string) => void } | null;
  ed?.insertImageFromPath?.(path);
}

function onInsertImageUrlEvent(e: Event) {
  const { url, alt, paneId } = (e as CustomEvent).detail;
  if (paneId !== props.paneId) return;
  const ed = editorRef.value as unknown as { insertImageUrl?: (u: string, a?: string) => void } | null;
  ed?.insertImageUrl?.(url, alt || '');
}

function onUploadLocalImagesEvent(e: Event) {
  const { paneId } = (e as CustomEvent).detail;
  if (paneId !== props.paneId) return;
  const ed = editorRef.value as unknown as { uploadLocalImages?: () => void } | null;
  ed?.uploadLocalImages?.();
}

function onEditorFindEvent(e: Event) {
  const { paneId } = (e as CustomEvent).detail || {};
  // No paneId → the focused pane handles it.
  if (paneId && paneId !== props.paneId) return;
  if (!paneId && !isFocused.value) return;
  if (isMindmap.value) {
    mindmapRef.value?.openFind?.();
    return;
  }
  const ed = editorRef.value as unknown as { openFind?: () => void } | null;
  ed?.openFind?.();
}

/** Formula editor — same focused-pane routing as find. */
function onEditFormulaEvent(e: Event) {
  const { paneId } = (e as CustomEvent).detail || {};
  if (paneId && paneId !== props.paneId) return;
  if (!paneId && !isFocused.value) return;
  const ed = editorRef.value as unknown as { openFormulaAtCursor?: () => void } | null;
  ed?.openFormulaAtCursor?.();
}

/** Grid table editor — same focused-pane routing as find. */
function onEditTableEvent(e: Event) {
  const { paneId } = (e as CustomEvent).detail || {};
  if (paneId && paneId !== props.paneId) return;
  if (!paneId && !isFocused.value) return;
  const ed = editorRef.value as unknown as { openTableAtCursor?: () => void } | null;
  ed?.openTableAtCursor?.();
}

/** Heading folding — same focused-pane routing as find (#fold). */
function onFoldEvent(e: Event) {
  const { paneId, action, level } = (e as CustomEvent).detail || {};
  if (paneId && paneId !== props.paneId) return;
  if (!paneId && !isFocused.value) return;
  const ed = editorRef.value as unknown as {
    applyFold?: (a: string, l?: number) => void;
  } | null;
  ed?.applyFold?.(action || 'toggle', level);
}

function onPreviewSearchEvent(e: Event) {
  const { paneId } = (e as CustomEvent).detail;
  if (paneId !== props.paneId) return;
  (previewRef.value as unknown as { openSearch?: () => void } | null)?.openSearch?.();
}
</script>

<template>
  <!-- #279 — "now they all look the same, which is a bit tiring": side by side, the two panes are the same
       surface, so the split reads as one wide column. The opt-in class lifts
       the preview a shade; it only applies when BOTH panes are on screen,
       because there is nothing to tell apart otherwise. -->
  <div
    class="pane-content"
    :class="{
      'pane-content--distinct': settings.distinctSplitPanes && showEditor && showPreview,
    }"
  >
    <div class="pane pane--git-diff" v-if="isGitDiff && tab">
      <GitDiff :key="tab.id" :uri="tab.filePath ?? ''" />
    </div>
    <div class="pane pane--theme-studio" v-if="isThemeStudio && tab">
      <ThemeStudioTab :key="tab.id" />
    </div>
    <div class="pane pane--mindmap" v-if="isMindmap && tab">
      <MindmapView :key="tab.id" ref="mindmapRef" :tab="tab" />
    </div>
    <div class="pane pane--editor" v-if="showEditor && tab">
      <Editor
        :key="editorImplementationKey"
        ref="editorRef"
        :tab="tab"
        :focus-mode="settings.focusMode"
        :typewriter-mode="settings.typewriterMode"
        :spell-check="settings.spellCheck"
        @cursor="onCursor"
        @selection="onSelection"
      />
    </div>
    <div class="pane pane--preview" v-if="showPreview && tab">
      <Preview
        ref="previewRef"
        :source="tab.content"
        :file-path="tab.filePath"
        :tab-id="tab.id"
        @topline="onPreviewTopline"
      />
    </div>
  </div>
</template>

<style scoped>
.pane-content {
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
/* #168 phone layout for these panes lives in styles/main.css — a scoped
   block can't reach it: `:global(.x) .y` compiles down to `.x` here. */
.pane {
  flex: 1;
  min-width: 0;
  height: 100%;
}
.pane--editor + .pane--preview {
  border-left: 1px solid var(--border);
}
</style>
