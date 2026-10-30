<script setup lang="ts">
import { computed, ref } from 'vue';
import EditorContextMenu, { type EditorMenuAction } from '../../../components/EditorContextMenu.vue';
import { useI18n } from '../../../i18n';
import type { CitationEntry } from '../../../lib/citations';
import type { ImagePasteOptions } from '../../../lib/cm-image-paste';
import { openInGoogleTranslate } from '../../../lib/open-google-translate';
import { isAndroid, isIOS, isWindowsEditorRuntime } from '../../../lib/platform';
import { useSettingsStore } from '../../../stores/settings';
import { useThemeStore } from '../../../stores/theme';
import type { Tab } from '../../../types';
import type { EditorApi } from '../contracts/editor-api.port.ts';
import type { PlainDeps } from '../internal/plain/plain-deps.ts';
import { usePlainCommands } from '../internal/plain/usePlainCommands.ts';
import { usePlainEngine } from '../internal/plain/usePlainEngine.ts';
import { usePlainLifecycle } from '../internal/plain/usePlainLifecycle.ts';
import { usePlainTextTransforms } from '../internal/plain/usePlainTextTransforms.ts';
import PlainAutocomplete from './PlainAutocomplete.vue';
import PlainFindBar from './PlainFindBar.vue';

const props = withDefaults(
  defineProps<{
    tab: Tab;
    focusMode?: boolean;
    typewriterMode?: boolean;
    spellCheck?: boolean;
    getCitations: () => CitationEntry[];
    imagePasteOpts: () => ImagePasteOptions;
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

const settings = useSettingsStore();
const themeStore = useThemeStore();
const { t } = useI18n();

const plainDeps: PlainDeps = {
  props,
  usePlainWindowsEditor: true,
  emitCursor: (line, col) => emit('cursor', line, col),
  emitSelection: (text) => emit('selection', text),
  getCitations: () => props.getCitations(),
  imagePasteOpts: () => props.imagePasteOpts(),
};
const engine = usePlainEngine(plainDeps);
const {
  activatePlainBlockFromClick,
  clearPlainContextSavedRange,
  clearPlainContextTextarea,
  clearStrayDocumentSelection,
  emitPlainCursorAndSelection,
  handlePlainBlockCompositionEnd,
  handlePlainBlockCompositionStart,
  handlePlainBlockInput,
  handlePlainBlockKeydown,
  handlePlainEditorKeydown,
  handlePlainInput,
  handlePlainPaste,
  onEditorMouseDownCapture,
  onPlainLiveHostMouseDown,
  onPlainScroll,
  plainActiveBlock,
  plainBlockHidden,
  plainBlocks,
  plainCaretBox,
  plainContextSelectionText,
  plainEditor,
  plainEditorStyle,
  plainFindBoxes,
  plainFocusBand,
  plainFocusMode,
  plainGutterEnabled,
  plainGutterWidth,
  plainHeadingFolded,
  plainHeadingFor,
  plainHiddenLineCount,
  plainLineHeights,
  plainLiveEnabled,
  plainLiveHost,
  plainScrollTop,
  plainShadeLeft,
  plainSolidCaretOn,
  resolvePlainContextMenu,
  runPlainEditorMenuAction,
  schedulePlainOverlays,
  setPlainBlockEditor,
  togglePlainFold,
} = engine;

const { installTextTransformListeners } = usePlainTextTransforms(plainDeps, engine);
usePlainLifecycle(plainDeps, engine, installTextTransformListeners);

const editorCtx = ref<{ x: number; y: number; hasSelection: boolean } | null>(null);

function onEditorContextMenu(event: MouseEvent) {
  const pointer = (event as PointerEvent).pointerType;
  if (pointer === 'touch' || pointer === 'pen' || isAndroid() || isIOS()) return;
  // macOS and Linux keep the system menu; ours replaces the WebView2 one (#210).
  if (!isWindowsEditorRuntime()) return;
  event.preventDefault();
  const hasSelection = resolvePlainContextMenu(event);
  clearPlainContextSavedRange();
  editorCtx.value = { x: event.clientX, y: event.clientY, hasSelection };
}

async function onEditorMenuAction(id: EditorMenuAction) {
  editorCtx.value = null;
  if (id === 'translate') {
    const text = plainContextSelectionText();
    clearPlainContextTextarea();
    await openInGoogleTranslate(text);
    return;
  }
  await runPlainEditorMenuAction(id);
}

const editorApi: EditorApi = usePlainCommands(plainDeps, engine);
defineExpose(editorApi);

const cls = computed(() => ({
  'cm-host': true,
  'cm-host--dark': themeStore.mode === 'dark',
  // #109 — constrain the editing column to a centered readable width.
  'cm-host--limit-width': settings.limitEditorWidth,
  // #211 — soft-wrap fenced code in the LIVE-rendered blocks too. Same class
  // name + CSS as the preview so behaviour matches across modes.
  'cb-wrap-on': settings.codeBlockWrap,
}));
</script>

<template>
  <div
    class="plain-host"
    @mousedown.capture="onEditorMouseDownCapture"
    @contextmenu="onEditorContextMenu"
  >
    <div
      v-if="plainLiveEnabled"
      ref="plainLiveHost"
      :class="[
        cls,
        'plain-block-editor',
        {
          'plain-block-editor--cb-numbers': settings.codeBlockLineNumbers,
          'plain-block-editor--focus': plainFocusMode,
        },
      ]"
      :style="plainEditorStyle"
      @mousedown="onPlainLiveHostMouseDown"
    >
      <div
        v-for="(block, index) in plainBlocks"
        v-show="!plainBlockHidden(block, index)"
        :key="block.id"
        class="plain-block"
        :class="{
          'plain-block--active': index === plainActiveBlock,
          'plain-block--heading': !!plainHeadingFor(block),
        }"
        @click="(event) => activatePlainBlockFromClick(index, event)"
      >
        <button
          v-if="plainHeadingFor(block)"
          class="plain-fold-toggle"
          :class="{ 'plain-fold-toggle--folded': plainHeadingFolded(block) }"
          :title="plainHeadingFolded(block) ? t('fold.expand') : t('fold.collapse')"
          :aria-expanded="!plainHeadingFolded(block)"
          @click.stop="togglePlainFold(block)"
        >{{ plainHeadingFolded(block) ? '›' : '⌄' }}</button>
        <span
          v-if="plainHeadingFolded(block)"
          class="plain-fold-count"
          @click.stop="togglePlainFold(block)"
        >{{ t('fold.placeholder', { lines: plainHiddenLineCount(block) }) }}</span>
        <textarea
          v-if="index === plainActiveBlock"
          :ref="(el) => setPlainBlockEditor(index, el as HTMLTextAreaElement | null)"
          class="plain-block__textarea"
          :class="{
            'plain-textarea--wrap': settings.wordWrap,
            'plain-textarea--solid-caret': plainSolidCaretOn,
          }"
          :spellcheck="props.spellCheck"
          :wrap="settings.wordWrap ? 'soft' : 'off'"
          @keydown="(event) => handlePlainBlockKeydown(index, event)"
          @paste="handlePlainPaste"
          @input="(event) => handlePlainBlockInput(index, event)"
          @compositionstart="handlePlainBlockCompositionStart"
          @compositionend="(event) => handlePlainBlockCompositionEnd(index, event)"
          @click.stop
          @blur="schedulePlainOverlays"
          @keyup="emitPlainCursorAndSelection"
          @mouseup="emitPlainCursorAndSelection"
          @select="emitPlainCursorAndSelection"
          @focus="emitPlainCursorAndSelection"
        ></textarea>
        <div
          v-else
          class="plain-block__render"
          v-html="block.html"
        ></div>
        <!-- #330 — the current find match, drawn: the textarea paints no
             selection while the find box has focus. Positioned inside its
             own block, so it moves with the text when anything above
             re-renders to a different height (the browser's scroll anchoring
             keeps the text still on screen, and a highlight placed in the
             scroll container's coordinates would be left behind). -->
        <template v-if="index === plainActiveBlock">
          <div
            v-for="(r, i) in plainFindBoxes"
            :key="'find-' + i"
            class="plain-find-hl"
            aria-hidden="true"
            :style="{ top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' }"
          ></div>
        </template>
      </div>
      <div
        v-if="plainCaretBox"
        class="plain-caret"
        aria-hidden="true"
        :style="{
          top: plainCaretBox.top + 'px',
          left: plainCaretBox.left + 'px',
          height: plainCaretBox.height + 'px',
        }"
      ></div>
    </div>
    <div v-else :class="[cls, 'plain-source']" :style="plainEditorStyle">
      <div
        v-if="plainGutterEnabled"
        class="plain-gutter"
        aria-hidden="true"
        :style="{ width: `calc(${plainGutterWidth} + 20px)` }"
      >
        <div class="plain-gutter__inner" :style="{ transform: `translateY(${-plainScrollTop}px)` }">
          <div
            v-for="(h, i) in plainLineHeights"
            :key="i"
            class="plain-gutter__num"
            :style="{ height: h + 'px' }"
          >{{ i + 1 }}</div>
        </div>
      </div>
      <textarea
        ref="plainEditor"
        class="plain-editor"
        :class="{
          'plain-textarea--wrap': settings.wordWrap,
          'plain-textarea--solid-caret': plainSolidCaretOn,
        }"
        :spellcheck="props.spellCheck"
        :wrap="settings.wordWrap ? 'soft' : 'off'"
        @keydown="handlePlainEditorKeydown"
        @paste="handlePlainPaste"
        @input="handlePlainInput"
        @scroll="onPlainScroll"
        @mousedown="$event.button === 0 && clearStrayDocumentSelection($event.currentTarget as HTMLElement)"
        @blur="schedulePlainOverlays"
        @keyup="emitPlainCursorAndSelection"
        @mouseup="emitPlainCursorAndSelection"
        @select="emitPlainCursorAndSelection"
        @focus="emitPlainCursorAndSelection"
      ></textarea>
      <!-- #316 — focus mode: a <textarea> can't dim individual lines, so the
           inactive part of the document is covered in the editor's own
           background instead. Purely decorative; never takes a click. -->
      <template v-if="plainFocusBand">
        <div
          class="plain-shade"
          aria-hidden="true"
          :style="{ top: 0, left: plainShadeLeft, height: Math.max(0, plainFocusBand.top) + 'px' }"
        ></div>
        <div
          class="plain-shade"
          aria-hidden="true"
          :style="{ top: Math.max(0, plainFocusBand.bottom) + 'px', left: plainShadeLeft, bottom: 0 }"
        ></div>
      </template>
      <div
        v-if="plainCaretBox"
        class="plain-caret"
        aria-hidden="true"
        :style="{
          top: plainCaretBox.top + 'px',
          left: plainCaretBox.left + 'px',
          height: plainCaretBox.height + 'px',
        }"
      ></div>
      <!-- #330 — the current find match, drawn: the textarea paints no
           selection while the find box has focus. -->
      <div
        v-for="(r, i) in plainFindBoxes"
        :key="'find-' + i"
        class="plain-find-hl"
        aria-hidden="true"
        :style="{ top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' }"
      ></div>
    </div>

    <PlainFindBar :engine="engine" />
    <PlainAutocomplete :engine="engine" />
    <Teleport to="body">
      <EditorContextMenu
        v-if="editorCtx"
        :x="editorCtx.x"
        :y="editorCtx.y"
        :has-selection="editorCtx.hasSelection"
        @action="onEditorMenuAction"
        @close="editorCtx = null"
      />
    </Teleport>
  </div>
</template>

<style scoped src="./plain-editor.css"></style>
