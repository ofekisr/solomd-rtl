<script setup lang="ts">
import { autocompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { getSearchQuery, openSearchPanel, search, searchKeymap, setSearchQuery } from '@codemirror/search';
import { createFindPanel } from '../../../lib/cm-find-panel';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { crosshairCursor, drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers, rectangularSelection } from '@codemirror/view';
import { vim, Vim } from '@replit/codemirror-vim';
import { clipboardPort } from '../../../platform/index.ts';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useFormatHints } from '../../../composables/useFormatHints';
import { usePandocExport } from '../../../composables/usePandocExport';
import { useI18n } from '../../../i18n';
import { IS_APP_STORE_BUILD } from '../../../lib/app-build';
import type { CitationEntry } from '../../../lib/citations';
import { aiRewriteExtension } from '../../../lib/cm-ai-rewrite';
import { isAiWorking } from '../../../lib/ai-activity';
import { bidiExtension } from '../../../lib/cm-bidi';
import { citationCompleteSource, citationsExtension } from '../../../lib/cm-citations';
import { directiveCompletionExtension, directiveCompletionSource } from '../../../lib/cm-directive-completions';
import { dragAwareExtension } from '../../../lib/cm-drag-aware';
import { fenceLanguageComplete, fenceLanguageExtension } from '../../../lib/cm-fence-completion';
import { focusModeExtension, typewriterModeExtension } from '../../../lib/cm-focus-mode';
import { currentFoldRanges, foldAllHeadings, foldHeadingsToLevel, headingFoldExtension, restoreFoldRanges, toggleHeadingFoldAtCursor, unfoldAllFolds } from '../../../lib/cm-heading-fold';
import { anchorSnapshot, captureFolds, foldAnchorsFor, foldRangesFor, recallFolds, rememberFolds } from '../../../lib/fold-memory';
import { imagePasteExtension, type ImagePasteOptions, imageTextFromPath, insertImageFromPath as cmInsertImageFromPath } from '../../../lib/cm-image-paste';
import { imeCompositionGuard } from '../../../lib/cm-ime-guard';
import { extractImageRoot, liveBlocksExtension, liveBlocksTheme } from '../../../lib/cm-live-blocks';
import { livePreviewExtension, richHighlightOnly } from '../../../lib/cm-live-preview';
import { liveEditExtension, setLiveEditCopyLabel } from '../../../lib/cm-live-render';
import { clearSession, readSession, sessionRestoreExtension } from '../../../lib/cm-session-restore';
import { slashCommandsExtension } from '../../../lib/cm-slash-commands';
import { spellcheckExtension } from '../../../lib/cm-spellcheck';
import { spellcheckTheme } from '../../../lib/cm-spellcheck-theme';
import { stableClickSelection } from '../../../lib/cm-stable-click';
import { tagAutocompleteExtension, tagComplete } from '../../../lib/cm-tag-autocomplete';
import { taskListExtension } from '../../../lib/cm-task-list';
import { wikilinkComplete, wikilinkExtension } from '../../../lib/cm-wikilink';

// The grammar imports and the `codeLanguages` list they feed now live in
// `lib/code-languages.ts`: the ``` fence-language picker (#297) derives its
// catalogue from that same list, so there is only one copy to keep in sync.
import { createLanguageExtension, loadLanguageExtension } from '../../../lib/editor-language.ts';
import { collectLabels, findMathSpanAt } from '../../../lib/equations';

import type { PlainDeps } from '../internal/plain/plain-deps.ts';
import { usePlainEngine } from '../internal/plain/usePlainEngine.ts';

import { openFormulaEditor } from '../../../lib/formula-editor-bus';
import { scanHeadings } from '../../../lib/heading-fold';

import { type ImageUploadSettings, resolveUploader, uploadImage } from '../../../lib/image-upload';
import { combosFor, toCodeMirrorKey } from '../../../lib/keybindings';

import { findTableSpan } from '../../../lib/markdown-table';
import { applyFormat, FORMAT_KINDS, type FormatKind } from '../../../lib/md-format';
import { encodeImageDestination, markdownImage } from '../../../lib/md-image-url';

import { registerPlainSelectionGetter } from '../../../lib/plain-selection';

import { isAndroid, isIOS, isWindowsEditorRuntime, shouldUsePlainWindowsEditor } from '../../../lib/platform';
import { openTableEditor } from '../../../lib/table-editor-bus';
import { type CaseMode, caseTargetRange, nextCaseInCycle, transformCase } from '../../../lib/text-case';

import { cmThemeFor } from '../../../lib/themes';
import { graphvizThemeFor } from '../../../lib/theme/mermaid';
import { replaceBoardSnapshot } from '../../../lib/tldraw-board';
import { buildEditorFontStack, useSettingsStore } from '../../../stores/settings';
import { useThemeStore } from '../../../stores/theme';
import { useTabsStore } from '../../../stores/tabs';
import { useToastsStore } from '../../../stores/toasts';

import type { Tab } from '../../../types';
import EditorContextMenu, { type EditorMenuAction } from '../../../components/EditorContextMenu.vue';
import { openInGoogleTranslate } from '../../../lib/open-google-translate';

// Incremental find. CoreMirror's search panel only scrolls to a match when you
// press Enter / click Next — typing in the field just repaints the highlights
// in place. On a long document the nearest match stays off-screen, so it looks
// like find "found nothing" even though it did (reported: "the search box that Ctrl+F opens
// does not jump to where the text is"). Browsers, VS Code and Typora all scroll to the first
// match as you type; this restores that. We only scroll the match into view —
// the editor selection is left untouched so we never fight the caret or an
// in-progress IME composition, and pressing Enter afterwards still walks matches
// from the current position exactly as before.
function firstMatch(query: ReturnType<typeof getSearchQuery>, view: EditorView, from: number) {
  // Nearest match at/after the cursor; wrap to the top if there's none below.
  const forward = query.getCursor(view.state, from).next();
  if (!forward.done) return forward.value;
  const wrapped = query.getCursor(view.state, 0, from).next();
  return wrapped.done ? null : wrapped.value;
}

const incrementalFindScroll = EditorView.updateListener.of((update) => {
  if (!update.transactions.some((tr) => tr.effects.some((e) => e.is(setSearchQuery)))) return;
  const query = getSearchQuery(update.state);
  if (!query.valid || !query.search) return;
  const view = update.view;
  const match = firstMatch(query, view, view.state.selection.main.from);
  if (!match) return;
  // Dispatching synchronously from an updateListener is unsupported; defer a
  // frame and re-check the query hasn't changed under us in the meantime.
  requestAnimationFrame(() => {
    if (!getSearchQuery(view.state).eq(query)) return;
    view.dispatch({ effects: EditorView.scrollIntoView(match.from, { y: 'center' }) });
  });
});

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

/** Shared image paste/drop/insert options — file context + the configured
 *  image-host uploader + toast surface. Used by the CodeMirror paste
 *  extension, the plain-textarea paste path, and `insertImageFromPath`. */
function imagePasteOpts(): ImagePasteOptions {
  return {
    getFilePath: () => props.tab.filePath,
    getDocContent: () => props.tab.content,
    getAttachmentMode: () => settings.attachmentMode,
    getAssetsDirName: () => settings.assetsDirName,
    getCustomPath: () => settings.attachmentCustomPath,
    getUploader: (filename: string) =>
      resolveUploader(settings as unknown as ImageUploadSettings, filename),
    notify: (kind, key, params) => {
      const msg = t(key, params as Record<string, string | number>);
      if (kind === 'success') toasts.success(msg);
      else if (kind === 'error') toasts.error(msg);
      else toasts.info(msg);
    },
  };
}
const pandoc = usePandocExport();
let cachedCitations: CitationEntry[] = [];
pandoc.loadCitations().then((c) => { cachedCitations = c; }).catch(() => {});
watch(
  () => settings.workspaceBibliography,
  () => {
    pandoc.invalidateCitationsCache();
    pandoc.loadCitations().then((c) => { cachedCitations = c; }).catch(() => {});
  },
);

const host = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;
let cleanupRelayout: (() => void) | null = null;
let cleanupTransformCase: (() => void) | null = null;
let cleanupPlainSelection: (() => void) | null = null;
let contentSyncTimer: ReturnType<typeof setTimeout> | null = null;

const themeCompartment = new Compartment();
const langCompartment = new Compartment();

function applyLazyLanguage(language: string): void {
  void loadLanguageExtension(language)?.then((support) => {
    if (props.tab.language !== language) return;
    view?.dispatch({ effects: langCompartment.reconfigure(support) });
  });
}
const directionCompartment = new Compartment();
const wrapCompartment = new Compartment();
const lineNumCompartment = new Compartment();
const cursorCompartment = new Compartment();
// #344 — optional caret-line tint (the base theme paints .cm-activeLine clear).
const activeLineCompartment = new Compartment();
const fontSizeCompartment = new Compartment();
// #180 — the AI-rewrite chord is user-bindable; keep it reconfigurable.
const aiKeyCompartment = new Compartment();
const richCompartment = new Compartment();
const spellCheckCompartment = new Compartment();
const focusCompartment = new Compartment();
const typewriterCompartment = new Compartment();
const vimCompartment = new Compartment();
const slashCompartment = new Compartment();
const foldCompartment = new Compartment();
const aiLockCompartment = new Compartment();

