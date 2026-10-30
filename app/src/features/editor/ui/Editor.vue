<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { EditorView } from '@codemirror/view';
import { useFormatHints } from '../../../composables/useFormatHints';
import { useI18n } from '../../../i18n';
import { isWindowsEditorRuntime, shouldUsePlainWindowsEditor } from '../../../lib/platform';
import { useSettingsStore } from '../../../stores/settings';
import { useTabsStore } from '../../../stores/tabs';
import { useThemeStore } from '../../../stores/theme';
import { useToastsStore } from '../../../stores/toasts';
import type { Tab } from '../../../types';
import { EditorContextMenu } from '../../context-menu/contracts/context-menu-component.ts';
import { useCitations } from '../../completion/contracts/citations.ts';
import { useCmContextMenu } from '../../context-menu/contracts/index.ts';
import { imagePasteOptionsFor } from '../../image-upload/contracts/index.ts';
import type { EditorApi, FoldAction } from '../contracts/editor-api.port.ts';
import { cmGetLineSelection, cmGetViewLine, cmGotoLine, cmLineTopY, cmScrollToLine } from '../internal/cm-api.ts';
import { createEditorContext } from '../internal/editor-context.ts';
import { useCmTabSwitch } from '../internal/useCmTabSwitch.ts';
import { useCmView } from '../internal/useCmView.ts';
import { useEditorFeatures } from '../internal/useEditorFeatures.ts';
import { createEditorRegistry } from '../../../shell/editor-registry.service.ts';
import PlainEditor from './PlainEditor.vue';

const props = withDefaults(
  defineProps<{
    tab: Tab;
    focusMode?: boolean;
    typewriterMode?: boolean;
    spellCheck?: boolean;
  }>(),
  {
    focusMode: false,
    typewriterMode: false,
    spellCheck: true,
  },
);
const emit = defineEmits<{
  (e: 'cursor', line: number, col: number): void;
  (e: 'selection', text: string): void;
}>();

const tabs = useTabsStore();
const settings = useSettingsStore();
const themeStore = useThemeStore();
const toasts = useToastsStore();
const { t } = useI18n();

const host = ref<HTMLDivElement | null>(null);
const plainRef = ref<InstanceType<typeof PlainEditor> | null>(null);

// Windows uses a plain <textarea>: WebView2's contentEditable IME path drops the first character and doubles CJK
// punctuation (not fixable inside CodeMirror). Opting into Vim or choosing CodeMirror in Settings switches engine;
// PaneContent keys the editor by those settings so the switch remounts immediately (#194, #328, #344).
// `?forcePlain` forces the plain engine on any OS (dev/test hook, inert for real users).
const usePlainWindowsEditor = shouldUsePlainWindowsEditor(
  isWindowsEditorRuntime(),
  settings.vimMode,
  settings.windowsEditorEngine,
);

let cm: ReturnType<typeof useCmView> | null = null;
const registry = createEditorRegistry();
const ctx = createEditorContext({
  props,
  settings,
  themeMode: () => themeStore.mode,
  t,
  tabs,
  toasts,
  view: (): EditorView | null => cm?.view() ?? null,
  citations: useCitations(),
});
const features = useEditorFeatures(registry, ctx);
ctx.bind(features, registry);
cm = useCmView({
  host,
  ctx,
  features,
  emitCursor: (line, col) => emit('cursor', line, col),
  emitSelection: (text) => emit('selection', text),
  noteTypedFormat: useFormatHints(),
});
useCmTabSwitch({ props, cm, features });
const menu = useCmContextMenu(() => cm?.view() ?? null);

onMounted(() => {
  if (!usePlainWindowsEditor) cm?.mount();
});
onBeforeUnmount(() => cm?.unmount());

function viewOr<T>(read: (view: EditorView) => T): T | null {
  const view = cm?.view();
  return view ? read(view) : null;
}

