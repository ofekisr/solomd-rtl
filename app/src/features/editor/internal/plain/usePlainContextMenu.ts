import { readClipboard, writeClipboard } from '../../../context-menu/contracts/index.ts';
import type { EditorMenuAction } from '../../../../components/EditorContextMenu.vue';
import type { PlainApiStage11 } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

export function usePlainContextMenu(_deps: PlainDeps, api: PlainApiStage11) {
  const {
    clearStrayDocumentSelection, emitPlainCursorAndSelection, enterPlainSelectAll, plainActiveTextarea,
    plainLiveEnabled,
  } = api;

  let ctxTextarea: HTMLTextAreaElement | null = null;
  let ctxSavedRange: { el: HTMLTextAreaElement; start: number; end: number } | null = null;

  /** Right mousedown: remember the textarea selection before anything can
   *  collapse it (on WebView2 a textarea selection is mirrored into the page
   *  selection, and page-selection cleanup used to wipe it on right-click). */
  function onEditorMouseDownCapture(event: MouseEvent) {
    if (event.button !== 2) return;
    const el = event.target;
    if (el instanceof HTMLTextAreaElement) {
      ctxSavedRange = { el, start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
    } else {
      ctxSavedRange = null;
    }
  }

  /** Plain branch of the context-menu handler; returns whether a selection exists. */
  function resolvePlainContextMenu(event: MouseEvent): boolean {
    const el = event.target instanceof HTMLTextAreaElement ? event.target : plainActiveTextarea();
    ctxTextarea = el;
    if (el && ctxSavedRange && ctxSavedRange.el === el
      && ctxSavedRange.start !== ctxSavedRange.end
      && el.selectionStart === el.selectionEnd) {
      // Something collapsed the selection between mousedown and here; the
      // user right-clicked a selection, so put it back.
      el.setSelectionRange(ctxSavedRange.start, ctxSavedRange.end);
    }
    return !!el && el.selectionStart !== el.selectionEnd;
  }

  function plainContextSelectionText(): string {
    const el = ctxTextarea ?? plainActiveTextarea();
    return el ? el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0) : '';
  }

  function clearPlainContextTextarea() {
    ctxTextarea = null;
  }

  function clearPlainContextSavedRange() {
    ctxSavedRange = null;
  }

  async function runPlainEditorMenuAction(id: EditorMenuAction) {
    const el = ctxTextarea ?? plainActiveTextarea();
    ctxTextarea = null;
    if (id === 'selectAll') {
      if (plainLiveEnabled.value) {
        enterPlainSelectAll();
      } else if (el) {
        el.focus();
        el.select();
        clearStrayDocumentSelection(el);
        emitPlainCursorAndSelection();
      }
      return;
    }
    if (!el) return;
    el.focus();
    if (id === 'copy' || id === 'cut') {
      const text = el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0);
      if (!text) return;
      await writeClipboard(text);
      if (id === 'cut') {
        el.focus();
        // execCommand keeps the edit on the textarea's own undo stack and fires
        // the input event our block/flat handlers listen to.
        document.execCommand('delete');
      }
    } else if (id === 'paste') {
      const text = await readClipboard();
      if (!text) return;
      el.focus();
      document.execCommand('insertText', false, text);
    }
  }

  return {
    onEditorMouseDownCapture,
    resolvePlainContextMenu,
    plainContextSelectionText,
    clearPlainContextTextarea,
    clearPlainContextSavedRange,
    runPlainEditorMenuAction,
  };
}