// #222 — Vim's `:w` / `:wq` / `:q` were dead: @replit/codemirror-vim ships no
// Ex-command handlers (there is no file system in the browser), so typing `:w`
// just cleared the command line without saving. Route them through the same
// `solomd:menu-action` bus the menu bar and Ctrl+S use, so save / save-and-close
// / close honour the app's real save + unsaved-tab flow. Registered once on the
// global Vim singleton (idempotent guard — defineEx would otherwise stack).
if (!(globalThis as { __solomdVimEx?: boolean }).__solomdVimEx) {
  (globalThis as { __solomdVimEx?: boolean }).__solomdVimEx = true;
  const menu = (id: string) =>
    window.dispatchEvent(new CustomEvent('solomd:menu-action', { detail: id }));
  // `:w` / `:write` — save the active tab.
  Vim.defineEx('write', 'w', () => menu('file.save'));
  // `:wq` / `:x` / `:xit` — save, then close only once the save actually lands.
  // saveActive() is async, so closing synchronously would hit a still-dirty tab
  // and pop the unsaved-changes dialog; wait for the one-shot `solomd:saved`.
  const saveThenClose = () => {
    let timer = 0;
    const onSaved = () => {
      clearTimeout(timer);
      window.removeEventListener('solomd:saved', onSaved);
      menu('file.closeTab');
    };
    window.addEventListener('solomd:saved', onSaved);
    // If the save is cancelled (e.g. the Save-As dialog on an untitled buffer)
    // the `solomd:saved` never fires; drop the listener so it can't later close
    // an unrelated tab on the next save. 10s comfortably covers a real write.
    timer = window.setTimeout(() => window.removeEventListener('solomd:saved', onSaved), 10000);
    menu('file.save');
  };
  Vim.defineEx('wq', 'wq', saveThenClose);
  Vim.defineEx('xit', 'x', saveThenClose);
  // `:q` / `:quit` — close the tab (unsaved changes trigger the confirm dialog).
  Vim.defineEx('quit', 'q', () => menu('file.closeTab'));
}
// `?forcePlain` query flag forces the Windows plain-textarea editor on any OS —
// a dev/test hook so the Windows-only path can be exercised on macOS/Linux. It
// can only be set programmatically (the Tauri shell has no URL bar), so it is
// inert for real users.
const isWindows = isWindowsEditorRuntime();
// Windows normally uses the plain-textarea editor: WebView2 + contentEditable drops the
// first IME character and doubles CJK punctuation (worst on Sogou), and even
// freezing CodeMirror's decorations during composition does not fix it — the
// bug is in WebView2's contentEditable IME handling itself. A plain <textarea>
// relies on the browser's native IME path and avoids both. (Verified: a
// CodeMirror spike on Windows still ate the first char + doubled punctuation.)
// Vim emulation, however, is a CodeMirror extension and cannot run in the
// textarea fallback. Opting into Vim therefore explicitly opts into CodeMirror
// on Windows; PaneContent keys the editor by this setting so the switch happens
// immediately instead of requiring an app restart (#194).
// The user can also choose CodeMirror outright on Windows (Settings → Editor
// engine, #328/#344) — same remount path, without the Vim keymap.
const usePlainWindowsEditor = shouldUsePlainWindowsEditor(
  isWindows,
  settings.vimMode,
  settings.windowsEditorEngine,
);

// One-time "there is a key for that" tips. Fed from all three input paths
// below — the same rule as every other editing feature in this file.
const noteTypedFormat = useFormatHints();


// Synchronous counterpart to the debounce below. `saveTab` broadcasts
// `solomd:flush-content-sync` right before reading `tab.content`, because a
// save landing inside the 350ms window would otherwise write a stale document
// — fatal for vim's `:wq` (#222), which closes the tab immediately after the
// save and silently drops the not-yet-synced tail of the edit. While an IME
// composition is in flight the timer is left armed instead (same reasoning as
// #186: never commit a half-composed doc).
function flushContentSync() {
  if (!contentSyncTimer || !view || view.composing) return;
  clearTimeout(contentSyncTimer);
  contentSyncTimer = null;
  tabs.setContent(props.tab.id, view.state.doc.toString());
}

function syncEditorContentSoon(text: string) {
  if (contentSyncTimer) clearTimeout(contentSyncTimer);
  contentSyncTimer = setTimeout(() => {
    contentSyncTimer = null;
    // #186 — read the doc at fire time, not schedule time. A snapshot taken
    // before an IME composition started is stale by the time this fires; the
    // external-content watcher would then "restore" it with a full-doc
    // replace, killing the composition and mapping the caret to offset 0
    // (the reported cursor-jumps-to-top). While composing, re-arm instead:
    // the candidate commit lands as a non-composing update and syncs then.
    if (view) {
      if (view.composing) {
        syncEditorContentSoon(text);
        return;
      }
      tabs.setContent(props.tab.id, view.state.doc.toString());
      return;
    }
    tabs.setContent(props.tab.id, text);
  }, 350);
}

const plainDeps: PlainDeps = {
  props,
  usePlainWindowsEditor,
  emitCursor: (line, col) => emit('cursor', line, col),
  emitSelection: (text) => emit('selection', text),
  getCitations: () => cachedCitations,
  imagePasteOpts,
};
const {
  acIndex,
  acItems,
  acOpen,
  acPos,
  activatePlainBlockFromClick,
  applyPlainAutocomplete,
  applyPlainContent,
  clearPlainContextSavedRange,
  clearPlainContextTextarea,
  clearStrayDocumentSelection,
  closePlainFind,
  disposePlainOverlays,
  emitPlainCursorAndSelection,
  focusPlainEditor,
  gotoPlainMatch,
  handlePlainBlockCompositionEnd,
  handlePlainBlockCompositionStart,
  handlePlainBlockInput,
  handlePlainBlockKeydown,
  handlePlainEditorKeydown,
  handlePlainInput,
  handlePlainPaste,
  installPlainOverlayListeners,
  onEditorMouseDownCapture,
  onPlainFindEnter,
  onPlainFindInput,
  onPlainLiveHostMouseDown,
  onPlainScroll,
  openPlainFind,
  plainAbsoluteSelection,
  plainActiveBlock,
  plainBlockEditors,
  plainBlockHidden,
  plainBlocks,
  plainCaretBox,
  plainComposing,
  plainContextSelectionText,
  plainEditor,
  plainEditorStyle,
  plainFindBar,
  plainFindBoxes,
  plainFindCaseSensitive,
  plainFindDodge,
  plainFindInput,
  plainFindOpen,
  plainFindQuery,
  plainFocusBand,
  plainFocusMode,
  plainFoldedLines,
  plainFolds,
  plainGutterEnabled,
  plainGutterWidth,
  plainHeadingFolded,
  plainHeadingFor,
  plainHiddenLineCount,
  plainInsertText,
  plainLineHeightPx,
  plainLineHeights,
  plainLineStartOffset,
  plainLineTops,
  plainLiveEnabled,
  plainLiveHost,
  plainMatchIndex,
  plainMatches,
  plainPaddingTopPx,
  plainReplaceValue,
  plainScrollToLine,
  plainScrollTop,
  plainSelectAll,
  plainSelectionText,
  plainSetCaret,
  plainShadeLeft,
  plainSolidCaretOn,
  plainText,
  processPlainLiveRenderedBlocks,
  recordPlainHistory,
  replacePlainAll,
  replacePlainCurrent,
  resetPlainHistory,
  resolvePlainContextMenu,
  revealPlainMatchFromAnchor,
  runPlainEditorMenuAction,
  schedulePlainOverlays,
  setPlainBlockEditor,
  setPlainFold,
  setPlainSelectAllPending,
  syncPlainEditorAfterModeSwitch,
  syncPlainEditorFromStore,
  togglePlainFold,
  updatePlainBlock,
} = usePlainEngine(plainDeps);


// ── Editor right-click menu (#210) ─────────────────────────────────────────
// The webview's own menu came up on Windows without Cut/Copy for a selection
// the user had just made, so mouse-only users could select but not act. On
// Windows we show a menu of our own, the same on every editor path (macOS and
// Linux keep the system menu, see onEditorContextMenu). On phones a long-press
// fires `contextmenu` too; the system selection menu is better there, so we
// leave it alone.
const editorCtx = ref<{ x: number; y: number; hasSelection: boolean } | null>(null);

function onEditorContextMenu(event: MouseEvent) {
  const pointer = (event as PointerEvent).pointerType;
  if (pointer === 'touch' || pointer === 'pen' || isAndroid() || isIOS()) return;
  // Windows always: the WebView2 menu lost the selection (#210). macOS and
  // Linux keep the system menu (spelling, Look Up, Services, writing tools)
  // except over a selection, where ours adds "Translate with Google".
  if (!isWindowsEditorRuntime()) {
    if (usePlainWindowsEditor || !view || view.state.selection.main.empty) return;
  }
  event.preventDefault();
  let hasSelection = false;
  if (!usePlainWindowsEditor) {
    hasSelection = !!view && !view.state.selection.main.empty;
    clearPlainContextTextarea();
  } else {
    hasSelection = resolvePlainContextMenu(event);
  }
  clearPlainContextSavedRange();
  editorCtx.value = { x: event.clientX, y: event.clientY, hasSelection };
}

async function writeClipboard(text: string) {
  try {
    await clipboardPort.writeText(text);
  } catch {
    await navigator.clipboard?.writeText(text);
  }
}
async function readClipboard(): Promise<string> {
  try {
    return (await clipboardPort.readText()) ?? '';
  } catch {
    try {
      return (await navigator.clipboard?.readText()) ?? '';
    } catch {
      return '';
    }
  }
}

function editorSelectionText(): string {
  if (!usePlainWindowsEditor) {
    const sel = view?.state.selection.main;
    return view && sel && !sel.empty ? view.state.sliceDoc(sel.from, sel.to) : '';
  }
  return plainContextSelectionText();
}

async function onEditorMenuAction(id: EditorMenuAction) {
  editorCtx.value = null;
  if (id === 'translate') {
    const text = editorSelectionText();
    clearPlainContextTextarea();
    await openInGoogleTranslate(text);
    return;
  }
  if (!usePlainWindowsEditor) {
    const v = view;
    if (!v) return;
    const sel = v.state.selection.main;
    if (id === 'selectAll') {
      v.dispatch({ selection: { anchor: 0, head: v.state.doc.length }, userEvent: 'select' });
    } else if (id === 'copy' || id === 'cut') {
      if (sel.empty) return;
      await writeClipboard(v.state.sliceDoc(sel.from, sel.to));
      if (id === 'cut') {
        v.dispatch({ changes: { from: sel.from, to: sel.to, insert: '' }, userEvent: 'delete.cut' });
      }
    } else if (id === 'paste') {
      const text = await readClipboard();
      if (text) v.dispatch({ ...v.state.replaceSelection(text), userEvent: 'input.paste', scrollIntoView: true });
    }
    v.focus();
    return;
  }
  await runPlainEditorMenuAction(id);
}


function slashExt() {
  if (!settings.slashCommandsEnabled) return [];
  return slashCommandsExtension({
    enabled: () => settings.slashCommandsEnabled,
    labelFor: (id) => {
      const v = t(`slashCommands.labels.${id}`);
      return v.startsWith('slashCommands.') ? undefined : v;
    },
    hintFor: (id) => {
      const v = t(`slashCommands.hints.${id}`);
      return v.startsWith('slashCommands.') ? undefined : v;
    },
    emptyHint: (q) => t('slashCommands.empty', { query: q }),
  });
}

/** The user's chord for AI rewrite, in CodeMirror's spelling. */
function currentAiRewriteKey(): string {
  const combos = combosFor('editor.aiRewrite', settings.keybindings);
  // Unbound: a key no chord produces, so the extension stays inert rather
  // than falling back to ⌘J behind the user's back.
  return combos.length ? toCodeMirrorKey(combos[0]) : 'F24';
}

function spellCheckExt(on: boolean) {
  return EditorView.contentAttributes.of({ spellcheck: on ? 'true' : 'false' });
}

/** Heading folding — off entirely when the setting is off, so a user who finds
 *  the gutter arrows noisy gets the old editor back rather than a hidden
 *  feature they can still trip over with a shortcut. */
