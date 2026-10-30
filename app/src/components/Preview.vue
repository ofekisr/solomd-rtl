<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { documentDirection } from '../lib/doc-direction';
import { isFullMdFile } from '../lib/markdown-block-badges';
import { renderMarkdown, extractImageRoot } from '../lib/markdown';
import { rewriteImageUrls } from '../lib/image-resolve';
import { openerPort } from '../platform/index.ts';
import { useSettingsStore } from '../stores/settings';
import { useI18n } from '../i18n';
import { useFiles } from '../composables/useFiles';
import PreviewSearch from './PreviewSearch.vue';
import { EditorContextMenu, type EditorMenuAction } from '../features/context-menu/contracts/context-menu-component.ts';
import { openInGoogleTranslate } from '../lib/open-google-translate';
import { usePreviewMathEdit } from './usePreviewMathEdit.ts';
import { usePreviewBlocks } from './usePreviewBlocks.ts';
import { usePreviewOverlays } from './usePreviewOverlays.ts';
import { usePreviewScroll } from './usePreviewScroll.ts';
import { resolveRelativePath } from './preview-links.ts';

const props = withDefaults(
  defineProps<{
    source: string;
    filePath?: string;
    /**
     * v4.6 — id of the tab this preview renders. Needed to write back edits
     * (editable display-math) to the right tab via the store. Omitted in
     * read-only contexts (e.g. Slideshow), which disables in-place editing.
     */
    tabId?: string;
    /**
     * v2.4: which "skin" the rendered prose should use.
     *  - `default` — the standard editor preview pane (constrained max-width
     *    inside a sidebar, used in split / preview view modes).
     *  - `reading` — full-bleed serif reading mode (no chrome around it,
     *    centered prose, larger type, book-like spacing).
     */
    skin?: 'default' | 'reading';
  }>(),
  { skin: 'default' },
);
// #350 — source line of the block at the top of the preview, so the outline
// can follow the reading position in preview mode.
const emit = defineEmits<{ (e: 'topline', line: number): void }>();
const settings = useSettingsStore();
const files = useFiles();
const { t } = useI18n();
const host = ref<HTMLDivElement | null>(null);
const searchOpen = ref(false);
const searchRef = ref<InstanceType<typeof PreviewSearch> | null>(null);

const { mathEdit, mathDraft, mathTextarea, onPreviewDblClick, saveMathEdit, cancelMathEdit, onMathKeydown } = usePreviewMathEdit(props);

const html = computed(() => {
  // #141 — establish a reactive dep on the hard-breaks toggle so flipping the
  // setting re-renders immediately (renderMarkdown reads the md singleton's
  // option, which isn't reactive by itself).
  void settings.markdownHardBreaks;
  // Same reactive-dep trick for the numbered-heading toggle (preprocessMarkdown
  // reads a module-level flag that isn't reactive on its own).
  void settings.markdownAutoNumberHeadings;
  // #216 — and for the smart-quotes toggle (md singleton rule state).
  void settings.smartQuotes;
  const source = props.source || '';
  return rewriteImageUrls(
    renderMarkdown(source, { blockNumbers: isFullMdFile(props.filePath) }),
    extractImageRoot(source),
    props.filePath,
  );
});

const { processAllBlocks, disposeBlocks } = usePreviewBlocks(host, props);
const { attachPostRender } = usePreviewOverlays(host, props);

async function renderPostPass(): Promise<void> {
  await nextTick();
  await processAllBlocks();
  attachPostRender();
}

watch(html, async () => {
  // A re-render (incl. our own math write-back) invalidates popup geometry.
  mathEdit.value = null;
  await renderPostPass();
});

// Toggling PlantUML (or changing the server) must re-render: the markdown
// HTML string itself is unchanged (PlantUML swaps happen post-render), so
// v-html would not reset the DOM on its own. Rebuild from html and re-run
// the processors.
watch(
  () => [settings.plantumlEnabled, settings.plantumlServer],
  async () => {
    if (!host.value) return;
    host.value.innerHTML = html.value;
    await renderPostPass();
  },
);

/**
 * Intercept all link clicks inside the preview pane and open them in the
 * system browser instead of navigating the Tauri webview (which would
 * replace the SoloMD UI with the target page).
 */
function handleLinkClick(e: MouseEvent) {
  const anchor = (e.target as HTMLElement).closest('a');
  if (!anchor) return;
  // Wikilink (F1, v2.0): intercept and dispatch resolution to App.vue.
  if (anchor.classList.contains('md-wikilink')) {
    const target = anchor.getAttribute('data-wikilink-target') || '';
    if (target) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('solomd:wiki-open', { detail: { target } }));
    }
    return;
  }
  const href = anchor.getAttribute('href');
  if (!href) return;
  // Allow in-page anchor jumps (#heading)
  if (href.startsWith('#')) return;
  e.preventDefault();
  e.stopPropagation();
  // External URL: open in system browser
  if (/^(https?|mailto|tel):/i.test(href)) {
    openerPort.openUrl(href).catch((err) => {
      console.warn('[Preview] openUrl failed:', href, err);
    });
    return;
  }
  // Relative path: resolve against current file's directory. #163-followup —
  // route through openLinkedFile so a link to a PDF / Office / etc. opens with
  // the OS default app (when openLinkedFilesExternally is on) instead of being
  // converted to Markdown; md / text / images still open in-app.
  if (props.filePath) {
    const resolved = resolveRelativePath(props.filePath, href);
    files.openLinkedFile(resolved, { bypassNewWindow: true }).catch((err) => {
      console.warn('[Preview] openLinkedFile failed:', resolved, err);
    });
  }
}

