import { IS_APP_STORE_BUILD } from '../../../../lib/app-build';
import { caretRowInfo, firstVisualRowEnd, lastVisualRowStart } from '../../../../lib/textarea-metrics';
import { computePlainTabEdit, computeSmartEnter } from './plain-edits.ts';
import { nextTick } from 'vue';
import { useTabsStore } from '../../../../stores/tabs';
import { late } from './plain-late.ts';
import type { PlainApiStage8 } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

export function usePlainKeys(deps: PlainDeps, api: PlainApiStage8) {
  const { props } = deps;
  const tabs = useTabsStore();
  const { emitPlainCursorAndSelection, handleAutocompleteKeydown, openPlainFind, plainActiveBlock, plainBlockEditors, plainBlocks, plainComposing, plainEditor, plainLiveEnabled, plainRedo, plainSelectAll, plainSelectionText, plainText, plainUndo, recordPlainHistory } = api;
  const activatePlainBlock = late(api, 'activatePlainBlock');
  const applyPlainFullEdit = late(api, 'applyPlainFullEdit');
  const enterPlainSelectAll = late(api, 'enterPlainSelectAll');
  const maybeExitPlainSelectAll = late(api, 'maybeExitPlainSelectAll');
  const updatePlainBlock = late(api, 'updatePlainBlock');

  /** Shared keydown handling (undo/redo, Tab indent) for the plain editors. */
  function handlePlainKeydownShared(event: KeyboardEvent): boolean {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && !event.altKey && (event.key === 'f' || event.key === 'F')) {
      event.preventDefault();
      openPlainFind();
      return true;
    }
    if (mod && !event.altKey && (event.key === 'z' || event.key === 'Z')) {
      event.preventDefault();
      if (event.shiftKey) plainRedo();
      else plainUndo();
      return true;
    }
    if (mod && !event.altKey && (event.key === 'y' || event.key === 'Y')) {
      event.preventDefault();
      plainRedo();
      return true;
    }
    // Ctrl/Cmd+A — whole-document select-all.
    //   • Live block editor: merge blocks into one textarea and select it
    //     (native select-all otherwise stops at the current block).
    //   • Single-textarea (edit-only / split): select the textarea's own
    //     content in JS and preventDefault. #189/#210 — on Windows WebView2 the
    //     native Ctrl+A / Edit→Select All escalates to a PAGE-level document
    //     selection (the whole editor chrome, not just the field). That document
    //     Range then can't be cleared by a click, so the editor reads as
    //     "frozen" until a reload/tab-switch rebuilds the DOM. Owning the key
    //     ourselves keeps the selection scoped to the field and never lets the
    //     page-level select-all fire. Verified in the real WebView2 engine that
    //     a textarea selection there also mirrors into `window.getSelection()`,
    //     so we clear that stray document Range too (harmless on Mac/Linux where
    //     it's already empty).
    if (mod && !event.altKey && (event.key === 'a' || event.key === 'A')) {
      event.preventDefault();
      if (plainLiveEnabled.value) {
        enterPlainSelectAll();
      } else {
        const el = plainEditor.value;
        if (el) {
          el.focus();
          el.select();
          clearStrayDocumentSelection(el);
          emitPlainCursorAndSelection();
        }
      }
      return true;
    }
    // Ctrl/Cmd+J — AI rewrite of the selection (matches cm-ai-rewrite). The
    // overlay + accept path are shared with the CodeMirror editor; accept replaces
    // the (retained) selection via the insert-markdown channel.
    if (!IS_APP_STORE_BUILD && mod && !event.altKey && (event.key === 'j' || event.key === 'J')) {
      const sel = plainAbsoluteSelection();
      const text = plainSelectionText();
      if (sel && text) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent('solomd:ai-rewrite-open', { detail: { selection: text, from: sel.from, to: sel.to } }),
        );
        return true;
      }
    }
    return false;
  }

  /**
   * #189/#210 — clear a stray *document-level* Range that WebView2 mirrors from
   * a `<textarea>` selection. On Mac/Linux `window.getSelection()` is empty while
   * a textarea is selected, but WebView2 reflects the field selection as a real
   * document Range that can outlive it and block click-to-deselect. Removing it
   * (while keeping the textarea's own `selectionStart/End`) restores normal
   * behaviour. `keep` is the field that legitimately owns the selection, so we
   * only strip ranges that fall outside it. No-op where getSelection is empty.
   */
  function clearStrayDocumentSelection(keep: HTMLElement): void {
    try {
      const sel = window.getSelection?.();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const anchor = sel.anchorNode;
      // A range anchored inside the field itself is the harmless mirror of the
      // textarea's own selection; anything else is a page-level selection that
      // shouldn't be there.
      if (anchor && keep.contains(anchor) && anchor !== keep) return;
      sel.removeAllRanges();
    } catch {
      /* getSelection unavailable — nothing to clear */
    }
  }

  function plainAbsoluteSelection(): { from: number; to: number } | null {
    if (plainLiveEnabled.value) {
      const el = plainBlockEditors.value[plainActiveBlock.value];
      const block = plainBlocks.value[plainActiveBlock.value];
      if (!el || !block) return null;
      return { from: block.start + (el.selectionStart ?? 0), to: block.start + (el.selectionEnd ?? 0) };
    }
    const el = plainEditor.value;
    if (!el) return null;
    return { from: el.selectionStart ?? 0, to: el.selectionEnd ?? 0 };
  }

  /** A bare Enter that is not part of an IME composition. */
  function isPlainEnter(event: KeyboardEvent): boolean {
    return (
      event.key === 'Enter' &&
      !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey &&
      !event.isComposing && event.keyCode !== 229
    );
  }

  // Mirror-based visual-row probes with logical-line fallbacks, so a DOM
  // hiccup degrades to the pre-4.9.6 behaviour instead of eating the keypress.
  function plainCaretEdgeRows(el: HTMLTextAreaElement, val: string, pos: number) {
    try {
      return caretRowInfo(el, val, pos);
    } catch {
      const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
      return { firstRow: lineStart === 0, lastRow: val.indexOf('\n', pos) < 0 };
    }
  }

  function plainLastRowStart(el: HTMLTextAreaElement, text: string): number {
    try {
      return lastVisualRowStart(el, text);
    } catch {
      return text.lastIndexOf('\n') + 1;
    }
  }

  function plainFirstRowEnd(el: HTMLTextAreaElement, text: string): number {
    try {
      return firstVisualRowEnd(el, text);
    } catch {
      const firstNl = text.indexOf('\n');
      return firstNl < 0 ? text.length : firstNl;
    }
  }

  function handlePlainBlockKeydown(index: number, event: KeyboardEvent) {
    if (plainComposing.value) return;
    if (handleAutocompleteKeydown(event)) return;
    if (handlePlainKeydownShared(event)) return;
    // Block-boundary arrow navigation (#155). Each block is its own <textarea>,
    // so the native caret dead-ends at the block edge — ↑/↓/←/→ can't cross into
    // the neighbouring block and the cursor appears stuck. Detect the edge and
    // hand focus to the adjacent block, preserving the column for ↑/↓. Plain
    // arrows on a collapsed caret only (Shift keeps native text selection).
    if (
      (event.key === 'ArrowUp' || event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
      !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
    ) {
      const el = event.target as HTMLTextAreaElement;
      if ((el.selectionStart ?? 0) === (el.selectionEnd ?? 0)) {
        const blocks = plainBlocks.value;
        const pos = el.selectionStart ?? 0;
        const val = el.value;
        if (event.key === 'ArrowLeft' && pos === 0 && index > 0) {
          event.preventDefault();
          activatePlainBlock(index - 1, blocks[index - 1]?.text.length ?? 0);
          return;
        }
        if (event.key === 'ArrowRight' && pos === val.length && index < blocks.length - 1) {
          event.preventDefault();
          activatePlainBlock(index + 1, 0);
          return;
        }
        // ↑/↓ hand-off must key on *visual* rows, not logical lines (#155
        // follow-up): with soft wrap on, a long paragraph is ONE logical line,
        // so the old `lineStart === 0` test fired from any wrapped row and ↑
        // teleported over the whole paragraph into the previous block.
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          const edge = plainCaretEdgeRows(el, val, pos);
          if (event.key === 'ArrowUp' && edge.firstRow && index > 0) {
            event.preventDefault();
            const prev = blocks[index - 1]?.text ?? '';
            // First visual row starts at 0, so the visual column is `pos`.
            // Land on the previous block's last visual row, same column.
            activatePlainBlock(index - 1, Math.min(plainLastRowStart(el, prev) + pos, prev.length));
            return;
          }
          if (event.key === 'ArrowDown' && edge.lastRow && index < blocks.length - 1) {
            event.preventDefault();
            const next = blocks[index + 1]?.text ?? '';
            const vcol = pos - plainLastRowStart(el, val);
            activatePlainBlock(index + 1, Math.min(vcol, plainFirstRowEnd(el, next)));
            return;
          }
        }
      }
    }
    // Esc dismisses a select-all (parks the caret at the selection end).
    if (plainSelectAll.value && event.key === 'Escape') {
      event.preventDefault();
      const el = event.target as HTMLTextAreaElement;
      const pos = el.selectionEnd ?? 0;
      el.setSelectionRange(pos, pos);
      maybeExitPlainSelectAll();
      return;
    }
    // Block-boundary Backspace / Delete. Each block is a standalone <textarea>, so
    // native Backspace at offset 0 (or Delete at the end) can't reach the
    // neighbouring block — it silently no-ops at every block edge, which users
    // experience as Backspace/Delete "works only intermittently". We fold the deletion onto the
    // full source instead: deleting the single separator char before/after the
    // block transparently removes a blank line or joins two paragraphs, exactly
    // as a single whole-document <textarea> would. (Plain key only — let the
    // browser keep word-delete / selection-delete.)
    if (
      (event.key === 'Backspace' || event.key === 'Delete') &&
      !event.ctrlKey && !event.metaKey && !event.altKey
    ) {
      const el = event.target as HTMLTextAreaElement;
      const block = plainBlocks.value[index];
      const selStart = el.selectionStart ?? 0;
      const selEnd = el.selectionEnd ?? 0;
      if (block && selStart === selEnd) {
        if (event.key === 'Backspace' && selStart === 0 && block.start > 0) {
          event.preventDefault();
          const delAt = block.start - 1; // the separator/char before this block
          applyPlainFullEdit(
            plainText.value.slice(0, delAt) + plainText.value.slice(delAt + 1),
            delAt,
          );
          return;
        }
        if (event.key === 'Delete' && selStart === el.value.length) {
          const delAt = block.start + el.value.length; // separator after visible text
          if (delAt < plainText.value.length) {
            event.preventDefault();
            applyPlainFullEdit(
              plainText.value.slice(0, delAt) + plainText.value.slice(delAt + 1),
              delAt,
            );
            return;
          }
        }
      }
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const el = event.target as HTMLTextAreaElement;
      const edit = computePlainTabEdit(el, event.shiftKey);
      updatePlainBlock(index, edit.value, edit.selStart);
      // updatePlainBlock's fast path may skip caret restore (block text unchanged
      // in length-mapping terms); force the selection so the caret follows the
      // indent and a range stays selected for repeated Tab.
      nextTick(() => {
        const e2 = plainBlockEditors.value[plainActiveBlock.value];
        if (e2) {
          e2.focus();
          e2.setSelectionRange(edit.selStart, edit.selEnd);
        }
      });
      return;
    }
    if (isPlainEnter(event)) {
      const el = event.target as HTMLTextAreaElement;
      const smart = computeSmartEnter(el);
      if (smart) {
        event.preventDefault();
        updatePlainBlock(index, smart.value, smart.caret);
        nextTick(() => {
          const e2 = plainBlockEditors.value[plainActiveBlock.value];
          if (e2) {
            e2.focus();
            const p = Math.min(smart.caret, e2.value.length);
            e2.setSelectionRange(p, p);
          }
        });
      }
    }
  }

  function handlePlainEditorKeydown(event: KeyboardEvent) {
    if (plainComposing.value) return;
    // Must come before the shared handler: ↑/↓/Enter/Tab/Esc belong to the
    // popup while it is open (Gitee IK6JCC).
    if (handleAutocompleteKeydown(event)) return;
    if (handlePlainKeydownShared(event)) return;
    if (event.key === 'Tab') {
      event.preventDefault();
      const el = event.target as HTMLTextAreaElement;
      const edit = computePlainTabEdit(el, event.shiftKey);
      recordPlainHistory();
      el.value = edit.value;
      el.setSelectionRange(edit.selStart, edit.selEnd);
      plainText.value = edit.value;
      tabs.setContent(props.tab.id, edit.value);
      emitPlainCursorAndSelection();
      return;
    }
    // #341 — the flat textarea (edit-only / split) never had list continuation;
    // only the live-edit blocks did.
    if (isPlainEnter(event)) {
      const el = event.target as HTMLTextAreaElement;
      const smart = computeSmartEnter(el);
      if (!smart) return;
      event.preventDefault();
      recordPlainHistory();
      el.value = smart.value;
      el.setSelectionRange(smart.caret, smart.caret);
      plainText.value = smart.value;
      tabs.setContent(props.tab.id, smart.value);
      emitPlainCursorAndSelection();
    }
  }

  return {
    handlePlainKeydownShared,
    clearStrayDocumentSelection,
    plainAbsoluteSelection,
    isPlainEnter,
    plainCaretEdgeRows,
    plainLastRowStart,
    plainFirstRowEnd,
    handlePlainBlockKeydown,
    handlePlainEditorKeydown,
  };
}