function foldExtensionFor(on: boolean) {
  if (!on) return [];
  return headingFoldExtension({
    placeholderLabel: (lines) => t('fold.placeholder', { lines }),
  });
}

// The live-edit code-block copy button lives in a CM widget, which has no
// access to the i18n store — hand it a getter so its label tracks the UI
// language like every other string.
setLiveEditCopyLabel(() => t('toolbar.copy'));

function richExtensionsFor(tab: Tab) {
  if (tab.language !== 'markdown') return [];
  // v2.3 live-edit takes precedence over the existing livePreview toggle —
  // the WYSIWYG bundle ALREADY includes rich highlighting + marker hiding,
  // and stacking livePreviewExtension on top would cause duplicate
  // marker-replace decorations.
  if (settings.viewMode === 'liveEdit') {
    // v3.6 issue #44: in live-edit mode, also collapse standalone image
    // lines + GFM tables into block widgets when the cursor is elsewhere.
    // Cursor enters → widget unmounts → source returns. Image paths
    // resolve via the same extractImageRoot used by Preview/Export.
    return liveEditExtension([
      liveBlocksExtension({
        getImageRoot: () => extractImageRoot(tab.content || ''),
        getFilePath: () => tab.filePath,
        // F7 — live tldraw whiteboard theme + writeback.
        getBoardTheme: () => ({
          colorScheme: themeStore.mode,
          locale: settings.language || 'en',
        }),
        getTabId: () => tab.id,
        // #354 — diagrams follow the app's light/dark family, like preview.
        getMermaidTheme: () => graphvizThemeFor(themeStore.mode),
        getPlantuml: () => ({
          enabled: settings.plantumlEnabled,
          server: settings.plantumlServer,
        }),
        // #353 — "Always show Markdown markers": keep every block's source.
        keepSource: () => settings.alwaysShowMarkers,
        getBoardStrings: () => ({
          loading: t('whiteboard.loading'),
          openFull: t('whiteboard.openFull'),
          loadFailed: t('whiteboard.loadFailed'),
        }),
        getMindmapStrings: () => ({ openFull: t('mindmap.fenceOpenFull'), parseError: t('mindmap.fenceParseError'), gateBroken: t('mindmap.gateBroken') }),
        onBoardEdit: (boardId, snapshotJson) => {
          const cur = tabs.tabs.find((x) => x.id === tab.id);
          if (!cur) return;
          const next = replaceBoardSnapshot(cur.content || '', boardId, snapshotJson);
          if (next !== cur.content) tabs.setContent(tab.id, next);
        },
      }),
      liveBlocksTheme,
    ], { showMarkers: settings.alwaysShowMarkers });
  }
  return settings.livePreview
    ? livePreviewExtension({ showMarkers: settings.alwaysShowMarkers })
    : richHighlightOnly();
}

// #344 — caret-line tint. Selector is one step more specific than the base
// theme's transparent `.cm-activeLine` so it wins regardless of order.
function activeLineExtension(on: boolean) {
  if (!on) return [];
  return EditorView.theme({
    '.cm-content .cm-line.cm-activeLine': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 9%, transparent)',
    },
  });
}

const fontSizeTheme = (px: number, family: string) =>
  EditorView.theme({
    '&': { fontSize: `${px}px`, height: '100%' },
    '.cm-scroller': { fontFamily: buildEditorFontStack(family), lineHeight: '1.6' },
    '.cm-content': { padding: '12px 16px' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--text-faint)',
    },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--accent)' },
    '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
    // CodeMirror's measured cursor layer can report the same x-coordinate for
    // adjacent insertion points around trailing RTL spaces. Let the browser
    // draw the native caret in RTL content so each typed space advances it.
    '&[dir="rtl"] .cm-content': { caretColor: 'var(--accent) !important' },
    '&[dir="rtl"] .cm-cursor': {
      display: 'none',
    },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(255,159,64,0.25) !important' },
    // v4.3.0 issue #67: distinct current-match highlight for the Cmd+F search
    // panel. CM6 marks the active result with `.cm-searchMatch-selected` —
    // by default it's the same translucent color as the other matches so the
    // user can't tell which one they're on. Brighten it to the accent color
    // and tint the others down so the current one pops.
    '.cm-searchMatch': { backgroundColor: 'rgba(255,159,64,0.22)', borderRadius: '2px' },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'var(--accent, #ff9f40)',
      color: 'var(--accent-fg, #fff)',
      outline: '1px solid var(--accent, #ff9f40)',
    },
  });

function buildExtensions() {
  if (usePlainWindowsEditor) return [];
  const markdownSafeMode = false;
  const windowsImeSafeMode = false;
  return [
    imeCompositionGuard(),
    history(),
    directionCompartment.of(bidiExtension(
      props.tab.language === 'markdown' || props.tab.language === 'plaintext' ? undefined : 'ltr',
    )),
    ...(windowsImeSafeMode
      ? []
      : [
          dragAwareExtension(),
          // #193 — solid (non-blinking) caret option. cursorBlinkRate: 0
          // disables the blink cycle entirely; 1200ms is CM6's default.
          cursorCompartment.of(
            drawSelection({ cursorBlinkRate: settings.solidCursor ? 0 : 1200 }),
          ),
          activeLineCompartment.of(activeLineExtension(settings.highlightCurrentLine)),
          // #90 — column/rectangular selection: hold Alt (Option on macOS) and
          // drag to select a vertical block. `crosshairCursor` swaps the I-beam
          // for a crosshair while Alt is held so the user knows the mode is
          // armed. CM6 already turns multiple selections on by default; no
          // need to flip `EditorState.allowMultipleSelections`.
          rectangularSelection(),
          crosshairCursor(),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          search({ top: true, createPanel: createFindPanel(() => props.tab.filePath) }),
          incrementalFindScroll,

        ]),
    // #296 — Mod-i is CodeMirror's selectParentSyntax. The app-level Italic
    // shortcut listens on window, so CodeMirror would run first and widen the
    // selection to the whole paragraph before it got italicised.
    keymap.of([...defaultKeymap.filter((b) => b.key !== 'Mod-i'), ...historyKeymap, ...searchKeymap, indentWithTab]),
    lineNumCompartment.of(settings.showLineNumbers ? lineNumbers() : []),
    wrapCompartment.of(settings.wordWrap ? EditorView.lineWrapping : []),
    langCompartment.of(
      windowsImeSafeMode
        ? []
        : createLanguageExtension(props.tab.language)
    ),
    richCompartment.of(
      windowsImeSafeMode ? [] : richExtensionsFor(props.tab),
    ),
    themeCompartment.of(cmThemeFor(themeStore.mode)),
    vimCompartment.of(settings.vimMode ? vim() : []),
    fontSizeCompartment.of(fontSizeTheme(settings.fontSize, settings.fontFamily)),
    spellCheckCompartment.of(spellCheckExt(props.spellCheck)),
    aiLockCompartment.of(aiLockExtension(isAiWorking(props.tab.filePath))),
    focusCompartment.of(props.focusMode ? focusModeExtension() : []),
    typewriterCompartment.of(props.typewriterMode ? typewriterModeExtension() : []),
    imagePasteExtension(imagePasteOpts()),
    ...(!windowsImeSafeMode && props.tab.language === 'markdown' && !markdownSafeMode
      ? [
          wikilinkExtension(),
          tagAutocompleteExtension(),
          citationsExtension(() => cachedCitations),
          // #297 — opens itself on the third backtick of a fence opener.
          fenceLanguageExtension(),
          directiveCompletionExtension(),
          // Single autocompletion config combining all markdown sources.
          // CM6 disallows multiple `autocompletion({ override })` extensions.
          autocompletion({
            override: [
              wikilinkComplete,
              tagComplete,
              citationCompleteSource(() => cachedCitations),
              fenceLanguageComplete,
              directiveCompletionSource,
            ],
            defaultKeymap: true,
            // Typing-triggered completion is the last remaining source of
            // IME-hostile churn here. Keep the sources available for explicit
            // invocation, but do not wake them up on every keystroke.
            // Targeted extensions above wake only their own completion syntax.
            activateOnTyping: false,
          }),
          ...(IS_APP_STORE_BUILD ? [] : [aiKeyCompartment.of(aiRewriteExtension(currentAiRewriteKey()))]),
          spellcheckExtension({ enabled: () => settings.spellcheckEnabled }),
          spellcheckTheme,
          slashCompartment.of(slashExt()),
        ]
      : []),
    ...(windowsImeSafeMode || markdownSafeMode ? [] : [taskListExtension()]),
    foldCompartment.of(foldExtensionFor(settings.foldingEnabled)),
    sessionRestoreExtension(props.tab.id),
    // #167 — clicks during async widget renders (post tab-switch) must not
    // turn into phantom multi-line selections when the layout shifts.
    stableClickSelection(),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) {
        const text = u.state.doc.toString();
        if (!u.view.composing) syncEditorContentSoon(text);
      }
      if (u.docChanged && !u.view.composing && props.tab.language === 'markdown') {
        for (const tr of u.transactions) {
          if (!tr.isUserEvent('input.type')) continue;
          tr.changes.iterChanges((_fa, _ta, _fb, toB, inserted) => {
            if (inserted.length !== 1) return;
            const line = u.state.doc.lineAt(toB);
            noteTypedFormat(line.text.slice(0, toB - line.from), inserted.toString());
          });
        }
      }
      if (u.selectionSet) {
        const head = u.state.selection.main.head;
        const line = u.state.doc.lineAt(head);
        emit('cursor', line.number, head - line.from + 1);
        // v4.3.0 issue #70: emit selection text so StatusBar can show
        // selected word/char count. Empty string when nothing's selected.
        const sel = u.state.selection.main;
        emit('selection', sel.empty ? '' : u.state.sliceDoc(sel.from, sel.to));
      }
    }),
  ];
}

function maybeRestoreSession() {
  const saved = readSession(props.tab.id);
  if (!saved || saved === '' || props.tab.content !== '') return;
  if (usePlainWindowsEditor) {
    if (plainLiveEnabled.value) {
      plainText.value = saved;
      tabs.setContent(props.tab.id, saved);
      return;
    }
    const el = plainEditor.value;
    if (!el || el.value.length > 0) return;
    el.value = saved;
    tabs.setContent(props.tab.id, saved);
    emitPlainCursorAndSelection();
    return;
  }
  if (
    view &&
    view.state.doc.length === 0 &&
    saved !== view.state.doc.toString()
  ) {
    view.dispatch({ changes: { from: 0, to: 0, insert: saved } });
  }
}