const editorApi: EditorApi = {
  getLineSelection: () => (usePlainWindowsEditor ? plainRef.value?.getLineSelection() ?? null : viewOr(cmGetLineSelection)),
  gotoLine: (line) => (usePlainWindowsEditor ? plainRef.value?.gotoLine(line) : void viewOr((v) => cmGotoLine(v, line))),
  insertImageFromPath: async (srcPath) => {
    if (usePlainWindowsEditor) return plainRef.value?.insertImageFromPath(srcPath);
    await features.run('insertImageFromPath', srcPath);
  },
  insertImageUrl: (url, alt = '') => {
    if (usePlainWindowsEditor) return plainRef.value?.insertImageUrl(url, alt);
    features.run('insertImageUrl', url, alt);
  },
  uploadLocalImages: async () => {
    if (usePlainWindowsEditor) return plainRef.value?.uploadLocalImages();
    await features.run('uploadLocalImages');
  },
  getViewLine: () => (usePlainWindowsEditor ? plainRef.value?.getViewLine() ?? null : viewOr(cmGetViewLine)),
  scrollToLine: (line) => (usePlainWindowsEditor ? plainRef.value?.scrollToLine(line) : void viewOr((v) => cmScrollToLine(v, line))),
  lineTopY: (line) => (usePlainWindowsEditor ? plainRef.value?.lineTopY(line) ?? null : viewOr((v) => cmLineTopY(v, line))),
  insertMarkdown: (snippet) => (usePlainWindowsEditor ? plainRef.value?.insertMarkdown(snippet) : void features.run('insertMarkdown', snippet)),
  openFind: () => (usePlainWindowsEditor ? plainRef.value?.openFind() : void features.run('openFind')),
  applyFold: (action: FoldAction, level?: number) =>
    usePlainWindowsEditor ? plainRef.value?.applyFold(action, level) : void features.run('applyFold', action, level),
  openTableAtCursor: () => (usePlainWindowsEditor ? plainRef.value?.openTableAtCursor() : void features.run('openTableAtCursor')),
  openFormulaAtCursor: () => (usePlainWindowsEditor ? plainRef.value?.openFormulaAtCursor() : void features.run('openFormulaAtCursor')),
};
defineExpose(editorApi);

const cls = computed(() => ({
  'cm-host': true,
  'cm-host--dark': themeStore.mode === 'dark',
  // #109 — constrain the editing column to a centered readable width.
  'cm-host--limit-width': settings.limitEditorWidth,
  // #211 — soft-wrap fenced code in live-rendered blocks too (same class + CSS as Preview.vue).
  'cb-wrap-on': settings.codeBlockWrap,
}));
</script>

<template>
  <div
    v-if="!usePlainWindowsEditor"
    :class="cls"
    ref="host"
    @contextmenu="menu.onContextMenu"
  ></div>
  <PlainEditor
    v-else
    ref="plainRef"
    :tab="tab"
    :focus-mode="focusMode"
    :typewriter-mode="typewriterMode"
    :spell-check="spellCheck"
    :get-citations="ctx.citations"
    :image-paste-opts="() => imagePasteOptionsFor(ctx)"
    @cursor="(line, col) => emit('cursor', line, col)"
    @selection="(text) => emit('selection', text)"
  />
  <Teleport to="body">
    <EditorContextMenu
      v-if="menu.editorCtx.value"
      :x="menu.editorCtx.value.x"
      :y="menu.editorCtx.value.y"
      :has-selection="menu.editorCtx.value.hasSelection"
      @action="menu.onMenuAction"
      @close="menu.editorCtx.value = null"
    />
  </Teleport>
</template>

<style scoped>
.cm-host {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--bg);
}
/* #109 — readable editing column. Centre the CodeMirror content (and the
   Windows plain-block editor) instead of letting long lines run full-bleed.
   Width matches the preview pane's readable column (760px) so editor and
   preview line up. */
.cm-host--limit-width :deep(.cm-content) {
  max-width: 760px;
  margin-left: auto;
  margin-right: auto;
}
:deep(.cm-editor) {
  height: 100%;
  outline: none;
}
:deep(.cm-editor.cm-focused) {
  outline: none;
}
</style>