onMounted(async () => {
  await renderPostPass();
  host.value?.addEventListener('click', handleLinkClick);
  host.value?.addEventListener('dblclick', onPreviewDblClick);
});

onBeforeUnmount(() => {
  disposeBlocks();
  host.value?.removeEventListener('click', handleLinkClick);
  host.value?.removeEventListener('dblclick', onPreviewDblClick);
});

function openSearch() {
  searchOpen.value = true;
  nextTick(() => searchRef.value?.focusInput());
}

const { scrollToLine, onHostScroll } = usePreviewScroll(host, emit);

// #189 — copying rendered content into mail clients / rich editors dropped
// the table borders: the copied HTML referenced our stylesheet classes,
// which don't travel with the clipboard. When the selection contains a
// table, rewrite the text/html clipboard flavor with the essential styles
// inlined (neutral light palette — the paste target is typically a white
// document regardless of the app theme).
function onPreviewCopy(e: ClipboardEvent) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !e.clipboardData) return;
  const range = sel.getRangeAt(0);
  const frag = range.cloneContents();
  const hasNumberedSelection = isFullMdFile(props.filePath)
    && host.value?.contains(range.commonAncestorContainer);
  if (!hasNumberedSelection && !frag.querySelector('table, .full-md-block')) return;
  const wrap = document.createElement('div');
  wrap.appendChild(frag);
  for (const block of Array.from(wrap.querySelectorAll('.full-md-block'))) {
    block.replaceWith(...Array.from(block.childNodes));
  }
  for (const table of Array.from(wrap.querySelectorAll('table'))) {
    table.setAttribute(
      'style',
      'border-collapse:collapse;border-spacing:0;' + (table.getAttribute('style') || ''),
    );
    for (const cell of Array.from(table.querySelectorAll('th,td'))) {
      const isHeader = cell.tagName === 'TH';
      cell.setAttribute(
        'style',
        `border:1px solid #c9c9c9;padding:6px 12px;${isHeader ? 'background:#f2f2f2;font-weight:600;' : ''}` +
          (cell.getAttribute('style') || ''),
      );
    }
  }
  e.clipboardData.setData('text/html', wrap.innerHTML);
  e.clipboardData.setData('text/plain', sel.toString());
  e.preventDefault();
}

const previewCtx = ref<{ x: number; y: number; text: string } | null>(null);

function onPreviewContextMenu(event: MouseEvent): void {
  const text = window.getSelection()?.toString() ?? '';
  if (!text.trim()) return;
  event.preventDefault();
  previewCtx.value = { x: event.clientX, y: event.clientY, text };
}

async function onPreviewMenuAction(id: EditorMenuAction): Promise<void> {
  const text = previewCtx.value?.text ?? '';
  previewCtx.value = null;
  if (id === 'translate') {
    await openInGoogleTranslate(text);
  } else if (id === 'copy') {
    document.execCommand('copy');
  } else if (id === 'selectAll' && host.value) {
    window.getSelection()?.selectAllChildren(host.value);
  }
}

defineExpose({ scrollToLine, openSearch });
</script>

<template>
  <div class="preview-host" :class="{ 'preview-host--reading': skin === 'reading' }" @copy="onPreviewCopy" @scroll.passive="onHostScroll" @contextmenu="onPreviewContextMenu">
    <PreviewSearch
      v-if="searchOpen && host"
      ref="searchRef"
      :container="host"
      @close="searchOpen = false"
    />
    <article
      ref="host"
      class="preview-content"
      :dir="isFullMdFile(props.filePath) ? documentDirection(props.source) : undefined"
      :class="{
        'preview-content--fit': settings.previewFitWidth,
        'preview-content--full-md': isFullMdFile(props.filePath),
        'preview-content--reading': skin === 'reading',
        'cb-numbered-on': settings.codeBlockLineNumbers,
        'cb-wrap-on': settings.codeBlockWrap,
      }"
      :style="{ '--preview-max-width': `${settings.previewMaxWidth || 760}px` }"
      v-html="html"
    ></article>

    <!-- v4.6 — editable display math: inline LaTeX editor opened by
         double-clicking a rendered $$…$$ formula. -->
    <template v-if="mathEdit">
      <div class="math-edit-backdrop" @mousedown="cancelMathEdit"></div>
      <div
        class="math-edit-popover"
        :style="{ top: `${mathEdit.top}px`, left: `${mathEdit.left}px`, width: `${mathEdit.width}px` }"
        @mousedown.stop
      >
        <div class="math-edit-head"><span>LaTeX</span></div>
        <textarea
          ref="mathTextarea"
          v-model="mathDraft"
          class="math-edit-area"
          spellcheck="false"
          rows="3"
          @keydown="onMathKeydown"
        ></textarea>
        <div class="math-edit-actions">
          <button class="math-edit-btn" @mousedown.prevent="cancelMathEdit">{{ t('unsaved.cancel') }}</button>
          <button class="math-edit-btn math-edit-btn--primary" @mousedown.prevent="saveMathEdit">{{ t('unsaved.save') }} <span class="math-edit-kbd">⌘↵</span></button>
        </div>
      </div>
    </template>
    <Teleport to="body">
      <EditorContextMenu
        v-if="previewCtx"
        :x="previewCtx.x"
        :y="previewCtx.y"
        :has-selection="true"
        read-only
        @action="onPreviewMenuAction"
        @close="previewCtx = null"
      />
    </Teleport>
  </div>
</template>

<!--
  Intentionally NOT scoped: the markdown HTML is injected via v-html, so
  Vue's scoped-style attribute wouldn't make it onto those child nodes
  anyway. Manually prefixing every rule with `.preview-content` keeps
  styles contained to the preview pane while still letting later
  overrides win on equal-or-higher specificity.
-->
<style src="./Preview.css"></style>