onMounted(() => {
  // Registered before the plain-editor early return below — this listener has
  // to exist on ALL three editor paths, and the CodeMirror-only setup that
  // follows is unreachable on Windows. (Putting it further down is what made
  // the first attempt silently no-op on the plain editors.)
  window.addEventListener('solomd:transform-case', onTransformCase as EventListener);
  window.addEventListener('solomd:format-markdown', onFormatMarkdown as EventListener);
  cleanupTransformCase = () => {
    window.removeEventListener('solomd:transform-case', onTransformCase as EventListener);
    window.removeEventListener('solomd:format-markdown', onFormatMarkdown as EventListener);
  };

  if (usePlainWindowsEditor) installPlainOverlayListeners();

  if (usePlainWindowsEditor) {
    syncPlainEditorFromStore(props.tab.content);
    maybeRestoreSession();
    restoreFolds();
    void processPlainLiveRenderedBlocks();
    focusPlainEditor();
    // #126 — let the toolbar AI-rewrite button read this editor's selection
    // (no CodeMirror view exists on this path for it to scan).
    cleanupPlainSelection = registerPlainSelectionGetter(() => {
      const sel = plainAbsoluteSelection();
      const text = plainSelectionText();
      return sel && text ? { selection: text, from: sel.from, to: sel.to } : null;
    });
    return;
  }
  if (!host.value) return;
  view = new EditorView({
    state: EditorState.create({ doc: props.tab.content, extensions: buildExtensions() }),
    parent: host.value,
  });
  applyLazyLanguage(props.tab.language);
  maybeRestoreSession();
  restoreFolds();
  // Expose the focused EditorView on `window` for dev-bridge / self-test
  // harnesses. Vite injects `import.meta.env.DEV === true` only in dev
  // builds; production bundles dead-code-eliminate this entire block.
  if (import.meta.env.DEV) {
    (window as unknown as { __solomdActiveView?: EditorView }).__solomdActiveView = view;
  }
  // Right-sidebar pane visibility / splitter drags change the available
  // editor width, but CodeMirror's ResizeObserver may lag for a frame.
  // Listen for an explicit relayout event and force a re-measure. Used
  // by the search pane toggle (PR #50) and the rs-pane-host stack.
  const onRelayout = () => view?.requestMeasure();
  window.addEventListener('solomd:relayout', onRelayout);
  window.addEventListener('solomd:flush-content-sync', flushContentSync);
  cleanupRelayout = () => {
    window.removeEventListener('solomd:relayout', onRelayout);
    window.removeEventListener('solomd:flush-content-sync', flushContentSync);
  };
});

/**
 * Gitee IK8QG3 — upper / lower / Title case over the selection, or the word
 * under the caret when there is no selection.
 *
 * Deliberately routed through the same handler for all three editors this
 * component can be: CodeMirror, the plain block editor, and the plain flat
 * editor. Wiring only one of them is how the slash-command autocomplete came
 * to be dead on Windows for months (IK6JCC) — the shared decision of *what* to
 * change lives in lib/text-case.ts, and each branch below only supplies the
 * current text + selection and writes the result back.
 */
function onTransformCase(e: Event) {
  const detail = (e as CustomEvent).detail || {};
  const mode: CaseMode | 'cycle' = detail.mode || 'cycle';
  // Split view mounts one Editor per pane and they all hear this event, so
  // only the one showing the active tab may act.
  if (props.tab.id !== tabs.activeId) return;

  if (!usePlainWindowsEditor) {
    if (!view) return;
    const sel = view.state.selection.main;
    const doc = view.state.doc.toString();
    const target = caseTargetRange(doc, sel.from, sel.to);
    if (!target) return;
    const next = mode === 'cycle' ? nextCaseInCycle(target.text) : mode;
    const replaced = transformCase(target.text, next);
    if (replaced === target.text) return;
    view.dispatch({
      changes: { from: target.from, to: target.to, insert: replaced },
      selection: { anchor: target.from, head: target.from + replaced.length },
    });
    view.focus();
    return;
  }

  // Plain paths — the block editor edits one block's textarea, the flat one
  // edits the whole document, so resolve the element first and then share
  // the rest.
  const el = plainLiveEnabled.value
    ? plainBlockEditors.value[plainActiveBlock.value]
    : plainEditor.value;
  if (!el) return;
  const target = caseTargetRange(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0);
  if (!target) return;
  const next = mode === 'cycle' ? nextCaseInCycle(target.text) : mode;
  const replaced = transformCase(target.text, next);
  if (replaced === target.text) return;
  const value = el.value.slice(0, target.from) + replaced + el.value.slice(target.to);
  recordPlainHistory();
  if (plainLiveEnabled.value) {
    updatePlainBlock(plainActiveBlock.value, value, target.from + replaced.length);
    nextTick(() => {
      const e2 = plainBlockEditors.value[plainActiveBlock.value];
      if (e2) {
        e2.focus();
        e2.setSelectionRange(target.from, target.from + replaced.length);
      }
    });
    return;
  }
  el.value = value;
  plainText.value = value;
  tabs.setContent(props.tab.id, value);
  nextTick(() => {
    el.focus();
    el.setSelectionRange(target.from, target.from + replaced.length);
    emitPlainCursorAndSelection();
  });
}

/**
 * #296 / #274 — bold, italic, headings, lists… from a shortcut or the palette.
 *
 * Same shape as `onTransformCase` above, for the same reason: lib/md-format.ts
 * decides the edit from a string and a selection, and the three editors only
 * differ in how they hand those over and write the result back.
 */
function onFormatMarkdown(e: Event) {
  const kind = ((e as CustomEvent).detail || {}).kind as FormatKind;
  if (!FORMAT_KINDS.includes(kind)) return;
  if (props.tab.id !== tabs.activeId) return;
  if (props.tab.language !== 'markdown') return;

  if (!usePlainWindowsEditor) {
    if (!view) return;
    const sel = view.state.selection.main;
    const edit = applyFormat(view.state.doc.toString(), sel.from, sel.to, kind);
    view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
      selection: { anchor: edit.selFrom, head: edit.selTo },
      scrollIntoView: true,
      userEvent: 'input.format',
    });
    view.focus();
    return;
  }

  const el = plainLiveEnabled.value
    ? plainBlockEditors.value[plainActiveBlock.value]
    : plainEditor.value;
  if (!el) return;
  const edit = applyFormat(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0, kind);
  const value = el.value.slice(0, edit.from) + edit.insert + el.value.slice(edit.to);
  recordPlainHistory();
  if (plainLiveEnabled.value) {
    updatePlainBlock(plainActiveBlock.value, value, edit.selTo);
    nextTick(() => {
      const e2 = plainBlockEditors.value[plainActiveBlock.value];
      if (!e2) return;
      e2.focus();
      // A fence or a blank line can split the block, and then these offsets
      // belong to a different textarea — leave the caret where the re-split
      // put it rather than selecting the wrong text.
      if (e2.value === value) e2.setSelectionRange(edit.selFrom, edit.selTo);
    });
    return;
  }
  const keepScroll = el.scrollTop;
  el.value = value;
  plainText.value = value;
  tabs.setContent(props.tab.id, value);
  nextTick(() => {
    el.focus();
    el.setSelectionRange(edit.selFrom, edit.selTo);
    el.scrollTop = keepScroll;
    emitPlainCursorAndSelection();
  });
}

/**
 * #137 — open the find/replace UI. The panel already exists on both editor
 * paths (CodeMirror's search panel + the plain-textarea find bar) behind
 * Ctrl+F, but had no toolbar / command-palette entry, so users thought it was
 * gone. PaneContent forwards `solomd:editor-find` here for the focused pane.
 */
function openFind(): void {
  if (usePlainWindowsEditor) {
    openPlainFind();
    return;
  }
  if (view) {
    view.focus();
    openSearchPanel(view);
  }
}

/**
 * Open the grid editor on the table the caret is in.
 *
 * Works off the document text and line offsets rather than either editor's
 * internals, so the same code serves CodeMirror and the Windows plain
 * textarea; only the write-back differs.
 */
function openTableAtCursor(): void {
  const source = usePlainWindowsEditor ? plainText.value || '' : view?.state.doc.toString() ?? '';
  if (!source) {
    toasts.info(t('tableEditor.notInTable'));
    return;
  }
  const lines = source.split('\n');
  const caret = usePlainWindowsEditor
    ? plainCaretOffset()
    : view
      ? view.state.selection.main.head
      : 0;

  // Offset → line index, plus each line's start offset for the reverse trip.
  const starts: number[] = [];
  let off = 0;
  for (const line of lines) {
    starts.push(off);
    off += line.length + 1;
  }
  let caretLine = 0;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= caret) caretLine = i;
    else break;
  }

  const span = findTableSpan(lines, caretLine);
  if (!span) {
    toasts.info(t('tableEditor.notInTable'));
    return;
  }
  const from = starts[span.startLine];
  const to = starts[span.endLine] + lines[span.endLine].length;

  openTableEditor({
    source: source.slice(from, to),
    apply: (markdown: string) => replaceDocRange(from, to, markdown),
  });
}

/**
 * Open the formula editor on the math under the caret, or on an empty formula
 * when the caret is not in one — "insert a formula" and "fix this formula" are
 * the same action from the user's side.
 */
function openFormulaAtCursor(): void {
  const source = usePlainWindowsEditor ? plainText.value || '' : view?.state.doc.toString() ?? '';
  const caret = usePlainWindowsEditor
    ? plainCaretOffset()
    : view
      ? view.state.selection.main.head
      : 0;
  const span = findMathSpanAt(source, caret);
  const from = span ? span.from : caret;
  const to = span ? span.to : caret;

  openFormulaEditor({
    latex: span?.body ?? '',
    // A new formula defaults to inline; that is the common case, and the
    // dialog has a one-click switch for the other one.
    display: span?.display ?? false,
    labels: collectLabels(source),
    apply: (latex: string, display: boolean) =>
      replaceDocRange(from, to, formatMath(source, from, to, latex, display)),
  });
}

/**
 * Wrap a formula in the right delimiters for where it sits.
 *
 * A display formula gets its own lines only when nothing else shares them.
 * Turning `Inline $E=mc^2$ here.` into a three-line `$$` block would split the
 * sentence across the formula — the mid-sentence case has to stay on one line.
 */
function formatMath(
  source: string,
  from: number,
  to: number,
  latex: string,
  display: boolean,
): string {
  if (!display) return `$${latex}$`;
  const lineStart = source.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
  const lineEndIdx = source.indexOf('\n', to);
  const lineEnd = lineEndIdx < 0 ? source.length : lineEndIdx;
  const alone =
    source.slice(lineStart, from).trim() === '' && source.slice(to, lineEnd).trim() === '';
  return alone ? `$$\n${latex}\n$$` : `$$${latex}$$`;
}

/** Caret offset in the plain editor, in whole-document coordinates. */
function plainCaretOffset(): number {
  if (plainLiveEnabled.value) {
    const block = plainBlocks.value[plainActiveBlock.value];
    const el = plainBlockEditors.value[plainActiveBlock.value];
    return (block?.start ?? 0) + (el?.selectionStart ?? 0);
  }
  return plainEditor.value?.selectionStart ?? 0;
}

/** Replace a document range in whichever editor this pane is running. */
function replaceDocRange(from: number, to: number, text: string): void {
  if (usePlainWindowsEditor) {
    const src = plainText.value || '';
    recordPlainHistory();
    applyPlainContent(src.slice(0, from) + text + src.slice(to), from + text.length);
    return;
  }
  if (!view) return;
  view.dispatch({ changes: { from, to, insert: text } });
}

/**
 * Heading folding, driven from the command palette / shortcuts.
 *
 * `level` only applies to `'level'`. The Windows source textarea is the one
 * path that cannot fold — a <textarea> has no way to hide a line — so it says
 * so instead of silently doing nothing.
 */
function applyFold(action: 'toggle' | 'all' | 'none' | 'level', level = 2): void {
  if (!settings.foldingEnabled) {
    toasts.info(t('fold.disabledHint'));
    return;
  }
  if (props.tab.language !== 'markdown' && action !== 'none') {
    // Non-markdown files still fold their own blocks through the gutter and
    // CodeMirror's keymap; only the heading-level commands need a document
    // with headings.
    if (usePlainWindowsEditor) return;
  }

  if (usePlainWindowsEditor) {
    if (!plainLiveEnabled.value) {
      toasts.info(t('fold.plainSourceHint'));
      return;
    }
    const text = plainText.value || '';
    const spans = scanHeadings(text).filter((h) => h.foldable);
    if (action === 'none') {
      plainFolds.value = [];
      return;
    }
    if (action === 'all') {
      plainFolds.value = spans.map((h) => ({ line: h.line, title: h.title }));
      return;
    }
    if (action === 'level') {
      plainFolds.value = spans
        .filter((h) => h.level >= level)
        .map((h) => ({ line: h.line, title: h.title }));
      return;
    }
    const caret = plainBlocks.value[plainActiveBlock.value]?.start ?? 0;
    const enclosing = spans.filter((h) => caret >= h.start && caret <= h.end).pop();
    if (!enclosing) return;
    setPlainFold(enclosing, !plainFoldedLines.value.has(enclosing.line));
    return;
  }

  if (!view) return;
  view.focus();
  if (action === 'toggle') toggleHeadingFoldAtCursor(view);
  else if (action === 'all') foldAllHeadings(view);
  else if (action === 'none') unfoldAllFolds(view);
  else foldHeadingsToLevel(view, level);
}

onBeforeUnmount(() => {
  saveFolds();
  cleanupRelayout?.();
  cleanupTransformCase?.();
  cleanupTransformCase = null;
  cleanupPlainSelection?.();
  cleanupPlainSelection = null;
  disposePlainOverlays();
  if (contentSyncTimer) {
    // A Vim-mode toggle remounts the Windows editor. Flush the current
    // CodeMirror document before cancelling the debounce so the last keystroke
    // cannot disappear during that hand-off.
    if (view && !view.composing) tabs.setContent(props.tab.id, view.state.doc.toString());
    clearTimeout(contentSyncTimer);
    contentSyncTimer = null;
  }
  if (import.meta.env.DEV) {
    const w = window as unknown as { __solomdActiveView?: EditorView };
    if (w.__solomdActiveView === view) delete w.__solomdActiveView;
  }
  view?.destroy();
  view = null;
});

// Switching tabs: replace doc (and rebuild extensions so the
// session-restore plugin is recreated with the new tab id).
// #144 — per-tab caret + scroll memory (runtime-only, per editor pane; a tab
// shown in two split panes keeps an independent position in each). Without
// this, switching tabs dropped the position: the plain textarea's `el.value =`
// re-sync moves the caret to the END of the document, and the CodeMirror
// `setState` reset it to 0.
const tabCaretMemory = new Map<string, { caret: number; scrollTop: number }>();

// Folds are remembered per document (file path, else tab id) rather than per
// pane, so they also come back when a closed file is reopened this session.
function foldMemoryKey(tab: Tab): string {
  return tab.filePath ?? tab.id;
}
let foldKey = foldMemoryKey(props.tab);

function saveFolds(): void {
  if (usePlainWindowsEditor) rememberFolds(foldKey, anchorSnapshot(plainText.value, plainFolds.value));
  else if (view) rememberFolds(foldKey, captureFolds(view.state.doc.toString(), currentFoldRanges(view.state)));
}

function restoreFolds(): void {
  foldKey = foldMemoryKey(props.tab);
  const snapshot = settings.foldingEnabled ? recallFolds(foldKey) : null;
  if (usePlainWindowsEditor) {
    plainFolds.value = snapshot ? foldAnchorsFor(plainText.value, snapshot) : [];
    return;
  }
  if (view && snapshot) restoreFoldRanges(view, foldRangesFor(view.state.doc.toString(), snapshot));
}

// #169 (Windows) — one synchronous scrollTop assignment is not enough on the
// plain paths: focusPlainEditor() focuses on nextTick, and the browser then
// scrolls the caret back into view — line 1 when the user only scrolled and
// never clicked, which is exactly the reported "switch back → reset to top".
// The live block editor additionally re-renders its blocks asynchronously,
// growing scrollHeight after the restore. Pin the saved position through that
// settle window, backing off the moment the user scrolls themselves.
function restorePlainScroll(saved?: { caret: number; scrollTop: number }) {
  const scroller = (): HTMLElement | null =>
    plainLiveEnabled.value ? plainLiveHost.value : plainEditor.value;
  const el = scroller();
  if (!el) return;
  if (!plainLiveEnabled.value) {
    const ta = el as HTMLTextAreaElement;
    const pos = Math.min(saved?.caret ?? 0, ta.value.length);
    ta.setSelectionRange(pos, pos);
  }
  const st = saved?.scrollTop ?? 0;
  el.scrollTop = st;
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  const intentEvents = ['wheel', 'pointerdown', 'keydown', 'touchstart'] as const;
  for (const ev of intentEvents) el.addEventListener(ev, cancel, { passive: true });
  const reassert = () => {
    const cur = scroller();
    if (!cancelled && cur && Math.abs(cur.scrollTop - st) > 1) cur.scrollTop = st;
  };
  nextTick(() => requestAnimationFrame(reassert));
  setTimeout(reassert, 120);
  setTimeout(reassert, 400);
  setTimeout(() => {
    for (const ev of intentEvents) el.removeEventListener(ev, cancel);
  }, 800);
  setTimeout(reassert, 780);
}

watch(
  () => props.tab.id,
  (newId, oldId) => {
    // Snapshot the OUTGOING tab first — at this point the editor DOM/state
    // still holds the old document (re-sync happens below).
    if (oldId) {
      saveFolds();
      if (usePlainWindowsEditor) {
        if (plainLiveEnabled.value) {
          tabCaretMemory.set(oldId, {
            caret: 0,
            scrollTop: plainLiveHost.value?.scrollTop ?? 0,
          });
        } else if (plainEditor.value) {
          tabCaretMemory.set(oldId, {
            caret: plainEditor.value.selectionStart ?? 0,
            scrollTop: plainEditor.value.scrollTop,
          });
        }
      } else if (view) {
        tabCaretMemory.set(oldId, {
          caret: view.state.selection.main.head,
          scrollTop: view.scrollDOM.scrollTop,
        });
      }
    }
    const saved = newId ? tabCaretMemory.get(newId) : undefined;
    if (usePlainWindowsEditor) {
      // The Editor component is reused across tabs (no :key), so switching to /
      // creating a document must re-sync content, reset per-document state, and
      // re-focus — otherwise the new doc shows stale text and can't be typed in.
      plainSelectAll.value = false;
      setPlainSelectAllPending(false);
      plainActiveBlock.value = 0;
      resetPlainHistory();
      closePlainFind();
      syncPlainEditorFromStore(props.tab.content);
      maybeRestoreSession();
      restoreFolds();
      void processPlainLiveRenderedBlocks();
      focusPlainEditor();
      // Restore the caret/scroll (default: document START, not end — the
      // `el.value =` assignment above parked it at the end). Block live-edit
      // restores the scroll container only; per-block focus is its own.
      restorePlainScroll(saved);
      return;
    }
    if (!view) return;
    view.setState(
      EditorState.create({
        doc: props.tab.content,
        extensions: buildExtensions(),
        selection: { anchor: Math.min(saved?.caret ?? 0, props.tab.content.length) },
      })
    );
    applyLazyLanguage(props.tab.language);
    maybeRestoreSession();
    restoreFolds();
    if (saved) {
      // #169 — one synchronous assignment is not enough: async widget renders
      // (tables / images / mermaid) and CM's post-setState measure pass can
      // yank the viewport back to the caret, which sits on line 1 when the
      // user scrolled without ever clicking. Re-assert after layout, but ONLY
      // when the viewport was reset toward the top — never fight a scroll the
      // user just made themselves.
      const st = saved.scrollTop;
      view.scrollDOM.scrollTop = st;
      const reassert = () => {
        if (view && st > 50 && view.scrollDOM.scrollTop < 10) {
          view.scrollDOM.scrollTop = st;
        }
      };
      requestAnimationFrame(reassert);
      setTimeout(reassert, 120);
      setTimeout(reassert, 400);
    }
  }
);

// Clean-save watcher: when the buffer matches savedContent, drop any
// stale session snapshot for this tab.
watch(
  () => [props.tab.content, props.tab.savedContent] as const,
  ([content, saved]) => {
    if (content === saved) clearSession(props.tab.id);
  },
);

// #180 — a rebind in Settings reaches the open editor immediately; without
// this the new chord would only work in editors opened afterwards.
watch(
  () => currentAiRewriteKey(),
  (key) => {
    if (IS_APP_STORE_BUILD) return;
    view?.dispatch({ effects: aiKeyCompartment.reconfigure(aiRewriteExtension(key)) });
  },
);

function aiLockExtension(isLocked: boolean): Extension {
  return isLocked ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [];
}

watch(
  () => isAiWorking(props.tab.filePath),
  (isLocked) => {
    view?.dispatch({ effects: aiLockCompartment.reconfigure(aiLockExtension(isLocked)) });
  },
);

watch(
  () => props.spellCheck,
  (v) => {
    view?.dispatch({
      effects: spellCheckCompartment.reconfigure(spellCheckExt(v)),
    });
  },
);

watch(
  () => props.focusMode,
  (v) => {
    view?.dispatch({
      effects: focusCompartment.reconfigure(v ? focusModeExtension() : []),
    });
  },
);

watch(
  () => props.typewriterMode,
  (v) => {
    view?.dispatch({
      effects: typewriterCompartment.reconfigure(
        v ? typewriterModeExtension() : [],
      ),
    });
  },
);

// External content updates (e.g. after Save replacing savedContent only — content stays).
watch(
  () => props.tab.content,
  (next) => {
    if (usePlainWindowsEditor) {
      // The #186 defenses below were only ever applied to the CodeMirror
      // branch — this one returned before reaching them, so on Windows an
      // external content update still reset the caret and killed an in-flight
      // IME composition. Same two guards, expressed for the textarea.
      if (plainComposing.value) return;
      syncPlainEditorFromStore(next, true);
      return;
    }
    if (!view) return;
    if (view.state.doc.toString() !== next) {
      // #186 defense-in-depth: never interrupt an active IME composition —
      // dispatching here aborts it and strands the composed text — and keep
      // the caret at its old offset instead of letting the full-doc replace
      // map it to 0. (While the user is typing, the editor is the source of
      // truth; a skipped write is re-reconciled by the next content sync.)
      if (view.composing) return;
      const head = Math.min(view.state.selection.main.head, next.length);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: next },
        selection: { anchor: head },
      });
    }
  }
);

watch(
  () => themeStore.mode,
  (mode) => {
    view?.dispatch({ effects: themeCompartment.reconfigure(cmThemeFor(mode)) });
    // Live-edit Mermaid widgets carry their theme; rebuild the block field so
    // diagrams on screen re-render for the new light/dark family (#354).
    window.dispatchEvent(new CustomEvent('solomd:cm-relayout'));
  }
);

watch(
  () => settings.vimMode,
  (v) => {
    view?.dispatch({ effects: vimCompartment.reconfigure(v ? vim() : []) });
  }
);

watch(
  () => settings.wordWrap,
  (w) => {
    view?.dispatch({ effects: wrapCompartment.reconfigure(w ? EditorView.lineWrapping : []) });
  }
);

watch(
  () => settings.highlightCurrentLine,
  (on) => {
    view?.dispatch({ effects: activeLineCompartment.reconfigure(activeLineExtension(on)) });
  },
);

// #353 — markers shown/hidden is baked into the live bundles; swap them.
watch(
  () => settings.alwaysShowMarkers,
  () => {
    view?.dispatch({ effects: richCompartment.reconfigure(richExtensionsFor(props.tab)) });
  },
);

watch(
  () => settings.solidCursor,
  (solid) => {
    view?.dispatch({
      effects: cursorCompartment.reconfigure(
        drawSelection({ cursorBlinkRate: solid ? 0 : 1200 }),
      ),
    });
  },
);

watch(
  () => settings.showLineNumbers,
  (s) => {
    view?.dispatch({ effects: lineNumCompartment.reconfigure(s ? lineNumbers() : []) });
  }
);

watch(
  () => settings.foldingEnabled,
  (on) => {
    view?.dispatch({ effects: foldCompartment.reconfigure(foldExtensionFor(on)) });
    if (!on) plainFolds.value = [];
  }
);

// v4.10 #163 — the live-blocks field only rebuilds on doc/selection changes,
// so nudge it when the PlantUML toggle/server flips (same event the async
// Mermaid render uses).
watch(
  [() => settings.plantumlEnabled, () => settings.plantumlServer],
  () => {
    try {
      window.dispatchEvent(new CustomEvent('solomd:cm-relayout'));
    } catch {}
  }
);

watch(
  [() => settings.fontSize, () => settings.fontFamily],
  ([n, f]) => {
    view?.dispatch({ effects: fontSizeCompartment.reconfigure(fontSizeTheme(n, f)) });
  }
);

watch(
  () => props.tab.language,
  (l) => {
    view?.dispatch({
      effects: [
        langCompartment.reconfigure(createLanguageExtension(l)),
        directionCompartment.reconfigure(bidiExtension(
          l === 'markdown' || l === 'plaintext' ? undefined : 'ltr',
        )),
        richCompartment.reconfigure(richExtensionsFor(props.tab)),
      ],
    });
    applyLazyLanguage(l);
  }
);

watch(
  () => settings.livePreview,
  () => {
    view?.dispatch({ effects: richCompartment.reconfigure(richExtensionsFor(props.tab)) });
  }
);

// v2.3: switching into / out of `liveEdit` swaps the rich extension
// bundle (live-edit decorations are MUCH more aggressive than the
// livePreview fallback, so we need a real reconfigure).
watch(
  () => settings.viewMode,
  () => {
    view?.dispatch({ effects: richCompartment.reconfigure(richExtensionsFor(props.tab)) });
    syncPlainEditorAfterModeSwitch();
    void processPlainLiveRenderedBlocks();
  }
);

// A stale select-all must not survive leaving live edit (the merged single
// block would greet the user on re-entry).
watch(plainLiveEnabled, () => {
  plainSelectAll.value = false;
  setPlainSelectAllPending(false);
});

watch(
  () => [plainLiveEnabled.value, plainText.value, plainActiveBlock.value, themeStore.revision, settings.language],
  () => {
    // No mermaid.initialize here any more: the render pass configures it with
    // the current theme itself, and doing it here would load the renderer for
    // a document that has no diagrams.
    void processPlainLiveRenderedBlocks();
  },
  { flush: 'post' },
);

// v2.5: hot-toggle the slash-command extension when the user flips
// the setting. Only meaningful for markdown buffers — other languages
// never have the compartment in their bundle.
watch(
  () => settings.slashCommandsEnabled,
  () => {
    if (!view) return;
    if (props.tab.language !== 'markdown') return;
    view.dispatch({ effects: slashCompartment.reconfigure(slashExt()) });
  },
);

function gotoLine(line: number) {
  if (usePlainWindowsEditor) {
    if (plainLiveEnabled.value) {
      plainSetCaret(plainLineStartOffset(line));
      plainScrollToLine(line);
      return;
    }
    const el = plainEditor.value;
    if (!el) return;
    plainSetCaret(plainLineStartOffset(line));
    plainScrollToLine(line);
    return;
  }
  if (!view) return;
  const safe = Math.max(1, Math.min(line, view.state.doc.lines));
  const lineObj = view.state.doc.line(safe);
  view.dispatch({
    selection: { anchor: lineObj.from },
    effects: EditorView.scrollIntoView(lineObj.from, { y: 'start', yMargin: 40 }),
  });
  view.focus();
}

async function insertImageFromPath(srcPath: string): Promise<void> {
  if (usePlainWindowsEditor) {
    // Was `plainInsertText(srcPath)`: a dropped image file landed as a bare
    // path instead of an image link.
    const text = await imageTextFromPath(srcPath, imagePasteOpts());
    if (text) plainInsertText(text);
    return;
  }
  if (!view) return;
  await cmInsertImageFromPath(view, srcPath, imagePasteOpts());
}

/** Insert a markdown image link for a user-supplied URL (web image) at the
 *  cursor — no upload, no local copy. Used by the "Image from URL…" dialog. */
function insertImageUrl(url: string, alt = ''): void {
  const clean = (url || '').trim();
  if (!clean) return;
  if (usePlainWindowsEditor) {
    plainInsertText(markdownImage(clean, alt));
    return;
  }
  if (!view) return;
  insertMarkdown(markdownImage(clean, alt));
}

/**
 * Upload every *local* image referenced in the current document to the
 * configured image host and rewrite each link to the hosted URL. Skips links
 * that are already remote (http/https/data). Reports progress + a final count
 * via toasts. No-op (with a hint) when no uploader is configured.
 */
async function uploadLocalImages(): Promise<void> {
  if (!view) return;
  const up0 = resolveUploader(settings as unknown as ImageUploadSettings, 'x.png');
  if (settings.imageUploader === 'none' || !up0) {
    toasts.info(t('toast.noUploaderConfigured'));
    return;
  }
  const doc = view.state.doc.toString();
  // Match markdown image links with a local (non-remote) src.
  const re = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const targets: { src: string }[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc))) {
    const src = m[1];
    if (/^(https?:|data:)/i.test(src)) continue;
    if (seen.has(src)) continue;
    seen.add(src);
    targets.push({ src });
  }
  if (targets.length === 0) {
    toasts.info(t('toast.noLocalImages'));
    return;
  }
  let done = 0;
  let uploaded = 0;
  for (const tgt of targets) {
    done++;
    toasts.info(t('toast.uploadingProgress', { done, total: targets.length }));
    try {
      const abs = await resolveLocalImageAbsPath(tgt.src);
      if (!abs) continue;
      const filename = abs.split(/[\\/]/).pop() || 'image.png';
      const resolved = resolveUploader(settings as unknown as ImageUploadSettings, filename);
      if (!resolved) break;
      const url = await uploadImage(resolved.cfg, abs);
      // Replace every occurrence of this exact src in the live doc.
      replaceAllImageSrc(tgt.src, url);
      uploaded++;
    } catch (err) {
      console.error('[Editor] uploadLocalImages failed for', tgt.src, err);
    }
  }
  if (uploaded > 0) toasts.success(t('toast.uploadedCount', { n: uploaded }));
  else toasts.error(t('toast.imageUploadFailedShort'));
}

/** Resolve a markdown image src (relative / imageRoot / absolute) to an
 *  absolute filesystem path for upload. */
async function resolveLocalImageAbsPath(src: string): Promise<string | null> {
  const { resolveImagePath } = await import('../../../lib/image-resolve');
  const imageRoot = parseFrontMatterImageRoot(props.tab.content) ?? null;
  // resolveImagePath decodes the src exactly once itself; decoding here too
  // turned a file named `100%.png` (written as `100%25.png`) into garbage.
  const abs = resolveImagePath(src, imageRoot, props.tab.filePath);
  return abs || null;
}

/** Replace every `](oldSrc)` occurrence in the live doc with the new URL. */
function replaceAllImageSrc(oldSrc: string, newUrl: string): void {
  if (!view) return;
  const doc = view.state.doc.toString();
  const changes: { from: number; to: number; insert: string }[] = [];
  const needle = `](${oldSrc})`;
  let idx = doc.indexOf(needle);
  while (idx >= 0) {
    const from = idx + 2; // after `](`
    const to = idx + 2 + oldSrc.length;
    changes.push({ from, to, insert: encodeImageDestination(newUrl) });
    idx = doc.indexOf(needle, idx + needle.length);
  }
  if (changes.length) view.dispatch({ changes });
}

/** Minimal front-matter `imageRoot` reader (mirror of the paste helper). */
function parseFrontMatterImageRoot(source: string): string | undefined {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!fm) return undefined;
  const im = /^(?:imageRoot|image_root|typora-root-url)\s*:\s*(.+?)\s*$/m.exec(fm[1]);
  return im ? im[1].replace(/^["']|["']$/g, '').trim() || undefined : undefined;
}

function getLineSelection(): { fromLine: number; toLine: number; headLine: number; isEmpty: boolean } | null {
  if (usePlainWindowsEditor || !view) return null;
  const { doc, selection } = view.state;
  const main = selection.main;
  const toLine = doc.lineAt(main.to);
  const endsAtLineStart = !main.empty && main.to === toLine.from && toLine.number > 1;
  return {
    fromLine: doc.lineAt(main.from).number,
    toLine: endsAtLineStart ? toLine.number - 1 : toLine.number,
    headLine: doc.lineAt(main.head).number,
    isEmpty: main.empty,
  };
}

/** Returns the 1-indexed line currently at the top of the visible viewport. */
function getViewLine(): number | null {
  if (usePlainWindowsEditor) {
    if (plainLiveEnabled.value) {
      const block = plainBlocks.value[plainActiveBlock.value];
      if (!block) return 1;
      return plainText.value.slice(0, block.start).split('\n').length;
    }
    const el = plainEditor.value;
    if (!el) return null;
    const top = el.scrollTop;
    const tops = plainLineTops.value;
    if (tops) {
      // Largest line whose measured top is at/above the viewport top, plus
      // the fraction of that line already scrolled past — split-pane sync
      // interpolates on it so the panes stay level inside tall wrapped lines.
      const y = Math.max(0, top - plainPaddingTopPx(el));
      let lo = 0;
      let hi = tops.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (tops[mid] <= y) lo = mid;
        else hi = mid - 1;
      }
      const h = lo + 1 < tops.length ? tops[lo + 1] - tops[lo] : plainLineHeightPx();
      const frac = h > 0 ? Math.min(0.999, (y - tops[lo]) / h) : 0;
      return lo + 1 + Math.max(0, frac);
    }
    const line = Math.max(1, Math.floor(top / plainLineHeightPx()) + 1);
    return line;
  }
  if (!view) return null;
  const top = view.scrollDOM.scrollTop;
  const block = view.lineBlockAtHeight(top);
  const frac =
    block.height > 0 ? Math.max(0, Math.min(0.999, (top - block.top) / block.height)) : 0;
  return view.state.doc.lineAt(block.from).number + frac;
}

/**
 * Top of the given 1-indexed line in the editor's scrollTop coordinate space,
 * or null while metrics are unavailable. The split-pane sync interpolates
 * between two of these to keep the panes pixel-level, not just line-level.
 */
function lineTopY(line: number): number | null {
  if (usePlainWindowsEditor) {
    if (plainLiveEnabled.value) return null;
    const el = plainEditor.value;
    const tops = plainLineTops.value;
    if (!el || !tops) return null;
    const i = Math.max(0, Math.min(Math.floor(line) - 1, tops.length - 1));
    return plainPaddingTopPx(el) + tops[i];
  }
  if (!view) return null;
  const safe = Math.max(1, Math.min(Math.floor(line), view.state.doc.lines));
  return view.lineBlockAt(view.state.doc.line(safe).from).top;
}

/**
 * Scroll the given 1-indexed line to the top of the viewport (without moving
 * the cursor). Accepts fractional lines (12.5 = halfway down line 12) so the
 * split-pane sync can interpolate inside tall wrapped lines.
 */
function scrollToLine(line: number): void {
  if (usePlainWindowsEditor) {
    plainScrollToLine(line);
    return;
  }
  if (!view) return;
  const safe = Math.max(1, Math.min(Math.floor(line), view.state.doc.lines));
  const frac = Math.max(0, Math.min(line - safe, 0.999));
  const lineObj = view.state.doc.line(safe);
  if (frac > 0.001) {
    const block = view.lineBlockAt(lineObj.from);
    const y = view.documentTop + block.top + frac * block.height;
    const scroller = view.scrollDOM.getBoundingClientRect();
    view.scrollDOM.scrollTop += y - scroller.top - 8;
    return;
  }
  view.dispatch({
    effects: EditorView.scrollIntoView(lineObj.from, { y: 'start', yMargin: 8 }),
  });
}

/**
 * Insert markdown snippet at the current cursor. If `snippet` contains a
 * literal `$|$` marker, the cursor lands there after insert (marker stripped).
 * Otherwise the cursor is placed at the end of the inserted text.
 */
function insertMarkdown(snippet: string): void {
  if (usePlainWindowsEditor) {
    plainInsertText(snippet);
    return;
  }
  if (!view) return;
  const CURSOR = '$|$';
  const cursorIdx = snippet.indexOf(CURSOR);
  const finalText = cursorIdx >= 0 ? snippet.replace(CURSOR, '') : snippet;
  const sel = view.state.selection.main;
  // Add a leading newline if not already at the start of a line, for block-level snippets.
  const needsLeadingBreak = snippet.startsWith('\n') && sel.from > 0 &&
    view.state.doc.sliceString(sel.from - 1, sel.from) !== '\n';
  const insertText = needsLeadingBreak ? '\n' + finalText : finalText;
  const adjust = needsLeadingBreak ? 1 : 0;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: insertText },
    selection: {
      anchor: cursorIdx >= 0 ? sel.from + cursorIdx + adjust : sel.from + insertText.length,
    },
  });
  view.focus();
}

defineExpose({ getLineSelection, gotoLine, insertImageFromPath, insertImageUrl, uploadLocalImages, getViewLine, scrollToLine, lineTopY, insertMarkdown, openFind, applyFold, openTableAtCursor, openFormulaAtCursor });

const cls = computed(() => ({
  'cm-host': true,
  'cm-host--dark': themeStore.mode === 'dark',
  // #109 — constrain the editing column to a centered readable width.
  'cm-host--limit-width': settings.limitEditorWidth,
  // #211 — soft-wrap fenced code in the LIVE-rendered blocks too. Only
  // Preview.vue carried `cb-wrap-on` before, so the code-block-wrap setting
  // silently did nothing in Live Edit (CodeMirror live blocks + the Windows
  // plain block editor both render through this host). Same class name +
  // CSS as the preview so behaviour matches across modes.
  'cb-wrap-on': settings.codeBlockWrap,
}));
</script>

<template>
  <div
    v-if="!usePlainWindowsEditor"
    :class="cls"
    ref="host"
    @contextmenu="onEditorContextMenu"
  ></div>
  <div
    v-else
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

    <!-- In-document find / replace (Ctrl+F). The textarea path has no CodeMirror
         search panel, so this provides one. -->
    <div
      v-if="plainFindOpen"
      ref="plainFindBar"
      class="plain-find"
      :class="{ 'plain-find--dodge': plainFindDodge }"
      @keydown.esc.prevent.stop="closePlainFind(true)"
    >
      <div class="plain-find__row">
        <!-- Enter / Shift+Enter step through matches and keep focus here;
             Esc hands the editor the current match (#330). -->
        <input
          ref="plainFindInput"
          class="plain-find__input"
          :value="plainFindQuery"
          :placeholder="t('plainFind.findPlaceholder')"
          @input="(e) => onPlainFindInput((e.target as HTMLInputElement).value, (e as InputEvent).isComposing)"
          @compositionend="(e) => onPlainFindInput((e.target as HTMLInputElement).value)"
          @keydown.enter="onPlainFindEnter"
        />
        <span class="plain-find__count">{{ plainMatches.length ? (plainMatchIndex + 1) + '/' + plainMatches.length : '0/0' }}</span>
        <button class="plain-find__btn" :title="t('plainFind.prev')" @click="gotoPlainMatch(-1)">‹</button>
        <button class="plain-find__btn" :title="t('plainFind.next')" @click="gotoPlainMatch(1)">›</button>
        <button
          class="plain-find__btn"
          :class="{ 'plain-find__btn--on': plainFindCaseSensitive }"
          :title="t('plainFind.matchCase')"
          @click="plainFindCaseSensitive = !plainFindCaseSensitive; revealPlainMatchFromAnchor()"
        >Aa</button>
        <button class="plain-find__btn" :title="t('plainFind.close')" @click="closePlainFind(true)">✕</button>
      </div>
      <div class="plain-find__row">
        <input
          class="plain-find__input"
          :value="plainReplaceValue"
          :placeholder="t('plainFind.replacePlaceholder')"
          @input="(e) => plainReplaceValue = (e.target as HTMLInputElement).value"
          @keydown.enter="(e) => { if (!e.isComposing && e.keyCode !== 229) { e.preventDefault(); replacePlainCurrent(); } }"
        />
        <button class="plain-find__btn plain-find__btn--text" @click="replacePlainCurrent">{{ t('plainFind.replaceOne') }}</button>
        <button class="plain-find__btn plain-find__btn--text" @click="replacePlainAll">{{ t('plainFind.replaceAll') }}</button>
      </div>
    </div>

    <!-- Autocomplete popup (/ slash, [[ wikilink, # tag, @ citation,
         ``` fence language). -->
    <ul
      v-if="acOpen && acItems.length"
      class="plain-ac"
      :style="{ left: acPos.left + 'px', top: acPos.top + 'px' }"
    >
      <li
        v-for="(item, i) in acItems"
        :key="i"
        class="plain-ac__item"
        :class="{ 'plain-ac__item--active': i === acIndex }"
        @mousedown.prevent="applyPlainAutocomplete(item)"
        @mouseenter="acIndex = i"
      >
        <span class="plain-ac__label">{{ item.label }}</span>
        <span v-if="item.hint" class="plain-ac__hint">{{ item.hint }}</span>
      </li>
    </ul>
  </div>
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
.cm-host--limit-width.plain-block-editor :deep(.plain-block),
.cm-host--limit-width.plain-block-editor :deep(.plain-block__textarea),
.cm-host--limit-width :deep(.plain-editor) {
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
.plain-host {
  position: relative;
  height: 100%;
  width: 100%;
}
.plain-find {
  position: absolute;
  top: 8px;
  right: 16px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--bg-elevated, var(--bg));
  border: 1px solid var(--border, rgba(127, 127, 127, 0.35));
  border-radius: 8px;
  padding: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}
/* #330 — the current match would sit under the bar (only possible near the
   top of the document, where it cannot be scrolled lower): dock at the bottom. */
.plain-find--dodge {
  top: auto;
  bottom: 8px;
}
/* #330 — the current match. Translucent so the glyphs underneath stay legible;
   above the textarea, never takes a click. */
.plain-find-hl {
  position: absolute;
  z-index: 2;
  border-radius: 2px;
  background: var(--accent);
  opacity: 0.35;
  pointer-events: none;
}
.plain-find__row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.plain-find__input {
  width: 200px;
  padding: 4px 8px;
  border: 1px solid var(--border, rgba(127, 127, 127, 0.35));
  border-radius: 5px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  outline: none;
}
.plain-find__input:focus {
  border-color: var(--accent, #ff9f40);
}
.plain-find__count {
  font-size: 12px;
  color: var(--text-faint, #888);
  min-width: 40px;
  text-align: center;
}
.plain-find__btn {
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.plain-find__btn:hover {
  background: var(--bg-hover, rgba(127, 127, 127, 0.15));
}
.plain-find__btn--on {
  color: var(--accent, #ff9f40);
  border-color: var(--accent, #ff9f40);
}
.plain-find__btn--text {
  font-size: 12px;
}
.plain-ac {
  position: fixed;
  z-index: 30;
  margin: 0;
  padding: 4px;
  list-style: none;
  min-width: 180px;
  max-width: 360px;
  max-height: 280px;
  overflow-y: auto;
  background: var(--bg-elevated, var(--bg));
  border: 1px solid var(--border, rgba(127, 127, 127, 0.35));
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
}
.plain-ac__item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
}
.plain-ac__item--active {
  background: var(--accent, #ff9f40);
  color: var(--accent-fg, #fff);
}
.plain-ac__hint {
  font-size: 11px;
  opacity: 0.7;
  white-space: nowrap;
}
.plain-editor {
  height: 100%;
  width: 100%;
  resize: none;
  border: 0;
  outline: none;
  box-sizing: border-box;
  padding: 12px 16px;
  background: var(--bg);
  color: var(--text);
  font-family: var(--plain-editor-font-family, var(--font-editor, var(--font-mono)));
  font-size: var(--plain-editor-font-size, 14px);
  line-height: 1.6;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
}
.plain-editor.plain-textarea--wrap {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  overflow-x: hidden;
}
.plain-source {
  display: flex;
  /* Anchors the focus shade and the drawn caret (#316); clipping keeps a
     caret that has scrolled out of the textarea from painting over the UI. */
  position: relative;
  overflow: hidden;
}
/* #316 — focus mode's dimming for the flat textarea. Painted in the editor's
   own background at 0.65, which reads the same as the 0.35 text opacity the
   CodeMirror extension applies. */
.plain-shade {
  position: absolute;
  right: 0;
  z-index: 1;
  background: var(--bg);
  opacity: 0.65;
  pointer-events: none;
  transition: opacity 0.12s ease;
}
/* #316 — the non-blinking caret drawn for the solid cursor, matching the 2px accent
   bar of CodeMirror's .cm-cursor. */
.plain-caret {
  position: absolute;
  width: 2px;
  z-index: 2;
  background: var(--accent);
  pointer-events: none;
}
/* Both textareas, and written as a compound selector so it still wins
   against `.plain-block__textarea { caret-color: var(--accent) }` further
   down the sheet — at equal specificity the later rule would take it, and
   the native caret would blink on next to the drawn one. */
.plain-editor.plain-textarea--solid-caret,
.plain-block__textarea.plain-textarea--solid-caret {
  caret-color: transparent;
}
.plain-source .plain-editor {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
}
.plain-gutter {
  flex: none;
  overflow: hidden;
  box-sizing: border-box;
  /* Top padding must match .plain-editor's 12px or numbers drift off rows. */
  padding: 12px 8px 12px 0;
  border-right: 1px solid var(--border, rgba(127, 127, 127, 0.25));
  background: var(--bg);
  color: var(--text-faint, #999);
  font-family: var(--plain-editor-font-family, var(--font-editor, var(--font-mono)));
  font-size: var(--plain-editor-font-size, 14px);
  line-height: 1.6;
  text-align: right;
  user-select: none;
}
.plain-gutter__num {
  box-sizing: border-box;
}
.plain-block-editor {
  overflow: auto;
  /* Anchors the drawn caret (#316). */
  position: relative;
  padding: 12px 16px 80px;
  box-sizing: border-box;
  font-family: var(--plain-editor-font-family, var(--font-editor, var(--font-mono)));
  font-size: var(--plain-editor-font-size, 14px);
  line-height: 1.6;
}
.plain-block {
  position: relative;
  min-height: 1.6em;
  padding: 1px 0;
}
.plain-block--active {
  background: var(--bg);
}
/* #316 — focus mode in the block live editor: one element per paragraph
   already exists, so the inactive ones just dim. Same 0.35 the CodeMirror
   extension uses for a dimmed line. */
.plain-block-editor--focus .plain-block {
  opacity: 0.35;
  transition: opacity 0.12s ease;
}
.plain-block-editor--focus .plain-block--active {
  opacity: 1;
}
/* Fold chevron for heading blocks. Sits in the left margin so it never
   reflows the heading text; only visible on hover (or while folded) so an
   unfolded document reads exactly as it did before folding existed. */
.plain-fold-toggle {
  position: absolute;
  left: -14px;
  top: 2px;
  width: 14px;
  height: 1.4em;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--fg-dim, #888);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;
  font-size: 12px;
  line-height: 1;
}
.plain-block:hover .plain-fold-toggle,
.plain-fold-toggle--folded,
.plain-fold-toggle:focus-visible {
  opacity: 1;
}
.plain-fold-count {
  position: absolute;
  right: 8px;
  top: 2px;
  padding: 0 6px;
  border-radius: 4px;
  background: rgba(127, 127, 127, 0.18);
  color: var(--fg-dim, #888);
  font-size: 0.8em;
  cursor: pointer;
  user-select: none;
}
.plain-block__textarea {
  display: block;
  width: 100%;
  min-height: 1.6em;
  resize: none;
  border: 0;
  outline: none;
  box-sizing: border-box;
  padding: 0;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  caret-color: var(--accent);
  font: inherit;
  line-height: inherit;
  tab-size: 2;
  white-space: pre;
}
.plain-block__textarea.plain-textarea--wrap {
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
.plain-block__textarea::selection {
  background: rgba(255, 159, 64, 0.28);
}
.plain-block__render {
  color: var(--text);
  overflow: visible;
  /* #143 — rendered (non-focused) blocks must use the SAME user-configured
     editor font as the focused textarea block, or live-edit looks like two
     different documents (only the focused line honored font / font size). Fall back
     to the old values for safety. */
  font-family: var(--plain-editor-font-family, var(--font-ui));
  font-size: var(--plain-editor-font-size, 15px);
  line-height: 1.7;
  padding: 0.05em 0;
}
.plain-block__render :deep(h1),
.plain-block__render :deep(h2),
.plain-block__render :deep(h3),
.plain-block__render :deep(h4) {
  font-weight: 700;
  line-height: 1.25;
  margin: 1.1em 0 0.45em;
}
.plain-block__render :deep(h1),
.plain-block__render :deep(h2) {
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.25em;
}
.plain-block__render :deep(h1) {
  font-size: 2em;
}
.plain-block__render :deep(h2) {
  font-size: 1.5em;
}
.plain-block__render :deep(h3) {
  font-size: 1.2em;
}
.plain-block__render :deep(p),
.plain-block__render :deep(ul),
.plain-block__render :deep(ol),
.plain-block__render :deep(blockquote),
.plain-block__render :deep(pre),
.plain-block__render :deep(table) {
  margin-top: 0;
  margin-bottom: 0.8em;
}
.plain-block__render :deep(p) {
  white-space: pre-wrap;
}
.plain-block__render :deep(a) {
  color: var(--accent);
  text-decoration: none;
}
.plain-block__render :deep(a:hover) {
  text-decoration: underline;
}
.plain-block__render :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--bg-hover);
  padding: 0.15em 0.4em;
  border-radius: 4px;
}
.plain-block__render :deep(pre) {
  font-family: var(--font-mono);
  background: var(--bg-hover);
  padding: 14px 16px;
  border-radius: 6px;
  overflow-x: auto;
}
.plain-block__render :deep(pre code) {
  display: block;
  background: transparent;
  padding: 0;
}
/* #211 — when the code-block-wrap setting is on, the LIVE-rendered code
 * blocks soft-wrap like the preview does, instead of the default horizontal
 * scroll. `cb-wrap-on` is set on this host via `cls` (Editor.vue) from
 * settings.codeBlockWrap — same class + rules as Preview.vue's
 * `.cb-wrap-on pre`, so wrapping is identical across modes. */
.cb-wrap-on .plain-block__render :deep(pre) {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-word;
  overflow-x: visible;
}
/* #164 — live-edit blocks honor the same `codeBlockLineNumbers` setting as
 * the preview pane (markdown.ts always emits the .cb-line wrappers; this is
 * the same pure-CSS activation Preview.vue uses, incl. the newline-collapse
 * that keeps line spacing single). */
.plain-block-editor--cb-numbers .plain-block__render :deep(pre.cb-numbered) {
  counter-reset: cb-line;
}
.plain-block-editor--cb-numbers .plain-block__render :deep(pre.cb-numbered code) {
  white-space: normal;
}
.plain-block-editor--cb-numbers .plain-block__render :deep(pre.cb-numbered code .cb-line) {
  counter-increment: cb-line;
  display: block;
  padding-left: 3.4em;
  position: relative;
  white-space: pre;
}
/* #211 — code-block-wrap wins over line numbers here too (mirrors Preview.vue):
 * long numbered lines soft-wrap instead of overflowing when both toggles on. */
.cb-wrap-on.plain-block-editor--cb-numbers .plain-block__render :deep(pre.cb-numbered code .cb-line) {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-word;
}
.plain-block-editor--cb-numbers .plain-block__render :deep(pre.cb-numbered code .cb-line::before) {
  content: counter(cb-line);
  position: absolute;
  left: 0;
  width: 2.6em;
  padding-right: 0.6em;
  text-align: right;
  color: var(--text-faint);
  border-right: 1px solid var(--border);
  user-select: none;
  -webkit-user-select: none;
}
.plain-block__render :deep(blockquote) {
  border-left: 3px solid var(--accent);
  padding: 0.2em 1em;
  color: var(--text-muted);
}
.plain-block__render :deep(ul),
.plain-block__render :deep(ol) {
  padding-left: 1.6em;
}
.plain-block__render :deep(table) {
  border-collapse: collapse;
  max-width: 100%;
}
.plain-block__render :deep(th),
.plain-block__render :deep(td) {
  border: 1px solid var(--border);
  padding: 6px 12px;
}
.plain-block__render :deep(thead th) {
  background: var(--bg-soft);
  font-weight: 600;
}
.plain-block__render :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1.6em 0;
}
.plain-block__render :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}
.plain-block__render :deep(.katex-display) {
  overflow-x: auto;
  overflow-y: hidden;
  margin: 1em 0;
  text-align: center;
}
.plain-block__render :deep(.plain-mermaid-block),
.plain-block__render :deep(.plain-graphviz-block),
.plain-block__render :deep(.plain-plantuml-block),
.plain-block__render :deep(.plain-whiteboard-block) {
  margin: 1em 0;
  max-width: 100%;
  overflow: auto;
}
.plain-block__render :deep(.plain-mermaid-block svg),
.plain-block__render :deep(.plain-graphviz-block svg),
.plain-block__render :deep(.plain-plantuml-block img),
.plain-block__render :deep(.plain-whiteboard-block svg) {
  max-width: 100%;
  height: auto;
}
.plain-block__render :deep(.plain-whiteboard-block) {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
}
.plain-block__render :deep(.plain-whiteboard-block--clickable) {
  cursor: pointer;
}
.plain-block__render :deep(.plain-block__broken) {
  color: var(--danger);
  white-space: pre-wrap;
}
</style>
